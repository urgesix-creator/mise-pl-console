'use server';

// ====================================================================
// 日次売上（統合）エクスポート Server Action（読み取り専用・ExcelJS）
//
//   - 役割：認証＋権限チェック＋店舗アクセス確認 → daily_sales / daily_department_sales /
//           sales_departments を期間・店舗で SELECT（RLS適用）→ 純粋関数
//           buildIntegratedDailyWorkbook で色付き Workbook を生成 → base64 で返す。
//   - 【厳守】読み取りのみ。daily_sales / daily_department_sales / sales_departments へ
//           INSERT/UPDATE/DELETE は一切行わない。
//   - 経営データの計算・保存ロジックには触れない（取得値をそのまま純粋関数へ渡す）。
//   - 権限チェック（staff 拒否）はこのサーバ側で必ず実施（UI に依存しない）。
//   - RLS（can_access_store）が行範囲を多重防御で担保する前提。
//   - 統合版は「1店舗＝1ファイル」。store_id 必須。
//   - ブラウザのダウンロード起動（document 依存）はサーバ不可のため、
//     本 Action は filename＋xlsxバイナリ(base64) を返し、起動は UI ステップで行う。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import {
  buildIntegratedDailyWorkbook,
  enumerateDates,
  type IntegratedDeptSalesRow,
  type IntegratedDeptMasterRow,
} from './integrated-export';
import type { DailySalesExportRow } from './export';

/** 出力可能ロール（staff は含めない＝現場社員は出力不可） */
const EXPORT_ROLES = ['executive', 'country_rep', 'accounting', 'store_manager'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;

export type ExportIntegratedResult =
  | { success: true; filename: string; base64Xlsx: string; rowCount: number }
  | { success: false; error: string };

/** ファイル名に使えない文字を除去（export.ts の同等処理をローカルに用意） */
function sanitizeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').trim();
}

/** 日次売上統合_{店舗名}_{from}_{to}_{YYYYMMDD-HHMM}.xlsx */
function buildIntegratedFilename(storeName: string, from: string, to: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const stamp = `${y}${mo}${d}-${h}${mi}`;
  return `日次売上統合_${sanitizeFilenamePart(storeName)}_${from}_${to}_${stamp}.xlsx`;
}

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, country_id, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return null;
  return profile;
}

/** SELECT で取得する生の行（NUMERIC は文字列で返るため Number() 変換する） */
type RawSalesRow = {
  store_id: string;
  business_date: string;
  day_period: string;
  net_sales: number | string;
  gross_sales: number | string;
  service_fee: number | string;
  tax_amount: number | string;
  customer_count: number | string;
  weather: string | null;
  event_note: string | null;
};
type RawDeptSalesRow = {
  store_id: string;
  business_date: string;
  department_id: string;
  gross_sales: number | string;
};
type RawDeptMasterRow = { id: string; name: string; display_order: number };

/**
 * 日次売上（統合）を色付き Excel(.xlsx) としてエクスポートする（読み取り専用・1店舗1ファイル）。
 *
 * @param storeId 対象店舗（必須）
 * @param from    対象期間 開始日（YYYY-MM-DD）
 * @param to      対象期間 終了日（YYYY-MM-DD）
 */
