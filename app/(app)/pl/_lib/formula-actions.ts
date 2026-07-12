'use server';

// ====================================================================
// 月次PL 変動費の計算式（expense_formulas）の保存・削除 Server Action
//
//   - upsertExpenseFormula：(store_id, account_name) で UPSERT 上書き。calc_type 別に必要な
//     パラメータが揃っているか検証し、不要なパラメータは null に正規化して保存。
//   - deleteExpenseFormula：計算式科目の物理 DELETE。
//     【重要・例外】物理DELETE はこのプロジェクトで monthly_expenses と expense_formulas のみ許可。
//     他テーブル・他操作では一切 DELETE しない。
//   - 書込先は expense_formulas のみ（018で作成済み・DB構造は変更しない）。
//   - 権限：can_write（店長以上・staff含む・018のRLSに従う）＋店舗スコープをサーバ側で再チェック。
//   - 計算ロジック（expense-formula.ts）・lib/pl・税計算・他テーブルには触れない。
// ====================================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ensureCanWriteForStore } from './expense-auth';
// 定数・型は通常モジュールに一元化（'use server' からは async関数のみ export 可のため）
import { CALC_TYPES, CALC_TYPE_REQUIRED_PARAMS, type CalcType } from './formula-constants';
import { CATEGORY_TAGS } from './expense-constants';

type ActionResult = { success: true } | { success: false; error: string };

const MAX_AMOUNT = 1_000_000_000_000;

// 入力スキーマ（型・範囲の一次検証。calc_type 別の必須チェックは後段で実施）
const upsertSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  account_name: z
    .string()
    .trim()
    .min(1, '科目名を入力してください')
    .max(100, '科目名は100文字以内で入力してください'),
  category_tag: z.enum(CATEGORY_TAGS, { errorMap: () => ({ message: '区分を選択してください' }) }),
  calc_type: z.enum(CALC_TYPES, { errorMap: () => ({ message: '計算タイプを選択してください' }) }),
  rate1: z.number().min(0, '率は0以上です').max(1, '率は1以下（小数）です').nullable().optional(),
  rate2: z.number().min(0, '率は0以上です').max(1, '率は1以下（小数）です').nullable().optional(),
  threshold: z.number().min(0, '境目金額は0以上です').max(MAX_AMOUNT, '境目金額が上限を超えています').nullable().optional(),
  fixed_amount: z.number().min(0, '固定額は0以上です').max(MAX_AMOUNT, '固定額が上限を超えています').nullable().optional(),
});

const deleteSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  account_name: z.string().trim().min(1, '科目名が不正です'),
});

const moveSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  account_name: z.string().trim().min(1, '科目名が不正です'),
  direction: z.enum(['up', 'down']),
});

export type UpsertExpenseFormulaInput = z.infer<typeof upsertSchema>;
export type DeleteExpenseFormulaInput = z.infer<typeof deleteSchema>;
export type MoveExpenseFormulaInput = z.infer<typeof moveSchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return '同名の計算式科目が既に存在します';
  if (error.code === '23514') return '入力値が制約に違反しています（計算タイプに必要なパラメータ・率の範囲）';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

const PARAM_LABEL: Record<'rate1' | 'rate2' | 'threshold' | 'fixed_amount', string> = {
  rate1: '率',
  rate2: '率（2段階目）',
  threshold: '境目金額',
  fixed_amount: '固定額',
};

/** calc_type に必要なパラメータが揃っているか検証し、不要分を null に落とした値を返す。 */
function normalizeParamsByType(
  input: UpsertExpenseFormulaInput,
):
  | { ok: true; rate1: number | null; rate2: number | null; threshold: number | null; fixed_amount: number | null }
  | { ok: false; error: string } {
  const required = CALC_TYPE_REQUIRED_PARAMS[input.calc_type as CalcType];
  const values = {
    rate1: input.rate1 ?? null,
    rate2: input.rate2 ?? null,
    threshold: input.threshold ?? null,
    fixed_amount: input.fixed_amount ?? null,
  };

  // 必須パラメータの欠落チェック
  for (const key of required) {
    if (values[key] === null) {
      return { ok: false, error: `${PARAM_LABEL[key]}を入力してください（${input.calc_type}）` };
    }
  }

  // 不要なパラメータは null に正規化（古い値の残留を防ぐ）
  const requiredSet = new Set(required);
  return {
    ok: true,
    rate1: requiredSet.has('rate1') ? values.rate1 : null,
    rate2: requiredSet.has('rate2') ? values.rate2 : null,
    threshold: requiredSet.has('threshold') ? values.threshold : null,
    fixed_amount: requiredSet.has('fixed_amount') ? values.fixed_amount : null,
  };
}

