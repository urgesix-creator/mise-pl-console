'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';

const storeFormSchema = z.object({
  name: z.string().trim().min(1, '店舗名を入力してください').max(100, '店舗名は100文字以内で入力してください'),
  country_id: z.string().min(1, '国を選択してください'),
  currency_id: z.string().min(1, '通貨を選択してください'),
  timezone: z.string().min(1, 'タイムゾーンを選択してください'),
  service_fee_rate: z
    .number({ invalid_type_error: 'サービス料率を数値で入力してください' })
    .min(0, 'サービス料率は0以上で入力してください')
    .max(1, 'サービス料率は100%以下で入力してください'),
  employee_rebate_rate: z
    .number({ invalid_type_error: '社員還付金率を数値で入力してください' })
    .min(0, '社員還付金率は0以上で入力してください')
    .max(1, '社員還付金率は100%以下で入力してください'),
  fiscal_year_start_month: z
    .number({ invalid_type_error: '期首月を選択してください' })
    .int('期首月は整数で入力してください')
    .min(1, '期首月は1〜12で指定してください')
    .max(12, '期首月は1〜12で指定してください'),
  is_weather_enabled: z.boolean(),
  is_event_enabled: z.boolean(),
  established_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '設立日は YYYY-MM-DD 形式で入力してください')
    .nullable()
    .optional(),
  display_order: z.number().int().min(0).default(0),
});

type StoreFormData = z.infer<typeof storeFormSchema>;

type ActionResult = { success: true } | { success: false; error: string };

async function ensureExecutive(): Promise<{ success: false; error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) return { success: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'exec_master'))) {
    return { success: false, error: '権限がありません' };
  }
  return null;
}

export async function createStore(
  data: StoreFormData,
  sourceStoreId?: string | null,
): Promise<ActionResult> {
  const denied = await ensureExecutive();
  if (denied) return denied;

  const parsed = storeFormSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const supabase = await createClient();

  // 採番＋店舗作成＋（任意）設定コピーを RPC で1トランザクション実行（途中失敗は全ロールバック）。
  const { error } = await supabase.rpc('create_store_with_copy', {
    payload: {
      name: parsed.data.name,
      country_id: parsed.data.country_id,
      currency_id: parsed.data.currency_id,
      timezone: parsed.data.timezone,
      service_fee_rate: parsed.data.service_fee_rate,
      employee_rebate_rate: parsed.data.employee_rebate_rate,
      fiscal_year_start_month: parsed.data.fiscal_year_start_month,
      is_weather_enabled: parsed.data.is_weather_enabled,
      is_event_enabled: parsed.data.is_event_enabled,
      established_date: parsed.data.established_date ?? null,
      display_order: parsed.data.display_order,
    },
    source_store_id: sourceStoreId ?? null,
  });

  if (error) return { success: false, error: `保存に失敗しました: ${error.message}` };

  revalidatePath('/masters/stores');
  revalidatePath('/dashboard');
  return { success: true };
}

export type CopyPreview = {
  purchase_categories: number;
  suppliers: number;
  sales_departments: number;
  expense_formulas: number;
  monthly_expense_frames: number;
};

type CopyPreviewResult =
  | { success: true; preview: CopyPreview }
  | { success: false; error: string };

// コピー元店舗で複製される件数の概算（ダイアログの注記用）。
// is_active=true を対象に集計（販管費は distinct account_name の数）。
export async function getStoreCopyPreview(sourceStoreId: string): Promise<CopyPreviewResult> {
  const denied = await ensureExecutive();
  if (denied) return denied;

  const supabase = await createClient();

  const [cat, sup, dep, formula, expenseRows] = await Promise.all([
    supabase
      .from('purchase_categories')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', sourceStoreId)
      .eq('is_active', true),
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', sourceStoreId)
      .eq('is_active', true),
    supabase
      .from('sales_departments')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', sourceStoreId)
      .eq('is_active', true),
    supabase
      .from('expense_formulas')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', sourceStoreId),
    supabase.from('monthly_expenses').select('account_name').eq('store_id', sourceStoreId),
  ]);

  const distinctAccounts = new Set((expenseRows.data ?? []).map((r) => r.account_name));

  return {
    success: true,
    preview: {
      purchase_categories: cat.count ?? 0,
      suppliers: sup.count ?? 0,
      sales_departments: dep.count ?? 0,
      expense_formulas: formula.count ?? 0,
      monthly_expense_frames: distinctAccounts.size,
    },
  };
}

export async function updateStore(id: string, data: StoreFormData): Promise<ActionResult> {
  const denied = await ensureExecutive();
  if (denied) return denied;

  const parsed = storeFormSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('stores')
    .update({
      name: parsed.data.name,
      country_id: parsed.data.country_id,
      currency_id: parsed.data.currency_id,
      timezone: parsed.data.timezone,
      service_fee_rate: parsed.data.service_fee_rate,
      employee_rebate_rate: parsed.data.employee_rebate_rate,
      fiscal_year_start_month: parsed.data.fiscal_year_start_month,
      is_weather_enabled: parsed.data.is_weather_enabled,
      is_event_enabled: parsed.data.is_event_enabled,
      established_date: parsed.data.established_date ?? null,
      display_order: parsed.data.display_order,
    })
    .eq('id', id);

  if (error) return { success: false, error: `更新に失敗しました: ${error.message}` };

  revalidatePath('/masters/stores');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function setStoreActive(id: string, isActive: boolean): Promise<ActionResult> {
  const denied = await ensureExecutive();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('stores')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { success: false, error: `処理に失敗しました: ${error.message}` };

  revalidatePath('/masters/stores');
  revalidatePath('/dashboard');
  return { success: true };
}
