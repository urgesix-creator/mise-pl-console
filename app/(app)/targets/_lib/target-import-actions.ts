'use server';

// ====================================================================
// 売上予算（日次目標）インポート Server Actions
//
//   - runDryRun()           : 認証/権限/店舗スコープ/既存値読取/parse/プレビュー生成（書込なし）。
//   - dryRunTargetImport()  : プレビュー用Action（書込なし）。
//   - commitTargetImport()  : 書込直前に runDryRun を再実行（サーバ再パース・再検証）し、
//                             その結果だけを daily_targets へバルクUPSERT する。
//
//   【厳守】
//   - クライアントが送る値は信用しない（書込前に再ドライラン）。
//   - 書込先は daily_targets のみ。onConflict (store_id, target_date) で常に上書き。
//   - ファイルに無い日付は触らない（DELETE しない）。空欄=0で上書き（全日付が対象）。
//   - 権限：店長以上（executive / country_rep / store_manager）。staff・accounting 不可
//     （daily_targets の書込RLS と一致）。最終防衛線は RLS。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import {
  parseTargetWorkbook,
  buildTargetImportPreview,
  type BuildTargetPreviewContext,
} from './target-import';
import type {
  TargetDryRunResult,
  TargetCommitResult,
  TargetImportPreview,
  TargetPreviewRow,
} from './target-import-types';


const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type DryRunInternal =
  | { ok: false; error: string }
  | { ok: true; preview: TargetImportPreview; storeId: string; supabase: SupabaseServerClient };

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return '一意制約に違反しています（日付の重複を確認してください）';
  if (error.code === '23514') return '入力値が制約に違反しています（予算額は0以上）';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

type RawTargetRow = { target_date: string; target_sales: number | string };

async function runDryRun(formData: FormData): Promise<DryRunInternal> {
  const storeId = formData.get('storeId');
  if (typeof storeId !== 'string' || !UUID_PATTERN.test(storeId)) {
    return { ok: false, error: '取込先の店舗を指定してください' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'ファイルが選択されていません' };
  }

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
  if (!profile || !profile.is_active) return { ok: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'targets'))) {
    return { ok: false, error: 'インポート権限がありません' };
  }

  // 店舗アクセス確認（RLS が最終防衛線・ここでも明示チェック）
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, country_id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (storeError) return { ok: false, error: `店舗情報の取得に失敗しました: ${storeError.message}` };
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
  // executive は全店アクセス可

  // パース（DB非依存）
  const buffer = await file.arrayBuffer();
  const parsed = await parseTargetWorkbook(buffer);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // ファイルレベルの store_id 照合（誤ファイル防止）
  if (!parsed.meta.storeId) {
    return {
      ok: false,
      error: 'ファイルの見出しから対象店舗（store_id）を読み取れません。最新フォーマットでエクスポートし直してください',
    };
  }
  if (parsed.meta.storeId !== storeId) {
    return { ok: false, error: 'ファイルの対象店舗が、選択した取込先店舗と一致しません（誤ファイル防止）' };
  }

  // 既存値を期間で先読み（SELECT のみ）
  const validDates = parsed.rows
    .map((r) => r.targetDate)
    .filter((d): d is string => d !== null && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const existing = new Map<string, number>();
  if (validDates.length > 0) {
    const from = validDates.reduce((a, b) => (a < b ? a : b));
    const to = validDates.reduce((a, b) => (a > b ? a : b));
    const { data, error } = await supabase
      .from('daily_targets')
      .select('target_date, target_sales')
      .eq('store_id', storeId)
      .gte('target_date', from)
      .lte('target_date', to);
    if (error) return { ok: false, error: `既存予算の取得に失敗しました: ${error.message}` };
    for (const r of (data ?? []) as RawTargetRow[]) {
      existing.set(r.target_date, Number(r.target_sales));
    }
  }

  const ctx: BuildTargetPreviewContext = {
    storeId,
    storeName: store.name,
    existing,
    periodFrom: parsed.meta.periodFrom,
    periodTo: parsed.meta.periodTo,
  };

  const preview = buildTargetImportPreview(parsed.rows, ctx);
  return { ok: true, preview, storeId, supabase };
}

/** プレビュー（ドライラン）：書き込みなし */
export async function dryRunTargetImport(formData: FormData): Promise<TargetDryRunResult> {
  const result = await runDryRun(formData);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, preview: result.preview };
}

type TargetUpsert = { store_id: string; target_date: string; target_sales: number };

/** new/update 行から daily_targets UPSERT 配列を作る */
function buildTargetUpserts(rows: TargetPreviewRow[]): TargetUpsert[] {
  const out: TargetUpsert[] = [];
  for (const row of rows) {
    if (row.status !== 'new' && row.status !== 'update') continue;
    if (!row.key || row.targetSales === null) continue;
    out.push({
      store_id: row.key.storeId,
      target_date: row.key.targetDate,
      target_sales: row.targetSales,
    });
  }
  return out;
}

/**
 * 売上予算の Excel を実際に取り込む（daily_targets へ UPSERT）。
 * 安全策：書き込み直前に runDryRun() を再実行し、サーバ再検証した結果のみを保存する。
 */
export async function commitTargetImport(formData: FormData): Promise<TargetCommitResult> {
  const result = await runDryRun(formData);
  if (!result.ok) return { success: false, error: result.error };

  const { preview, supabase } = result;
  const { summary, rows } = preview;
  const upserts = buildTargetUpserts(rows);

  if (upserts.length === 0) {
    return {
      success: true,
      report: { inserted: 0, updated: 0, skippedRows: summary.skipCount, errorRows: summary.errorCount },
    };
  }

  const { error } = await supabase
    .from('daily_targets')
    .upsert(upserts, { onConflict: 'store_id,target_date' });
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/targets');

  return {
    success: true,
    report: {
      inserted: summary.newCount,
      updated: summary.updateCount,
      skippedRows: summary.skipCount,
      errorRows: summary.errorCount,
    },
  };
}
