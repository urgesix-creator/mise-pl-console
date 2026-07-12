'use server';

// ====================================================================
// 売上予算（日次目標）エクスポート Server Action（読み取り専用・ExcelJS）
//
//   - daily_targets を店舗・期間で SELECT（RLS適用）→ 純粋関数 buildTargetWorkbook で
//     テンプレート Workbook を生成 → base64 で返す。
//   - 【厳守】読み取りのみ。daily_targets へ INSERT/UPDATE/DELETE は一切行わない。
//   - 権限：店長以上（executive / country_rep / store_manager）。staff・accounting 不可
//     （daily_targets の書込RLS と揃える）。
//   - 1店舗＝1ファイル。store_id 必須。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { enumerateDates, sanitizeFilenamePart } from '@/lib/xlsx-utils';
import { buildTargetWorkbook, type TargetExportRow } from './target-export';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;

export type ExportTargetResult =
  | { success: true; filename: string; base64Xlsx: string; rowCount: number }
  | { success: false; error: string };

function buildTargetFilename(storeName: string, from: string, to: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const stamp = `${y}${mo}${d}-${h}${mi}`;
  return `売上予算_${sanitizeFilenamePart(storeName)}_${from}_${to}_${stamp}.xlsx`;
}

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return null;
  return profile;
}

type RawTargetRow = { target_date: string; target_sales: number | string };

/**
 * 売上予算（日次目標）テンプレートを Excel(.xlsx) としてエクスポートする（読み取り専用）。
 */
export async function exportSalesTargets(
  storeId: string,
  from: string,
  to: string,
): Promise<ExportTargetResult> {
  if (!storeId || !UUID_PATTERN.test(storeId)) {
    return { success: false, error: '店舗を指定してください' };
  }
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return { success: false, error: '日付の形式が正しくありません（YYYY-MM-DD）' };
  }
  if (from > to) {
    return { success: false, error: '開始日が終了日より後になっています' };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: '認証が必要です' };

  const supabase = await createClient();
  if (!(await roleHasCapability(supabase, profile.role, 'targets'))) {
    return { success: false, error: '売上予算を出力する権限がありません' };
  }

  // 店舗アクセス確認（RLS: can_access_store が適用される）。店舗名もここで取得。
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .maybeSingle();
  if (storeError) {
    return { success: false, error: `店舗情報の取得に失敗しました: ${storeError.message}` };
  }
  if (!store) return { success: false, error: 'アクセス可能な店舗が見つかりません' };

  // 既存予算を期間で読取（RLS適用・読み取りのみ）
  const { data, error } = await supabase
    .from('daily_targets')
    .select('target_date, target_sales')
    .eq('store_id', storeId)
    .gte('target_date', from)
    .lte('target_date', to)
    .order('target_date', { ascending: true });
  if (error) {
    return { success: false, error: `売上予算の取得に失敗しました: ${error.message}` };
  }

  const rows: TargetExportRow[] = ((data ?? []) as RawTargetRow[]).map((r) => ({
    target_date: r.target_date,
    target_sales: Number(r.target_sales),
  }));

  // 全日付テンプレ（データ0件でも from〜to の全日付を出す）
  const rowCount = new Set<string>([
    ...enumerateDates(from, to),
    ...rows.map((r) => r.target_date),
  ]).size;

  const wb = buildTargetWorkbook(rows, { storeName: store.name, storeId, from, to });
  const buf = await wb.xlsx.writeBuffer();
  const base64Xlsx = Buffer.from(buf as ArrayBuffer).toString('base64');

  return { success: true, filename: buildTargetFilename(store.name, from, to), base64Xlsx, rowCount };
}
