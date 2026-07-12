'use server';

// ====================================================================
// 月次PL：販管費（monthly_expenses）の即時保存・科目削除 Server Action
//
//   - upsertMonthlyExpense：金額入力時に (store_id, year_month, account_name) で UPSERT 上書き。
//     科目名・区分タグが揃ってから保存（科目名が空なら保存しない）。
//   - deleteMonthlyExpenseAccount：科目行の削除＝当該科目の monthly_expenses を物理 DELETE。
//     【重要・例外】物理DELETE はこのプロジェクトで唯一、販管費科目（monthly_expenses）のみ許可。
//     他テーブル・他操作では一切 DELETE しない。
//   - 書込先は monthly_expenses のみ（015/016で作成済み・DB構造は変更しない）。
//   - 権限：can_write（店長以上・staff含む・015のRLSに従う）＋店舗スコープをサーバ側で再チェック。
//   - 現地通貨で保存。税計算・経営データ・他テーブルには触れない。
// ====================================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
// 定数・型は通常モジュールに一元化（'use server' からは async関数のみ export 可のため）
import { CATEGORY_TAGS } from './expense-constants';

type ActionResult = { success: true } | { success: false; error: string };

const YM01 = /^\d{4}-\d{2}-01$/;

const upsertSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  year_month: z.string().regex(YM01, '対象月は月初日（YYYY-MM-01）で指定してください'),
  account_name: z
    .string()
    .trim()
    .min(1, '科目名を入力してください')
    .max(100, '科目名は100文字以内で入力してください'),
  category_tag: z.enum(CATEGORY_TAGS, { errorMap: () => ({ message: '区分を選択してください' }) }),
  amount: z
    .number({ invalid_type_error: '金額を数値で入力してください' })
    .nonnegative('金額は0以上で入力してください')
    .max(1_000_000_000_000, '金額の上限を超えています'),
});

const deleteSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  account_name: z.string().trim().min(1, '科目名が不正です'),
  // 削除対象の月（当年度の12ヶ月ぶんの月初DATE）
  year_months: z.array(z.string().regex(YM01)).min(1).max(12),
});

const moveSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  account_name: z.string().trim().min(1, '科目名が不正です'),
  direction: z.enum(['up', 'down']),
});

export type UpsertMonthlyExpenseInput = z.infer<typeof upsertSchema>;
export type DeleteMonthlyExpenseInput = z.infer<typeof deleteSchema>;
export type MoveMonthlyExpenseInput = z.infer<typeof moveSchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23514') return '入力値が制約に違反しています（区分または金額）';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

