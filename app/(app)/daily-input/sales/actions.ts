'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import {
  calculateSales,
  upsertDailySalesSchema,
  type DayPeriod,
  type TaxCategory,
  type UpsertDailySalesInput,
} from './_schemas';
import type { TaxBase } from '@/types/database';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type AccessibleStore = {
  id: string;
  name: string;
  country_id: string;
  currency_id: string;
  service_fee_rate: number;
  tax_rate: number;
  tax_base: TaxBase;
  tax_label: string;
  is_weather_enabled: boolean;
  is_event_enabled: boolean;
  /** 軽減税率（テイクアウト8%）を使う店舗か。true のとき税区分セレクタを表示 */
  has_takeout: boolean;
};

export type DailySalesRow = {
  id: string;
  store_id: string;
  business_date: string;
  day_period: DayPeriod;
  gross_sales: number;
  net_sales: number;
  service_fee: number;
  tax_amount: number;
  tax_category: TaxCategory;
  customer_count: number;
  weather: string | null;
  event_note: string | null;
  is_closed: boolean;
  is_holiday: boolean;
  holiday_name: string | null;
  created_at: string;
  updated_at: string;
};

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'この日付・時間帯のレコードは既に存在します';
  if (error.code === '23503') return '参照先のレコードが見つかりません';
  if (error.code === '23514') return '入力値が制約に違反しています';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, country_id, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return null;
  return profile;
}

/**
 * ログインユーザーがアクセス可能な店舗一覧を返す。
 * RLS が can_access_store(store_id) で絞ってくれるため、シンプルに stores から取得すれば良い。
 */
export async function getUserAccessibleStores(): Promise<AccessibleStore[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const [storesResult, countriesResult] = await Promise.all([
    supabase
      .from('stores')
      .select(
        'id, name, country_id, currency_id, service_fee_rate, is_weather_enabled, is_event_enabled, is_active, has_takeout',
      )
      .eq('is_active', true)
      .order('display_order'),
    supabase.from('countries').select('id, tax_rate, tax_base, tax_label'),
  ]);

  const stores = storesResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const countryById = new Map(countries.map((c) => [c.id, c]));

  return stores.map((s) => {
    const country = countryById.get(s.country_id);
    return {
      id: s.id,
      name: s.name,
      country_id: s.country_id,
      currency_id: s.currency_id,
      service_fee_rate: Number(s.service_fee_rate),
      tax_rate: Number(country?.tax_rate ?? 0),
      tax_base: country?.tax_base ?? 'net_sales',
      tax_label: country?.tax_label ?? '',
      is_weather_enabled: s.is_weather_enabled,
      is_event_enabled: s.is_event_enabled,
      has_takeout: !!s.has_takeout,
    };
  });
}

/**
 * 売上の「サービス料込み/別」入力モードを店舗単位で更新（全ユーザー/全端末で共有）。
 * 売上入力権限（daily_input）＋当該店舗アクセスを検証。stores 更新RLSは exec_master 想定のため
 * 権限・アクセス確認後に管理クライアントで該当列のみ更新。
 * ※ 既存の daily_sales 行は再計算しない（行ごとの service_fee_included で凍結）。
 */
export async function setSalesServiceFeeMode(
  storeId: string,
  mode: 'excluded' | 'included',
): Promise<ActionResult> {
  if (mode !== 'excluded' && mode !== 'included') {
    return { success: false, error: '入力モードが不正です' };
  }
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: '認証が必要です' };

  const supabase = await createClient();
  if (!(await roleHasCapability(supabase, profile.role, 'daily_input'))) {
    return { success: false, error: '売上入力の権限がありません' };
  }
  // 当該店舗にアクセスできるか（RLS 経由の読取で確認）
  const { data: store } = await supabase
    .from('stores')
    .select('id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return { success: false, error: '店舗が見つかりません' };
  if (!store.is_active) return { success: false, error: 'この店舗は無効化されています' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('stores')
    .update({ sales_service_fee_input_mode: mode })
    .eq('id', storeId);
  if (error) return { success: false, error: `入力モードの保存に失敗しました: ${error.message}` };

  revalidatePath('/daily-input/sales');
  return { success: true };
}

export async function getDailySalesByKey(
  storeId: string,
  businessDate: string,
  dayPeriod: DayPeriod,
): Promise<DailySalesRow | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_sales')
    .select('*')
    .eq('store_id', storeId)
    .eq('business_date', businessDate)
    .eq('day_period', dayPeriod)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    gross_sales: Number(data.gross_sales),
    net_sales: Number(data.net_sales),
    service_fee: Number(data.service_fee),
    tax_amount: Number(data.tax_amount),
    tax_category: (data.tax_category as TaxCategory) ?? 'standard',
    customer_count: Number(data.customer_count),
    day_period: data.day_period as DayPeriod,
  };
}

