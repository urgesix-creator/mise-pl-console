'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { findSimilarNames } from '@/lib/suppliers/similar';
import type { Database } from '@/types/database';

const supplierFormSchema = z.object({
  store_id: z.string().uuid('店舗を指定してください'),
  category_id: z.string().uuid('カテゴリを選択してください'),
  name: z
    .string()
    .trim()
    .min(1, '仕入先名を入力してください')
    .max(100, '仕入先名は100文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '表示順は数値で入力してください' })
    .int('表示順は整数で入力してください')
    .min(0, '表示順は0以上で入力してください'),
  cost_type: z.enum(['cogs', 'sga'], {
    errorMap: () => ({ message: '原価区分を選択してください' }),
  }),
  // 仕入税率(%)・非課税（仕入のみに使用・売上§8.1には不使用）。
  // tax_rate 未指定時は店舗標準（stores.purchase_tax_rate_default）を適用。
  tax_rate: z
    .number({ invalid_type_error: '税率は数値で入力してください' })
    .min(0, '税率は0以上で入力してください')
    .max(100, '税率は100以下で入力してください')
    .optional(),
  is_tax_exempt: z.boolean().optional(),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

type ActionResult = { success: true } | { success: false; error: string };
type CountResult =
  | { success: true; count: number }
  | { success: false; error: string };

/**
 * 指定店舗の仕入先に書き込み可能かをサーバー側で事前検証。
 * 最終防衛線は RLS。権限は role_permissions（store_master）を参照。
 */
async function ensureCanWriteForStore(storeId: string): Promise<ActionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country_id, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    return { success: false, error: '無効なユーザーです' };
  }
  if (!(await roleHasCapability(supabase, profile.role, 'store_master'))) {
    return { success: false, error: '編集権限がありません' };
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, country_id')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return { success: false, error: '店舗が見つかりません' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { success: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager') {
    const { data: assignment } = await supabase
      .from('user_store_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!assignment) return { success: false, error: '担当店舗外です' };
  }

  return null;
}

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'この仕入先名は既に同一店舗に存在します';
  if (error.code === '23503') return '参照先のカテゴリが見つかりません';
  return `処理に失敗しました: ${error.message}`;
}

/**
 * カテゴリが指定店舗に属し、有効であることを検証。
 */
async function validateCategory(
  storeId: string,
  categoryId: string,
): Promise<ActionResult | null> {
  const supabase = await createClient();
  const { data: category } = await supabase
    .from('purchase_categories')
    .select('id, store_id, is_active')
    .eq('id', categoryId)
    .maybeSingle();

  if (!category) return { success: false, error: 'カテゴリが見つかりません' };
  if (category.store_id !== storeId) {
    return { success: false, error: '選択中の店舗と異なるカテゴリです' };
  }
  if (!category.is_active) {
    return { success: false, error: '無効化されたカテゴリは選択できません' };
  }
  return null;
}

export async function createSupplier(input: SupplierFormData): Promise<ActionResult> {
  const parsed = supplierFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  const categoryInvalid = await validateCategory(parsed.data.store_id, parsed.data.category_id);
  if (categoryInvalid) return categoryInvalid;

  const supabase = await createClient();

  // 税率未指定時は店舗標準（purchase_tax_rate_default）を適用
  let taxRate = parsed.data.tax_rate;
  if (taxRate === undefined) {
    const { data: st } = await supabase
      .from('stores')
      .select('purchase_tax_rate_default')
      .eq('id', parsed.data.store_id)
      .maybeSingle();
    taxRate = Number(st?.purchase_tax_rate_default ?? 0);
  }

  const { error } = await supabase.from('suppliers').insert({
    store_id: parsed.data.store_id,
    category_id: parsed.data.category_id,
    name: parsed.data.name,
    display_order: parsed.data.display_order,
    cost_type: parsed.data.cost_type,
    tax_rate: taxRate,
    is_tax_exempt: parsed.data.is_tax_exempt ?? false,
    is_active: true,
  });

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/suppliers');
  revalidatePath('/masters/categories');
  // 仕入入力画面から追加した場合に、その場で選択肢へ反映されるよう再検証
  revalidatePath('/daily-input/purchases');
  return { success: true };
}

/**
 * 同一店舗内の「似た名前の有効な仕入先」を返す（重複登録の確認用・読み取り専用）。
 * - 正規化（前後空白除去・連続空白圧縮・大小無視・全半角吸収）後の 完全一致／包含 で判定。
 * - 完全一致（同一表記）は既存 UNIQUE 制約で createSupplier 側がエラーにする（現状どおり）。
 * - ここは「ブロックせず人に確認を促す」ための候補列挙。RLS で参照可能店舗に限定。
 */
export async function findSimilarSuppliers(
  storeId: string,
  name: string,
): Promise<{ names: string[] }> {
  if (!name || !name.trim()) return { names: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from('suppliers')
    .select('name')
    .eq('store_id', storeId)
    .eq('is_active', true);
  const existing = (data ?? []).map((r) => r.name as string);
  return { names: findSimilarNames(name, existing) };
}

export async function updateSupplier(
  id: string,
  input: SupplierFormData,
): Promise<ActionResult> {
  const parsed = supplierFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  const categoryInvalid = await validateCategory(parsed.data.store_id, parsed.data.category_id);
  if (categoryInvalid) return categoryInvalid;

  const supabase = await createClient();
  const updates: Database['public']['Tables']['suppliers']['Update'] = {
    category_id: parsed.data.category_id,
    name: parsed.data.name,
    display_order: parsed.data.display_order,
    cost_type: parsed.data.cost_type,
  };
  // 税率・非課税は指定されたときのみ更新（未指定は据え置き）
  if (parsed.data.tax_rate !== undefined) updates.tax_rate = parsed.data.tax_rate;
  if (parsed.data.is_tax_exempt !== undefined) updates.is_tax_exempt = parsed.data.is_tax_exempt;

  const { error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)
    .eq('store_id', parsed.data.store_id);

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/suppliers');
  revalidatePath('/masters/categories');
  revalidatePath('/daily-input/purchases');
  return { success: true };
}

export async function setSupplierActive(
  id: string,
  storeId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const denied = await ensureCanWriteForStore(storeId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('store_id', storeId);

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/suppliers');
  revalidatePath('/masters/categories');
  return { success: true };
}

/**
 * 並び替え一括更新。orderedIds の順番に display_order = idx + 1 を割当。
 */
export async function reorderSuppliers(
  storeId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const denied = await ensureCanWriteForStore(storeId);
  if (denied) return denied;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: false, error: '並び順が空です' };
  }

  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from('suppliers')
        .update({ display_order: idx + 1 })
        .eq('id', id)
        .eq('store_id', storeId),
    ),
  );

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { success: false, error: translateDbError(firstError) };

  revalidatePath('/masters/suppliers');
  return { success: true };
}

/**
 * 指定仕入先の取引履歴（daily_purchases）件数を取得。
 * 無効化前の警告等、UI から明示的にチェックしたい場合に使用。
 * 仕入額ゼロ（amount=0・空欄保存）の行は「取引」に数えない（amount>0 のみ）。
 */
export async function getSupplierTransactionCount(
  supplierId: string,
  storeId: string,
): Promise<CountResult> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('daily_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('store_id', storeId)
    .gt('amount', 0);

  if (error) return { success: false, error: `取引件数の取得に失敗しました: ${error.message}` };
  return { success: true, count: count ?? 0 };
}