/** 認証・can_write・店舗スコープを検証して supabase クライアントを返す */
async function ensureCanWriteForStore(
  storeId: string,
): Promise<{ ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; error: string }> {
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
  if (!(await roleHasCapability(supabase, profile.role, 'daily_input'))) {
    return { ok: false, error: '販管費の入力権限がありません' };
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, country_id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return { ok: false, error: 'アクセス可能な店舗が見つかりません' };
  if (!store.is_active) return { ok: false, error: 'この店舗は無効化されています' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { ok: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager' || profile.role === 'staff') {
    const { data: assignment } = await supabase
      .from('user_store_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!assignment) return { ok: false, error: '担当店舗外です' };
  }
  return { ok: true, supabase };
}

/** 販管費1セル（店舗×月×科目）を UPSERT 上書き保存する。 */
export async function upsertMonthlyExpense(
  input: UpsertMonthlyExpenseInput,
): Promise<ActionResult> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;
  const { store_id, account_name } = parsed.data;

  // display_order の解決：既存科目（同一 account_name）があればその値を踏襲（全月共通）。
  // 無ければ当該店舗の最大 display_order + 1（末尾に追加）。
  const { data: existing } = await supabase
    .from('monthly_expenses')
    .select('display_order')
    .eq('store_id', store_id)
    .eq('account_name', account_name)
    .limit(1)
    .maybeSingle();
  let displayOrder: number;
  if (existing) {
    displayOrder = Number((existing as { display_order: number }).display_order);
  } else {
    const { data: maxRow } = await supabase
      .from('monthly_expenses')
      .select('display_order')
      .eq('store_id', store_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    displayOrder = (maxRow ? Number((maxRow as { display_order: number }).display_order) : 0) + 1;
  }

  const { error } = await supabase.from('monthly_expenses').upsert(
    {
      store_id,
      year_month: parsed.data.year_month,
      account_name, // schema で trim 済み
      category_tag: parsed.data.category_tag,
      amount: parsed.data.amount,
      display_order: displayOrder,
    },
    { onConflict: 'store_id,year_month,account_name' },
  );
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}

const bulkFillSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  account_name: z
    .string()
    .trim()
    .min(1, '科目名を入力してください')
    .max(100, '科目名は100文字以内で入力してください'),
  category_tag: z.enum(CATEGORY_TAGS, { errorMap: () => ({ message: '区分を選択してください' }) }),
  year_months: z.array(z.string().regex(YM01)).min(1, '対象月がありません').max(12),
  amount: z
    .number({ invalid_type_error: '金額を数値で入力してください' })
    .nonnegative('金額は0以上で入力してください')
    .max(1_000_000_000_000, '金額の上限を超えています'),
});
export type BulkFillMonthlyExpenseInput = z.infer<typeof bulkFillSchema>;

/**
 * 販管費科目を、指定した全月へ「同額」で一括 UPSERT 保存する（#6 A案・固定費の年間一括入力）。
 * 入力後は各月セルを個別に上書き編集できるため、途中月だけ変動させる運用にも対応する。
 */
export async function bulkFillMonthlyExpense(
  input: BulkFillMonthlyExpenseInput,
): Promise<ActionResult> {
  const parsed = bulkFillSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;
  const { store_id, account_name, category_tag, amount, year_months } = parsed.data;

  // display_order 解決（既存科目を踏襲 or 末尾に追加）。upsertMonthlyExpense と同方針。
  const { data: existing } = await supabase
    .from('monthly_expenses')
    .select('display_order')
    .eq('store_id', store_id)
    .eq('account_name', account_name)
    .limit(1)
    .maybeSingle();
  let displayOrder: number;
  if (existing) {
    displayOrder = Number((existing as { display_order: number }).display_order);
  } else {
    const { data: maxRow } = await supabase
      .from('monthly_expenses')
      .select('display_order')
      .eq('store_id', store_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    displayOrder = (maxRow ? Number((maxRow as { display_order: number }).display_order) : 0) + 1;
  }

  const rows = year_months.map((ym) => ({
    store_id,
    year_month: ym,
    account_name,
    category_tag,
    amount,
    display_order: displayOrder,
  }));
  const { error } = await supabase
    .from('monthly_expenses')
    .upsert(rows, { onConflict: 'store_id,year_month,account_name' });
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}

const copySchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  from_year_month: z.string().regex(YM01, 'コピー元の月が不正です（YYYY-MM-01）'),
  to_year_month: z.string().regex(YM01, 'コピー先の月が不正です（YYYY-MM-01）'),
});
export type CopyMonthlyExpensesInput = z.infer<typeof copySchema>;
type CopyResult = { success: true; copied: number } | { success: false; error: string };

/**
 * 販管費（手入力科目）を「コピー元の月」→「コピー先の月」へ引き継ぐ（前月引き継ぎ等）。
 * - コピー元の monthly_expenses（手入力科目）を、科目名・区分・金額・表示順そのままコピー先月へ UPSERT。
 * - コピー先の同名科目は上書き。コピー先にしか無い科目は残す（DELETEしない）。
 * - 計算式の科目（expense_formulas）は monthly_expenses に無いため対象外（自動計算のまま）。
 * - 売上・原価・税計算(§8.1)には触れない（販管費の手入力値のみ）。
 */
