'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import {
  QUOTE_CURRENCY_ID,
  STALE_THRESHOLD_DAYS,
  currencyFormSchema,
  rateFormSchema,
  type CurrencyFormData,
  type RateFormData,
} from './_schemas';

type ActionResult = { success: true } | { success: false; error: string };

async function ensureWritePermission(): Promise<ActionResult | null> {
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
  if (!(await roleHasCapability(supabase, profile.role, 'accounting_master'))) {
    return {
      success: false,
      error: '為替レート・通貨マスタの編集権限がありません',
    };
  }
  return null;
}

async function ensureAuthenticated(): Promise<ActionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };
  return null;
}

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'この組み合わせは既に登録されています';
  if (error.code === '23503') return '参照先のレコードが見つかりません';
  if (error.code === '23514') return '入力値が制約に違反しています';
  return `処理に失敗しました: ${error.message}`;
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.floor((todayUtc - d) / (1000 * 60 * 60 * 24));
}

export type StaleRateRow = {
  id: string;
  from_currency_id: string;
  to_currency_id: string;
  from_code: string;
  to_code: string;
  rate: number;
  effective_date: string;
  days_since_effective: number;
};

// ========================================================================
// 為替レート（UPSERT）
// ========================================================================

/**
 * 通貨ペアのレートを UPSERT。同一 (from, to) は上書き。
 * UI 側で「過去データも遡って再計算されます」警告を表示済みである前提。
 */
export async function upsertExchangeRate(input: RateFormData): Promise<ActionResult> {
  const parsed = rateFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  if (parsed.data.from_currency_id === parsed.data.to_currency_id) {
    return { success: false, error: '元通貨と換算先通貨は別々の通貨を選んでください' };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { error } = await supabase
    .from('exchange_rates')
    .upsert(
      {
        from_currency_id: parsed.data.from_currency_id,
        to_currency_id: parsed.data.to_currency_id,
        rate: parsed.data.rate,
        effective_date: parsed.data.effective_date,
        notes: parsed.data.notes ?? null,
        is_active: true,
      },
      { onConflict: 'from_currency_id,to_currency_id' },
    );

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  revalidatePath('/dashboard');
  return { success: true };
}

// ========================================================================
// 為替レート（無効化・再有効化）
// ========================================================================

export async function deactivateExchangeRate(id: string): Promise<ActionResult> {
  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('exchange_rates')
    .update({ is_active: false })
    .eq('id', id);
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function reactivateExchangeRate(id: string): Promise<ActionResult> {
  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('exchange_rates')
    .update({ is_active: true })
    .eq('id', id);
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * 為替レートを物理削除（既存挙動を維持）。
 * 通常は deactivate を推奨。
 */
export async function deleteExchangeRate(id: string): Promise<ActionResult> {
  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from('exchange_rates').delete().eq('id', id);
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  revalidatePath('/dashboard');
  return { success: true };
}

// ========================================================================
// stale レート取得
// ========================================================================

export async function getStaleRates(
  daysThreshold: number = STALE_THRESHOLD_DAYS,
): Promise<StaleRateRow[]> {
  const denied = await ensureAuthenticated();
  if (denied) return [];

  const supabase = await createClient();
  const { data: rates } = await supabase
    .from('exchange_rates')
    .select('id, from_currency_id, to_currency_id, rate, effective_date, is_active')
    .eq('is_active', true)
    .eq('to_currency_id', QUOTE_CURRENCY_ID);
  if (!rates) return [];

  const { data: currencies } = await supabase.from('currencies').select('id, code');
  const codeById = new Map((currencies ?? []).map((c) => [c.id, c.code]));

  const result: StaleRateRow[] = [];
  for (const r of rates) {
    const days = daysSince(r.effective_date);
    if (days <= daysThreshold) continue;
    result.push({
      id: r.id,
      from_currency_id: r.from_currency_id,
      to_currency_id: r.to_currency_id,
      from_code: codeById.get(r.from_currency_id) ?? r.from_currency_id.toUpperCase(),
      to_code: codeById.get(r.to_currency_id) ?? r.to_currency_id.toUpperCase(),
      rate: r.rate,
      effective_date: r.effective_date,
      days_since_effective: days,
    });
  }
  result.sort((a, b) => b.days_since_effective - a.days_since_effective);
  return result;
}

export async function getStaleRatesCount(
  daysThreshold: number = STALE_THRESHOLD_DAYS,
): Promise<number> {
  const rows = await getStaleRates(daysThreshold);
  return rows.length;
}

// ========================================================================
// 通貨マスタ
// ========================================================================

export async function createCurrency(input: CurrencyFormData): Promise<ActionResult> {
  const parsed = currencyFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('currencies')
    .select('id')
    .or(`id.eq.${parsed.data.id},code.eq.${parsed.data.code}`)
    .maybeSingle();
  if (existing) {
    return { success: false, error: 'この通貨IDまたはコードは既に登録されています' };
  }

  const { error } = await supabase.from('currencies').insert({
    id: parsed.data.id,
    code: parsed.data.code,
    symbol: parsed.data.symbol,
    name: parsed.data.name,
    display_order: parsed.data.display_order,
  });

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  return { success: true };
}

export async function updateCurrency(
  id: string,
  input: CurrencyFormData,
): Promise<ActionResult> {
  const parsed = currencyFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  if (parsed.data.id !== id) {
    return { success: false, error: '通貨IDは作成後に変更できません' };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { error } = await supabase
    .from('currencies')
    .update({
      code: parsed.data.code,
      symbol: parsed.data.symbol,
      name: parsed.data.name,
      display_order: parsed.data.display_order,
    })
    .eq('id', id);

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  return { success: true };
}

/**
 * 通貨を削除。店舗で使用中、または為替レートで参照されている場合は不可。
 */
export async function deleteCurrency(id: string): Promise<ActionResult> {
  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const [storeUsage, rateUsage] = await Promise.all([
    supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('currency_id', id),
    supabase
      .from('exchange_rates')
      .select('id', { count: 'exact', head: true })
      .or(`from_currency_id.eq.${id},to_currency_id.eq.${id}`),
  ]);

  if ((storeUsage.count ?? 0) > 0) {
    return {
      success: false,
      error:
        'この通貨を使用中の店舗があるため削除できません。先に店舗マスタで通貨を変更してください。',
    };
  }
  if ((rateUsage.count ?? 0) > 0) {
    return {
      success: false,
      error:
        'この通貨を参照する為替レートが残っているため削除できません。先にレコードを削除してください。',
    };
  }

  const { error } = await supabase.from('currencies').delete().eq('id', id);
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/masters/exchange-rates');
  return { success: true };
}
