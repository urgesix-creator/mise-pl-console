'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import type { DailyDepartmentSale } from '@/types/database';

// ====================================================================
// 部門別売上（参考データ）の保存 Server Action
//
// - daily_department_sales（参考データ）専用。**daily_sales（経営売上）には一切触れない**。
// - 経営売上の保存とは完全に独立した経路。本 Action の成否は daily_sales に影響しない。
// - 税込売上のみ。税計算・tax_base には一切関与しない。
// - 入力は任意：gross_sales が未入力（null/空）の部門は保存しない（スキップ）。
// - UPSERT：UNIQUE (store_id, business_date, department_id) で上書き。
// ====================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/** 1部門ぶんの入力 */
const departmentEntrySchema = z.object({
  department_id: z.string().uuid('部門IDが不正です'),
  // 任意入力。null/undefined のときは保存をスキップする
  gross_sales: z
    .number({ invalid_type_error: '税込売上を数値で入力してください' })
    .nonnegative('税込売上は0以上で入力してください')
    .max(1_000_000_000_000, '税込売上の上限を超えています')
    .nullable()
    .optional(),
  notes: z.string().max(500, '備考は500文字以内で入力してください').nullable().optional(),
});

const upsertDepartmentSalesSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  business_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '営業日は YYYY-MM-DD 形式で指定してください'),
  entries: z.array(departmentEntrySchema),
});

export type UpsertDailyDepartmentSalesInput = z.infer<typeof upsertDepartmentSalesSchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23503') return '参照先の部門または店舗が見つかりません';
  if (error.code === '23514') return '入力値が制約に違反しています';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

/**
 * 部門別売上の書き込み可否をサーバー側で事前検証（最終防衛線は RLS）。
 * 権限は daily_sales と同一（売上を入力できる人＝staff も可）。
 */
async function ensureCanWriteForStore(
  storeId: string,
): Promise<{ success: false; error: string } | null> {
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
  if (!(await roleHasCapability(supabase, profile.role, 'daily_input'))) {
    return { success: false, error: '入力権限がありません' };
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, country_id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return { success: false, error: '店舗が見つかりません' };
  if (!store.is_active) return { success: false, error: 'この店舗は無効化されています' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { success: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager' || profile.role === 'staff') {
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

/**
 * 部門別売上（参考データ）を UPSERT 保存する。
 *
 * - gross_sales が null/未入力の部門はスキップ（任意入力）。
 * - 入力対象の department_id が当該店舗の部門であることを検証（他店部門の混入防止）。
 * - daily_sales（経営売上）には一切アクセスしない。
 *
 * @returns 保存件数（data.saved）。保存対象が0件でも success: true。
 */
export async function upsertDailyDepartmentSales(
  input: UpsertDailyDepartmentSalesInput,
): Promise<ActionResult<{ saved: number }>> {
  const parsed = upsertDepartmentSalesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  const supabase = await createClient();

  // 当該店舗に属する部門IDの集合を取得（他店・存在しない部門の混入を防ぐ）
  const { data: departments, error: deptError } = await supabase
    .from('sales_departments')
    .select('id')
    .eq('store_id', parsed.data.store_id);
  if (deptError) return { success: false, error: translateDbError(deptError) };
  const validDepartmentIds = new Set((departments ?? []).map((d) => d.id));

  // gross_sales が入力されている部門のみを保存対象にする（任意入力 → 空はスキップ）
  const rows: Array<
    Pick<DailyDepartmentSale, 'store_id' | 'business_date' | 'department_id' | 'gross_sales' | 'notes'>
  > = [];
  for (const entry of parsed.data.entries) {
    if (entry.gross_sales === null || entry.gross_sales === undefined) continue; // 空はスキップ
    if (!validDepartmentIds.has(entry.department_id)) {
      return { success: false, error: 'この店舗に属さない部門が含まれています' };
    }
    rows.push({
      store_id: parsed.data.store_id,
      business_date: parsed.data.business_date,
      department_id: entry.department_id,
      gross_sales: entry.gross_sales,
      notes: entry.notes ?? null,
    });
  }

  // 保存対象なし（全部門が空欄）でも成功扱い。経営売上保存をブロックしない。
  if (rows.length === 0) {
    return { success: true, data: { saved: 0 } };
  }

  const { error: upsertError } = await supabase
    .from('daily_department_sales')
    .upsert(rows, { onConflict: 'store_id,business_date,department_id' });

  if (upsertError) return { success: false, error: translateDbError(upsertError) };

  revalidatePath('/daily-input/sales');
  return { success: true, data: { saved: rows.length } };
}
