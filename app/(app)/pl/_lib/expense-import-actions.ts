'use server';

// ====================================================================
// 月次PL 販管費（monthly_expenses）インポート Server Actions
//
//   - dryRunExpenseImport()  : 認証/can_write/店舗スコープ/store_id照合/既存値読取/parse/プレビュー
//                              生成（書込なし）。
//   - commitExpenseImport()  : 書込直前に runDryRun を再実行（サーバ再パース・再検証）し、
//                              その結果（new/update のセル）だけを monthly_expenses へ UPSERT。
//
//   【厳守】
//   - クライアントが送る値は信用しない（書込前に再ドライラン）。
//   - 書込先は monthly_expenses のみ。onConflict (store_id, year_month, account_name) で上書き。
//   - 空欄の月は UPSERT しない（既存を変更しない）。DELETE は一切しない。
//   - display_order：既存科目は踏襲・新規科目は末尾採番（upsertMonthlyExpense と同ロジック）。
//   - 権限：can_write（店長以上＋staff）。最終防衛線は RLS。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { ensureCanWriteForStore } from './expense-auth';
import {
  parseExpenseWorkbook,
  buildExpenseImportPreview,
  type BuildExpensePreviewContext,
} from './expense-import';
import type {
  ExpenseCommitResult,
  ExpenseDryRunResult,
  ExpenseImportPreview,
} from './expense-import-types';
import type { CategoryTag } from './expense-constants';
import { createClient } from '@/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type DryRunInternal =
  | { ok: false; error: string }
  | {
      ok: true;
      preview: ExpenseImportPreview;
      storeId: string;
      supabase: SupabaseServerClient;
      /** account_name → display_order（既存・踏襲用） */
      orderByName: Map<string, number>;
      /** 店舗内の最大 display_order（新規採番の起点） */
      maxOrder: number;
    };

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return '一意制約に違反しています（科目名・月の重複を確認してください）';
  if (error.code === '23514') return '入力値が制約に違反しています（区分または金額）';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

type RawExisting = { account_name: string; year_month: string; amount: number | string };
type RawOrder = { account_name: string; display_order: number | string };

async function runDryRun(formData: FormData): Promise<DryRunInternal> {
  const storeId = formData.get('storeId');
  if (typeof storeId !== 'string' || !UUID_PATTERN.test(storeId)) {
    return { ok: false, error: '取込先の店舗を指定してください' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'ファイルが選択されていません' };
  }

  const auth = await ensureCanWriteForStore(storeId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, store } = auth;

  // パース（DB非依存）
  const buffer = await file.arrayBuffer();
  const parsed = await parseExpenseWorkbook(buffer);
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

  // 月列の妥当性（YYYY-MM）
  const monthColumns = parsed.meta.monthColumns;
  if (monthColumns.length === 0) {
    return { ok: false, error: '月の列（YYYY-MM）が見つかりません' };
  }
  const monthStarts = monthColumns.map((ym) => `${ym}-01`);

  // 既存値（金額）をファイルの対象月で先読み（SELECT のみ）
  const existing = new Map<string, Map<string, number>>();
  {
    const { data, error } = await supabase
      .from('monthly_expenses')
      .select('account_name, year_month, amount')
      .eq('store_id', storeId)
      .in('year_month', monthStarts);
    if (error) return { ok: false, error: `既存の販管費の取得に失敗しました: ${error.message}` };
    for (const r of (data ?? []) as RawExisting[]) {
      const ym = r.year_month.slice(0, 7);
      let m = existing.get(r.account_name);
      if (!m) {
        m = new Map<string, number>();
        existing.set(r.account_name, m);
      }
      m.set(ym, Number(r.amount));
    }
  }

  // display_order：店舗内の全科目を読み、踏襲用マップと最大値を作る（store-wide・upsertMonthlyExpense と整合）
  const orderByName = new Map<string, number>();
  let maxOrder = 0;
  {
    const { data, error } = await supabase
      .from('monthly_expenses')
      .select('account_name, display_order')
      .eq('store_id', storeId);
    if (error) return { ok: false, error: `表示順の取得に失敗しました: ${error.message}` };
    for (const r of (data ?? []) as RawOrder[]) {
      const ord = Number(r.display_order);
      orderByName.set(r.account_name, ord);
      if (ord > maxOrder) maxOrder = ord;
    }
  }

  // 計算式科目（expense_formulas）の科目名一覧（衝突チェック用・読み取りのみ）
  const formulaNames = new Set<string>();
  {
    const { data, error } = await supabase
      .from('expense_formulas')
      .select('account_name')
      .eq('store_id', storeId);
    if (error) return { ok: false, error: `計算式科目の取得に失敗しました: ${error.message}` };
    for (const r of (data ?? []) as { account_name: string }[]) {
      formulaNames.add(r.account_name);
    }
  }

  const ctx: BuildExpensePreviewContext = {
    storeId,
    storeName: store.name,
    fiscalYearLabel: parsed.meta.fiscalYearLabel,
    monthColumns,
    existing,
    formulaNames,
  };

  const preview = buildExpenseImportPreview(parsed.rows, ctx);
  return { ok: true, preview, storeId, supabase, orderByName, maxOrder };
}

/** プレビュー（ドライラン）：書き込みなし */
export async function dryRunExpenseImport(formData: FormData): Promise<ExpenseDryRunResult> {
  const result = await runDryRun(formData);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, preview: result.preview };
}

type ExpenseUpsert = {
  store_id: string;
  year_month: string;
  account_name: string;
  category_tag: CategoryTag;
  amount: number;
  display_order: number;
};

/**
 * 販管費の Excel を実際に取り込む（monthly_expenses へ UPSERT）。
 * 安全策：書き込み直前に runDryRun() を再実行し、サーバ再検証した結果のみを保存する。
 */
export async function commitExpenseImport(formData: FormData): Promise<ExpenseCommitResult> {
  const result = await runDryRun(formData);
  if (!result.ok) return { success: false, error: result.error };

  const { preview, storeId, supabase, orderByName, maxOrder } = result;
  const { summary, rows } = preview;

  // new/update 行のセルを UPSERT 配列に展開。display_order を解決（既存踏襲・新規は末尾採番）。
  const upserts: ExpenseUpsert[] = [];
  let nextOrder = maxOrder;
  for (const row of rows) {
    if (row.status !== 'new' && row.status !== 'update') continue;
    if (!row.accountName || !row.categoryTag) continue;
    const name = row.accountName;
    let order = orderByName.get(name);
    if (order === undefined) {
      nextOrder += 1;
      order = nextOrder;
      orderByName.set(name, order); // 同一インポート内の重複新規を一意化
    }
    for (const cell of row.upsertCells) {
      upserts.push({
        store_id: storeId,
        year_month: `${cell.yearMonth}-01`,
        account_name: name,
        category_tag: row.categoryTag,
        amount: cell.next,
        display_order: order,
      });
    }
  }

  if (upserts.length === 0) {
    return {
      success: true,
      report: {
        accountsNew: 0,
        accountsUpdate: 0,
        cellsWritten: 0,
        skippedRows: summary.skipRows,
        errorRows: summary.errorRows,
      },
    };
  }

  const { error } = await supabase
    .from('monthly_expenses')
    .upsert(upserts, { onConflict: 'store_id,year_month,account_name' });
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');

  return {
    success: true,
    report: {
      accountsNew: summary.accountsNew,
      accountsUpdate: summary.accountsUpdate,
      cellsWritten: upserts.length,
      skippedRows: summary.skipRows,
      errorRows: summary.errorRows,
    },
  };
}