export async function exportIntegratedDailySales(
  storeId: string,
  from: string,
  to: string,
): Promise<ExportIntegratedResult> {
  // --- 入力検証 -----------------------------------------------------
  if (!storeId || !UUID_PATTERN.test(storeId)) {
    return { success: false, error: '店舗を指定してください' };
  }
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return { success: false, error: '日付の形式が正しくありません（YYYY-MM-DD）' };
  }
  if (from > to) {
    return { success: false, error: '開始日が終了日より後になっています' };
  }

  // --- 認証＋権限チェック（最優先・サーバ側で確実に） ---------------
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: '認証が必要です' };
  if (!(EXPORT_ROLES as readonly string[]).includes(profile.role)) {
    return { success: false, error: '日次売上を出力する権限がありません' };
  }

  const supabase = await createClient();

  // --- 店舗アクセス確認（RLS: can_access_store が適用される） -------
  // 指定店舗が取得できない＝アクセス権がない（または存在しない）。店舗名もここで取得。
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .maybeSingle();
  if (storeError) {
    return { success: false, error: `店舗情報の取得に失敗しました: ${storeError.message}` };
  }
  if (!store) {
    return { success: false, error: 'アクセス可能な店舗が見つかりません' };
  }

  // --- 3クエリ（すべて読み取りのみ・RLS適用） ----------------------
  const [salesResult, deptSalesResult, deptMasterResult] = await Promise.all([
    // (1) 日次売上：当該店・期間・day_period='all'
    supabase
      .from('daily_sales')
      .select(
        'store_id, business_date, day_period, net_sales, gross_sales, service_fee, tax_amount, customer_count, weather, event_note',
      )
      .eq('store_id', storeId)
      .gte('business_date', from)
      .lte('business_date', to)
      .eq('day_period', 'all')
      .order('business_date', { ascending: true }),
    // (2) 部門別売上：当該店・期間
    supabase
      .from('daily_department_sales')
      .select('store_id, business_date, department_id, gross_sales')
      .eq('store_id', storeId)
      .gte('business_date', from)
      .lte('business_date', to),
    // (3) 部門マスタ：当該店の有効部門のみ・display_order 順
    supabase
      .from('sales_departments')
      .select('id, name, display_order')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ]);

  if (salesResult.error) {
    return { success: false, error: `日次売上の取得に失敗しました: ${salesResult.error.message}` };
  }
  if (deptSalesResult.error) {
    return { success: false, error: `部門別売上の取得に失敗しました: ${deptSalesResult.error.message}` };
  }
  if (deptMasterResult.error) {
    return { success: false, error: `部門マスタの取得に失敗しました: ${deptMasterResult.error.message}` };
  }

  // --- NUMERIC → Number() 変換し、純粋関数の入力型へ整形 -----------
  const salesRows: DailySalesExportRow[] = (
    (salesResult.data ?? []) as RawSalesRow[]
  ).map((r) => ({
    store_id: r.store_id,
    business_date: r.business_date,
    day_period: r.day_period,
    net_sales: Number(r.net_sales),
    gross_sales: Number(r.gross_sales),
    service_fee: Number(r.service_fee),
    tax_amount: Number(r.tax_amount),
    customer_count: Number(r.customer_count),
    weather: r.weather,
    event_note: r.event_note,
  }));

  const deptSalesRows: IntegratedDeptSalesRow[] = (
    (deptSalesResult.data ?? []) as RawDeptSalesRow[]
  ).map((r) => ({
    store_id: r.store_id,
    business_date: r.business_date,
    department_id: r.department_id,
    gross_sales: Number(r.gross_sales),
  }));

  const deptMaster: IntegratedDeptMasterRow[] = (
    (deptMasterResult.data ?? []) as RawDeptMasterRow[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    display_order: Number(r.display_order),
  }));

  // --- 出力行数（全日付テンプレ）。データの有無にかかわらず from〜to の全日付を出す ---
  // 純粋関数 buildIntegratedDailyWorkbook の行軸（allDates）と同一定義で件数を算出する。
  // データ0件でも空にはならない（記入用テンプレートを必ず出力する）。
  const dateSet = new Set<string>([
    ...enumerateDates(from, to),
    ...salesRows.map((r) => r.business_date),
    ...deptSalesRows.map((r) => r.business_date),
  ]);
  const rowCount = dateSet.size;

  // --- 純粋関数で Workbook 生成 → base64 ---------------------------
  const wb = buildIntegratedDailyWorkbook(salesRows, deptSalesRows, deptMaster, {
    storeName: store.name,
    storeId,
    from,
    to,
  });
  const buf = await wb.xlsx.writeBuffer();
  const base64Xlsx = Buffer.from(buf as ArrayBuffer).toString('base64');

  const filename = buildIntegratedFilename(store.name, from, to);

  return { success: true, filename, base64Xlsx, rowCount };
}
