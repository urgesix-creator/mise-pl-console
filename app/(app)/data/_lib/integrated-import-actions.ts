'use server';

// ====================================================================
// 日次売上（統合）インポート Server Actions
//
//   - runDryRun()              : 認証/権限/店舗スコープ/マスタ・現在値読取/parse/
//                                buildImportPreview（内部で calculateSales 再計算）を行う共通前処理。
//                                書き込みは一切しない（読み取りのみ）。
//   - dryRunIntegratedImport() : runDryRun の結果をそのまま返すプレビュー用Action（書き込みなし）。
//   - commitIntegratedImport() : 書き込み直前に runDryRun を再実行（＝サーバ側で再パース・再検証・
//                                再計算）し、その結果だけを daily_sales / daily_department_sales へ
//                                バルクUPSERT する実書き込みAction。
//
//   【厳守】
//   - クライアントが送る計算値は信用しない。保存値は常にサーバ側 calculateSales の出力（§8.1）。
//   - 既存 calculateSales / upsertDailySalesSchema / 画面保存Action / 部門別Action / エクスポート /
//     プレビュー純粋関数は無変更で利用する。
//   - 書き込み先は daily_sales / daily_department_sales のみ。マッチングキーを厳守し、
//     ファイルに無いレコードは触らない（DELETE しない）。
//   - 客単価（avg_per_customer）は daily_sales に列が無いため保存しない（表示専用）。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  parseIntegratedWorkbook,
  buildImportPreview,
  type BuildPreviewContext,
  type ExistingSalesRow,
} from './integrated-import';
import type {
  DryRunResult,
  CommitResult,
  ImportPreview,
  ImportPreviewRow,
} from './integrated-import-types';

/** 取込可能ロール（staff は不可＝現場社員はインポート不可） */
const IMPORT_ROLES = ['executive', 'country_rep', 'accounting', 'store_manager'] as const;

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** SELECT で取得する生の行（NUMERIC は文字列で返るため Number() 変換する） */
type RawSalesRow = {
  business_date: string;
  net_sales: number | string;
  gross_sales: number | string;
  service_fee: number | string;
  tax_amount: number | string;
  customer_count: number | string;
  weather: string | null;
  event_note: string | null;
};
type RawDeptSalesRow = {
  business_date: string;
  department_id: string;
  gross_sales: number | string;
};

/** runDryRun の内部戻り値（commit でも再利用する。supabase/storeId を引き継ぐ） */
type DryRunInternal =
  | { ok: false; error: string }
  | {
      ok: true;
      preview: ImportPreview;
      storeId: string;
      supabase: SupabaseServerClient;
    };

/** DBエラーを日本語化（既存 actions.ts の translateDbError と同方針） */
function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return '一意制約に違反しています（マッチングキーを確認してください）';
  if (error.code === '23503') return '参照先のレコードが見つかりません';
  if (error.code === '23514') return '入力値が制約に違反しています';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

