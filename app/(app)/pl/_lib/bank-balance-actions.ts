'use server';

// ====================================================================
// 月次PL：通帳残高の即時保存 Server Action（monthly_bank_balances へ UPSERT）
//
//   - 月次PL画面（/pl）の指標欄（客単価の下）から、各月の通帳残高を即時保存する。
//   - 書込先は monthly_bank_balances のみ（040で作成）。PL/税計算・他テーブルには触れない。
//   - 権限：can_write（店長・スタッフ含む）＝040のRLSに従う。サーバ側で再チェック＋店舗スコープ。
//   - year_month は月初DATE（'YYYY-MM-01'）。balance は現地通貨（負値も許容・桁は NUMERIC(16,2)）。
// ====================================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';

type ActionResult = { success: true } | { success: false; error: string };

const setBankBalanceSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  // 月初DATE 'YYYY-MM-01'
  year_month: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, '対象月は月初日（YYYY-MM-01）で指定してください'),
  balance: z
    .number({ invalid_type_error: '通帳残高を数値で入力してください' })
    .finite('通帳残高を数値で入力してください')
    // NUMERIC(16,2) に収まる範囲（小数2桁・整数部14桁まで）
    .min(-99_999_999_999_999.99, '金額が大きすぎます')
    .max(99_999_999_999_999.99, '金額が大きすぎます'),
});

export type SetBankBalanceInput = z.infer<typeof setBankBalanceSchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23514') return '入力値が範囲外です';
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
    return { ok: false, error: '通帳残高の入力権限がありません' };
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
 * 指定店舗・対象月の通帳残高を UPSERT 上書きする（即時保存）。
 * onConflict (store_id, year_month)。DELETE はしない。
 */
export async function setBankBalance(input: SetBankBalanceInput): Promise<ActionResult> {
  const parsed = setBankBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureCanWriteForStore(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase.from('monthly_bank_balances').upsert(
    {
      store_id: parsed.data.store_id,
      year_month: parsed.data.year_month,
      balance: parsed.data.balance,
    },
    { onConflict: 'store_id,year_month' },
  );
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/pl');
  return { success: true };
}