/** 計算式（店舗×科目）を UPSERT 上書き保存する。 */
export async function upsertExpenseFormula(
  input: UpsertExpenseFormulaInput,
): Promise<ActionResult> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const params = normalizeParamsByType(parsed.data);
  if (!params.ok) return { success: false, error: params.error };

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;
  const { store_id, account_name } = parsed.data;

  // display_order の解決：既存科目（同一 account_name）があればその値を踏襲。
  // 無ければ expense_formulas 内の最大 display_order + 1（末尾追加）。
  // ※ 計算式は専用サブ区画として手入力科目(monthly_expenses)とは別系統で採番する。
  const { data: existing } = await supabase
    .from('expense_formulas')
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
      .from('expense_formulas')
      .select('display_order')
      .eq('store_id', store_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    displayOrder = (maxRow ? Number((maxRow as { display_order: number }).display_order) : 0) + 1;
  }

  const { error } = await supabase.from('expense_formulas').upsert(
    {
      store_id,
      account_name, // schema で trim 済み
      category_tag: parsed.data.category_tag,
      calc_type: parsed.data.calc_type,
      rate1: params.rate1,
      rate2: params.rate2,
      threshold: params.threshold,
      fixed_amount: params.fixed_amount,
      display_order: displayOrder,
    },
    { onConflict: 'store_id,account_name' },
  );
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}

/**
 * 計算式科目を削除する（expense_formulas を物理 DELETE）。
 * 【重要・例外】物理DELETE は monthly_expenses と expense_formulas のみ許可。
 */
export async function deleteExpenseFormula(
  input: DeleteExpenseFormulaInput,
): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from('expense_formulas')
    .delete()
    .eq('store_id', parsed.data.store_id)
    .eq('account_name', parsed.data.account_name);
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}

/**
 * 計算式科目の表示順を1つ上/下へ入れ替える（即時保存）。
 * - 手入力科目の moveExpenseAccountOrder と同じパターンの計算式版（対象は expense_formulas）。
 * - 順序は「店舗×科目（account_name）」で1つ（018で UNIQUE・1行）。手入力科目とは別系統。
 * - 隣接科目とスワップし、display_order を 1..n に再採番。
 * - 書き込みは expense_formulas の display_order のみ。DELETE はしない。
 */
export async function moveExpenseFormulaOrder(
  input: MoveExpenseFormulaInput,
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;
  const { store_id, account_name, direction } = parsed.data;

  // 当該店舗の計算式科目を display_order 順に取得（expense_formulas は科目=1行）
  const { data, error: selError } = await supabase
    .from('expense_formulas')
    .select('account_name, display_order')
    .eq('store_id', store_id);
  if (selError) return { success: false, error: translateDbError(selError) };

  const accounts = ((data ?? []) as { account_name: string; display_order: number }[])
    .map((r) => ({ name: r.account_name, ord: Number(r.display_order) }))
    .sort((a, b) => a.ord - b.ord || a.name.localeCompare(b.name, 'ja'));

  const idx = accounts.findIndex((a) => a.name === account_name);
  if (idx === -1) return { success: false, error: '対象の科目が見つかりません' };
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= accounts.length) return { success: true }; // 端＝何もしない

  // スワップ → 1..n に再採番。変化した科目のみ UPDATE。
  [accounts[idx], accounts[swapIdx]] = [accounts[swapIdx], accounts[idx]];
  for (let p = 0; p < accounts.length; p++) {
    const newOrder = p + 1;
    if (accounts[p].ord !== newOrder) {
      const { error: updError } = await supabase
        .from('expense_formulas')
        .update({ display_order: newOrder })
        .eq('store_id', store_id)
        .eq('account_name', accounts[p].name);
      if (updError) return { success: false, error: translateDbError(updError) };
    }
  }

  revalidatePath('/pl');
  return { success: true };
}
