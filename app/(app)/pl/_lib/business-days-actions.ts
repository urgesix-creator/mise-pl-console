'use server';

// ====================================================================
// 月次PL：営業日数の即時保存 Server Action（monthly_business_days へ UPSERT）
//
//   - 月次PL画面（/pl）から、各月の営業日数を即時保存する（保存ボタンなし）。
//   - 書込先は monthly_business_days のみ（013で作成済み・DB構造は変更しない）。
//   - 権限：can_write（店長以上・staff含む）＝013のRLSに従う。サーバ側で再チェック＋店舗スコープ。
//   - year_month は月初DATE（'YYYY-MM-01'）。business_days は 1〜31 の整数（CHECKに準拠）。
//   - PL集計lib・税計算・他テーブルには触れない。
// ====================================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';

type ActionResult = { success: true } | { success: false; error: string };

const setBusinessDaysSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  // 月初DATE 'YYYY-MM-01'
  year_month: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, '対象月は月初日（YYYY-MM-01）で指定してください'),
  business_days: z
    .number({ invalid_type_error: '営業日数を数値で入力してください' })
    .int('営業日数は整数で入力してください')
    .min(1, '営業日数は1〜31で入力してください')
    .max(31, '営業日数は1〜31で入力してください'),
});

export type SetBusinessDaysInput = z.infer<typeof setBusinessDaysSchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23514') return '営業日数は1〜31で入力してください';
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
    return { ok: false, error: '営業日数の入力権限がありません' };
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

/**
 * 指定店舗・対象月の営業日数を UPSERT 上書きする（即時保存）。
 * onConflict (store_id, year_month)。DELETE はしない。
 */
export async function setBusinessDays(input: SetBusinessDaysInput): Promise<ActionResult> {
  const parsed = setBusinessDaysSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase.from('monthly_business_days').upsert(
    {
      store_id: parsed.data.store_id,
      year_month: parsed.data.year_month,
      business_days: parsed.data.business_days,
    },
    { onConflict: 'store_id,year_month' },
  );
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}