export async function copyMonthlyExpenses(input: CopyMonthlyExpensesInput): Promise<CopyResult> {
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }
  const { store_id, from_year_month, to_year_month } = parsed.data;
  if (from_year_month === to_year_month) {
    return { success: false, error: 'コピー元とコピー先が同じ月です' };
  }

  const auth = await ensureCanWriteForStore(store_id);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;

  const { data: src, error: readError } = await supabase
    .from('monthly_expenses')
    .select('account_name, category_tag, amount, display_order')
    .eq('store_id', store_id)
    .eq('year_month', from_year_month);
  if (readError) return { success: false, error: translateDbError(readError) };
  if (!src || src.length === 0) {
    return { success: false, error: 'コピー元の月に販管費の科目がありません' };
  }

  const rows = src.map((r) => ({
    store_id,
    year_month: to_year_month,
    account_name: r.account_name,
    category_tag: r.category_tag,
    amount: r.amount,
    display_order: r.display_order,
  }));
  const { error } = await supabase
    .from('monthly_expenses')
    .upsert(rows, { onConflict: 'store_id,year_month,account_name' });
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true, copied: rows.length };
}

/**
 * 販管費の科目行を削除する（当年度12ヶ月ぶんの該当科目を物理 DELETE）。
 * 【重要・例外】物理DELETE は monthly_expenses（販管費科目）のみ許可。
 */
export async function deleteMonthlyExpenseAccount(
  input: DeleteMonthlyExpenseInput,
): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from('monthly_expenses')
    .delete()
    .eq('store_id', parsed.data.store_id)
    .eq('account_name', parsed.data.account_name)
    .in('year_month', parsed.data.year_months);
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}

/**
 * 販管費科目の表示順を1つ上/下へ入れ替える（即時保存）。
 * - 順序は「店舗×科目（account_name）」で1つ・全月共通。
 * - 隣接科目とスワップし、display_order を 1..n に再採番（同一 account_name の全月行を一括更新）。
 * - 書き込みは monthly_expenses の display_order のみ。
 */
export async function moveExpenseAccountOrder(
  input: MoveMonthlyExpenseInput,
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;
  const { store_id, account_name, direction } = parsed.data;

  // 当該店舗の科目（account_name）一覧を display_order 順に取得（行は月ごとだが科目単位に集約）
  const { data, error: selError } = await supabase
    .from('monthly_expenses')
    .select('account_name, display_order')
    .eq('store_id', store_id);
  if (selError) return { success: false, error: translateDbError(selError) };

  const orderByName = new Map<string, number>();
  for (const r of (data ?? []) as { account_name: string; display_order: number }[]) {
    orderByName.set(r.account_name, Number(r.display_order));
  }
  const accounts = [...orderByName.entries()]
    .map(([name, ord]) => ({ name, ord }))
    .sort((a, b) => a.ord - b.ord || a.name.localeCompare(b.name, 'ja'));

  const idx = accounts.findIndex((a) => a.name === account_name);
  if (idx === -1) return { success: false, error: '対象の科目が見つかりません' };
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= accounts.length) return { success: true }; // 端＝何もしない

  // スワップ → 1..n に再採番。変化した科目のみ全月行を一括 UPDATE。
  [accounts[idx], accounts[swapIdx]] = [accounts[swapIdx], accounts[idx]];
  for (let p = 0; p < accounts.length; p++) {
    const newOrder = p + 1;
    if (accounts[p].ord !== newOrder) {
      const { error: updError } = await supabase
        .from('monthly_expenses')
        .update({ display_order: newOrder })
        .eq('store_id', store_id)
        .eq('account_name', accounts[p].name);
      if (updError) return { success: false, error: translateDbError(updError) };
    }
  }

  revalidatePath('/pl');
  return { success: true };
}