// --------------------------------------------------------------------
// 3-1: 共通前処理（認証・権限・スコープ・読取・パース・検証・再計算）
//      書き込みは一切しない。dryRun と commit の両方がこれを呼ぶ。
// --------------------------------------------------------------------
async function runDryRun(formData: FormData): Promise<DryRunInternal> {
  // --- 入力取得・検証 ----------------------------------------------
  const storeId = formData.get('storeId');
  if (typeof storeId !== 'string' || !UUID_PATTERN.test(storeId)) {
    return { ok: false, error: '取込先の店舗を指定してください' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'ファイルが選択されていません' };
  }

  // --- 認証＋権限チェック（サーバ側で確実に・UIに依存しない） -------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country_id, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) {
    return { ok: false, error: '無効なユーザーです' };
  }
  if (!(IMPORT_ROLES as readonly string[]).includes(profile.role)) {
    return { ok: false, error: 'インポート権限がありません' };
  }

  // --- 店舗アクセス確認（RLS が最終防衛線・ここでも明示チェック） ---
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, country_id, service_fee_rate, is_active, sales_service_fee_input_mode')
    .eq('id', storeId)
    .maybeSingle();
  if (storeError) {
    return { ok: false, error: `店舗情報の取得に失敗しました: ${storeError.message}` };
  }
  if (!store) return { ok: false, error: 'アクセス可能な店舗が見つかりません' };
  if (!store.is_active) return { ok: false, error: 'この店舗は無効化されています' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { ok: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager') {
    const { data: assignment } = await supabase
      .from('user_store_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!assignment) return { ok: false, error: '担当店舗外です' };
  }
  // executive / accounting は全店アクセス可

  // --- 国マスタ（税率・課税ベース） --------------------------------
  const { data: country, error: countryError } = await supabase
    .from('countries')
    .select('tax_rate, tax_base')
    .eq('id', store.country_id)
    .maybeSingle();
  if (countryError) {
    return { ok: false, error: `国マスタの取得に失敗しました: ${countryError.message}` };
  }
  if (!country) return { ok: false, error: '店舗の国マスタが見つかりません' };

  // --- 部門マスタ（有効部門：名称→ID 逆引き） ----------------------
  const { data: depts, error: deptError } = await supabase
    .from('sales_departments')
    .select('id, name')
    .eq('store_id', storeId)
    .eq('is_active', true);
  if (deptError) {
    return { ok: false, error: `部門マスタの取得に失敗しました: ${deptError.message}` };
  }
  const deptNameToId = new Map<string, string>((depts ?? []).map((d) => [d.name, d.id]));

  // --- パース（DB非依存） ------------------------------------------
  const buffer = await file.arrayBuffer();
  const parsed = await parseIntegratedWorkbook(buffer);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  // --- ファイルレベルの store_id 照合（データ行に store_id が無いため見出しで照合） ---
  if (!parsed.meta.storeId) {
    return {
      ok: false,
      error: 'ファイルの見出しから対象店舗（store_id）を読み取れません。最新フォーマットでエクスポートし直してください',
    };
  }
  if (parsed.meta.storeId !== storeId) {
    return {
      ok: false,
      error: 'ファイルの対象店舗が、選択した取込先店舗と一致しません（誤ファイル防止）',
    };
  }

  // --- 差分・判定用の現在値を期間で先読み（SELECT のみ） ----------
  const validDates = parsed.rows
    .map((r) => r.businessDate)
    .filter((d): d is string => d !== null && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const existingSales = new Map<string, ExistingSalesRow>();
  const existingDept = new Map<string, number>();

  if (validDates.length > 0) {
    const from = validDates.reduce((a, b) => (a < b ? a : b));
    const to = validDates.reduce((a, b) => (a > b ? a : b));

    const [salesResult, deptSalesResult] = await Promise.all([
      supabase
        .from('daily_sales')
        .select('business_date, net_sales, gross_sales, service_fee, tax_amount, customer_count, weather, event_note')
        .eq('store_id', storeId)
        .eq('day_period', 'all')
        .gte('business_date', from)
        .lte('business_date', to),
      supabase
        .from('daily_department_sales')
        .select('business_date, department_id, gross_sales')
        .eq('store_id', storeId)
        .gte('business_date', from)
        .lte('business_date', to),
    ]);

    if (salesResult.error) {
      return { ok: false, error: `既存売上の取得に失敗しました: ${salesResult.error.message}` };
    }
    if (deptSalesResult.error) {
      return { ok: false, error: `既存部門別売上の取得に失敗しました: ${deptSalesResult.error.message}` };
    }

    for (const r of (salesResult.data ?? []) as RawSalesRow[]) {
      existingSales.set(r.business_date, {
        net_sales: Number(r.net_sales),
        gross_sales: Number(r.gross_sales),
        service_fee: Number(r.service_fee),
        tax_amount: Number(r.tax_amount),
        customer_count: Number(r.customer_count),
        weather: r.weather,
        event_note: r.event_note,
      });
    }
    for (const r of (deptSalesResult.data ?? []) as RawDeptSalesRow[]) {
      existingDept.set(`${r.business_date}|${r.department_id}`, Number(r.gross_sales));
    }
  }

  // --- 検証＋プレビュー生成（純粋関数・内部で calculateSales 再計算） ---
  // Excel統合フォーマットには税区分列が無いため、取込は標準税率10%（店内飲食）で再計算する。
  const ctx: BuildPreviewContext = {
    storeId,
    storeName: store.name,
    taxCategory: 'standard',
    deptNameToId,
    existingSales,
    existingDept,
    periodFrom: parsed.meta.periodFrom,
    periodTo: parsed.meta.periodTo,
    deptHeaderNames: parsed.deptHeaderNames,
  };

  const preview = buildImportPreview(parsed.rows, ctx);
  return { ok: true, preview, storeId, supabase };
}

// --------------------------------------------------------------------
// プレビュー（ドライラン）Action：書き込みなし
// --------------------------------------------------------------------

/**
 * 統合フォーマットの Excel を取り込む前の「ドライラン」（書き込まない）。
 * @param formData storeId（取込先店舗・必須）と file（アップロード Excel）を含む
 */
export async function dryRunIntegratedImport(formData: FormData): Promise<DryRunResult> {
  const result = await runDryRun(formData);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, preview: result.preview };
}

// --------------------------------------------------------------------
// 3-2: 実書き込み（取込実行）Action：daily_sales / daily_department_sales のみ
// --------------------------------------------------------------------

/** daily_sales へ UPSERT する1行の形（既存 upsertDailySales と同一構造） */
type SalesUpsert = {
  store_id: string;
  business_date: string;
  day_period: 'all';
  net_sales: number;
  gross_sales: number;
  service_fee: number;
  tax_amount: number;
  tax_category: 'standard' | 'reduced';
  customer_count: number;
  weather: string | null;
  event_note: string | null;
  service_fee_included: boolean;
};

/** daily_department_sales へ UPSERT する1行の形（既存部門別Action と同一構造） */
type DeptUpsert = {
  store_id: string;
  business_date: string;
  department_id: string;
  gross_sales: number;
  notes: string | null;
};

/** プレビュー行（new/update のみ）から daily_sales UPSERT 配列を作る。
 *  値はサーバ再計算済み（input＋recalc）。客単価は保存しない。 */
function buildSalesUpserts(rows: ImportPreviewRow[]): SalesUpsert[] {
  const out: SalesUpsert[] = [];
  for (const row of rows) {
    if (row.status !== 'new' && row.status !== 'update') continue;
    if (!row.key || !row.recalc || row.input.netSales === null) continue; // 念のための防御
    // 税込は独立入力。空欄なら税抜＋消費税（recalc.taxAmount）を既定として保存する。
    const grossInput = row.input.grossSales ?? 0;
    const gross = grossInput > 0 ? grossInput : row.input.netSales + row.recalc.taxAmount;
    out.push({
      store_id: row.key.storeId,
      business_date: row.key.businessDate,
      day_period: 'all', // 全店all前提（マッチングキーの一部）
      net_sales: row.input.netSales, // 記入値（税抜）そのまま
      gross_sales: gross, // 独立入力（税込・空欄なら net+tax）
      service_fee: 0, // 消費税制では常に0
      tax_amount: row.recalc.taxAmount, // サーバ再計算（消費税・標準10%）
      tax_category: 'standard', // Excelに税区分列が無いため標準税率で取込
      customer_count: row.input.customerCount ?? 0,
      weather: row.input.weather,
      event_note: row.input.eventNote,
      service_fee_included: false, // 消費税制では未使用
    });
  }
  return out;
}

/** プレビュー行（new/update のみ）から部門別 UPSERT 配列を作る。
 *  未登録部門・空欄・無効値（action!=='apply' / gross===null / id===null）は除外。 */
function buildDeptUpserts(rows: ImportPreviewRow[]): DeptUpsert[] {
  const out: DeptUpsert[] = [];
  for (const row of rows) {
    if (row.status !== 'new' && row.status !== 'update') continue;
    const key = row.key;
    if (!key) continue;
    for (const d of row.departments) {
      if (d.action !== 'apply' || d.gross === null || d.departmentId === null) continue;
      out.push({
        store_id: key.storeId,
        business_date: key.businessDate,
        department_id: d.departmentId,
        gross_sales: d.gross,
        notes: null,
      });
    }
  }
  return out;
}

/**
 * 統合フォーマットの Excel を実際に取り込む（daily_sales / daily_department_sales へ UPSERT）。
 *
 * 安全策：書き込み直前に runDryRun() を再実行し、サーバ側で再パース・再検証・再計算した
 * 結果のみを保存する（クライアントが送る値は信用しない）。
 *
 * 2テーブルは非原子（テーブル単位 UPSERT）。daily_sales を先、daily_department_sales を後に書く。
 * いずれも常に上書き（冪等）なので、途中失敗時は同じファイルで再取込すれば回復できる。
 *
 * @param formData storeId と file（プレビューと同一のものを送る）
 */
export async function commitIntegratedImport(formData: FormData): Promise<CommitResult> {
  // --- 書き込み直前の再検証・再計算（サーバ側） --------------------
  const result = await runDryRun(formData);
  if (!result.ok) return { success: false, error: result.error };

  const { preview, supabase } = result;
  const { summary, rows } = preview;

  const salesUpserts = buildSalesUpserts(rows);
  const deptUpserts = buildDeptUpserts(rows);

  // 書き込み対象が0件（全行 error/skip）：DBは変更せず結果のみ返す
  if (salesUpserts.length === 0 && deptUpserts.length === 0) {
    return {
      success: true,
      report: {
        salesNew: 0,
        salesUpdate: 0,
        deptWritten: 0,
        skippedRows: summary.skipCount,
        errorRows: summary.errorCount,
        skippedDepartments: summary.skippedDepartments,
      },
    };
  }

  // --- ① daily_sales（経営・主）をバルクUPSERT --------------------
  // マッチングキー (store_id, business_date, day_period) で常に上書き。
  if (salesUpserts.length > 0) {
    const { error: salesError } = await supabase
      .from('daily_sales')
      .upsert(salesUpserts, { onConflict: 'store_id,business_date,day_period' });
    if (salesError) {
      // 経営データで失敗 → このステートメントは原子的なので何も書かれていない
      return {
        success: false,
        error: `経営データの取込に失敗しました（何も書き込まれていません。同じファイルで再取込してください）: ${translateDbError(salesError)}`,
        partial: { salesCommitted: false, deptCommitted: false },
      };
    }
  }

  // --- ② daily_department_sales（部門・従）をバルクUPSERT ---------
  // マッチングキー (store_id, business_date, department_id) で常に上書き。
  if (deptUpserts.length > 0) {
    const { error: deptError } = await supabase
      .from('daily_department_sales')
      .upsert(deptUpserts, { onConflict: 'store_id,business_date,department_id' });
    if (deptError) {
      // 経営データは反映済み・部門別のみ失敗。再取込で回復可能（上書きのため二重計上なし）。
      return {
        success: false,
        error: `経営データは取込済みですが、部門別売上の取込に失敗しました（同じファイルで再取込すれば部門別が回復します）: ${translateDbError(deptError)}`,
        partial: { salesCommitted: true, deptCommitted: false },
      };
    }
  }

  // --- キャッシュ無効化（ダッシュボード・データ画面・日次入力） ----
  revalidatePath('/dashboard');
  revalidatePath('/data');
  revalidatePath('/daily-input/sales');

  return {
    success: true,
    report: {
      salesNew: summary.newCount,
      salesUpdate: summary.updateCount,
      deptWritten: deptUpserts.length,
      skippedRows: summary.skipCount,
      errorRows: summary.errorCount,
      skippedDepartments: summary.skippedDepartments,
    },
  };
}
