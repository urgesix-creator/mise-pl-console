'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';

const categoryFormSchema = z.object({
  store_id: z.string().uuid('店舗を指定してください'),
  name: z
    .string()
    .trim()
    .min(1, 'カテゴリ名を入力してください')
    .max(50, 'カテゴリ名は50文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '表示順は数値で入力してください' })
    .int('表示順は整数で入力してください')
    .min(0, '表示順は0以上で入力してください'),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

type ActionResult = { success: true } | { success: false; error: string };

/**
 * 指定店舗のカテゴリに書き込み可能かをサーバー側で事前検証。
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
  if (error.code === '23505') return 'このカテゴリ名は既に存在します';
  return `処理に失敗しました: ${error.message}`;
}

export async function createCategory(input: CategoryFormData): Promise<ActionResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from('purchase_categories').insert({
    store_id: parsed.data.store_id,
    name: parsed.data.name,
    display_order: parsed.data.display_order,
    is_active: true,
  });

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/categories');
  return { success: true };
}

export async function updateCategory(
  id: string,
  input: CategoryFormData,
): Promise<ActionResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('purchase_categories')
    .update({
      name: parsed.data.name,
      display_order: parsed.data.display_order,
    })
    .eq('id', id)
    .eq('store_id', parsed.data.store_id);

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/categories');
  return { success: true };
}

export async function setCategoryActive(
  id: string,
  storeId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const denied = await ensureCanWriteForStore(storeId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('purchase_categories')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('store_id', storeId);

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/categories');
  return { success: true };
}

/**
 * 並び替え一括更新。orderedIds の順番に display_order = idx + 1 を割当。
 * 並列実行で店舗内の他カテゴリには触れない。
 */
export async function reorderCategories(
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
        .from('purchase_categories')
        .update({ display_order: idx + 1 })
        .eq('id', id)
        .eq('store_id', storeId),
    ),
  );

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { success: false, error: translateDbError(firstError) };

  revalidatePath('/masters/categories');
  return { success: true };
}