export async function upsertDailySales(
  input: UpsertDailySalesInput,
): Promise<ActionResult<DailySalesRow>> {
  const parsed = upsertDailySalesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: '認証が必要です' };

  const supabase = await createClient();
  if (!(await roleHasCapability(supabase, profile.role, 'daily_input'))) {
    return { success: false, error: '日次売上の入力権限がありません' };
  }

  // 店舗情報を取得（軽減税率の可否＝has_takeout をサーバ側で権威として読む）
  const { data: storeData, error: storeError } = await supabase
    .from('stores')
    .select('id, country_id, is_active, has_takeout')
    .eq('id', parsed.data.store_id)
    .maybeSingle();

  if (storeError || !storeData) {
    return { success: false, error: 'アクセス可能な店舗が見つかりません' };
  }
  if (!storeData.is_active) {
    return { success: false, error: 'この店舗は無効化されています' };
  }

  // 全店 day_period='all' 運用。受信した day_period は無視し、常に 'all' で保存する
  // （昼夜分離は廃止。is_lunch_dinner_split は参照しない）。

  // 店休日（is_closed=true）は売上0で保存する。サーバ側でも 0 を強制し、
  // net=0 を calculateSales に渡すことで tax_amount も自動的に 0 になる。
  const isClosed = parsed.data.is_closed ?? false;
  const netInput = isClosed ? 0 : parsed.data.net_sales;
  const grossInput = isClosed ? 0 : (parsed.data.gross_sales ?? 0);
  const customerInput = isClosed ? 0 : parsed.data.customer_count;

  // 税区分：店舗が軽減税率対応（has_takeout=true）のときだけクライアントの選択を採用。
  // 非対応店では常に標準税率（standard=10%）に強制する（クライアント値は信用しない）。
  const taxCategory: TaxCategory = storeData.has_takeout
    ? (parsed.data.tax_category ?? 'standard')
    : 'standard';

  // サーバー側で再計算（クライアント側の値は信用しない）。
  // net_sales（税抜）を主入力とし、消費税額を税区分の税率で順計算（整数円）。
  // service_fee は消費税制では常に0。gross_sales は独立入力（未入力なら net+tax）。
  const calc = calculateSales({
    netSales: netInput,
    grossSales: grossInput,
    taxCategory,
    customerCount: customerInput,
  });

  const { data: upserted, error: upsertError } = await supabase
    .from('daily_sales')
    .upsert(
      {
        store_id: parsed.data.store_id,
        business_date: parsed.data.business_date,
        day_period: 'all', // 全店 all 運用：受信値を無視して常に 'all' で保存
        net_sales: calc.net_sales, // 主入力（税抜）。店休日は0
        gross_sales: calc.gross_sales, // 独立入力（税込・未入力なら net+tax）。店休日は0
        service_fee: calc.service_fee, // 消費税制では常に0
        tax_amount: calc.tax_amount, // 消費税額（net×税率、整数円。net=0なら0）
        tax_category: taxCategory, // この行の税区分（standard=10% / reduced=8%）
        customer_count: customerInput, // 店休日は0
        weather: parsed.data.weather ?? null,
        event_note: parsed.data.event_note ?? null,
        is_closed: isClosed,
        is_holiday: parsed.data.is_holiday ?? false,
        holiday_name: parsed.data.holiday_name ?? null,
        service_fee_included: false, // 消費税制ではサービス料込みモードは使わない
      },
      { onConflict: 'store_id,business_date,day_period' },
    )
    .select('*')
    .single();

  if (upsertError) {
    return { success: false, error: translateDbError(upsertError) };
  }

  revalidatePath('/daily-input/sales');
  revalidatePath('/dashboard');

  return {
    success: true,
    data: {
      ...upserted,
      gross_sales: Number(upserted.gross_sales),
      net_sales: Number(upserted.net_sales),
      service_fee: Number(upserted.service_fee),
      tax_amount: Number(upserted.tax_amount),
      tax_category: (upserted.tax_category as TaxCategory) ?? 'standard',
      customer_count: Number(upserted.customer_count),
      day_period: upserted.day_period as DayPeriod,
    },
  };
}
