import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ExchangeRatesClient } from './_components/exchange-rates-client';
import type { CurrencyWithMeta, RatePairWithMeta, Role } from './_components/types';
import { QUOTE_CURRENCY_ID, STALE_THRESHOLD_DAYS } from './_schemas';

export const metadata = {
  title: '為替レート | Sales Console',
};

// 通貨マスタはマイグレーションで DB 直追加され得る（アプリ外で更新）。
// fetch Data Cache が古い通貨一覧を返さないよう、常に最新を取得する。
export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((todayUtc - d) / (1000 * 60 * 60 * 24));
}

export default async function ExchangeRatesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) redirect('/login');

  const includeInactive = searchParams?.includeInactive === '1';

  const [currenciesResult, ratesResult, storesResult] = await Promise.all([
    supabase.from('currencies').select('*').order('display_order'),
    supabase.from('exchange_rates').select('*'),
    supabase.from('stores').select('currency_id').eq('is_active', true),
  ]);

  const currencies = currenciesResult.data ?? [];
  const allRates = ratesResult.data ?? [];
  const stores = storesResult.data ?? [];

  // 「無効も表示」OFF のときは is_active=true のみ
  const rates = includeInactive ? allRates : allRates.filter((r) => r.is_active);

  const storeCurrencyIds = new Set(stores.map((s) => s.currency_id));

  const currencyById = new Map(currencies.map((c) => [c.id, c]));
  const jpy = currencyById.get(QUOTE_CURRENCY_ID);

  // 表示対象ペアを構築：
  //  1. 既存レコード全て（フィルタ後）
  //  2. 店舗使用通貨 → JPY のペアで未設定のもの
  const pairKeys = new Set<string>();
  const ratePairs: RatePairWithMeta[] = [];

  for (const r of rates) {
    const key = `${r.from_currency_id}|${r.to_currency_id}`;
    if (pairKeys.has(key)) continue;
    pairKeys.add(key);
    const from = currencyById.get(r.from_currency_id);
    const to = currencyById.get(r.to_currency_id);
    if (!from || !to) continue;

    const days = daysSince(r.effective_date);
    ratePairs.push({
      from_currency: from,
      to_currency: to,
      rate: r.rate,
      effective_date: r.effective_date,
      notes: r.notes,
      rate_id: r.id,
      days_since_effective: days,
      is_stale: r.is_active && days > STALE_THRESHOLD_DAYS,
      is_in_use_by_store:
        storeCurrencyIds.has(from.id) && to.id === QUOTE_CURRENCY_ID,
      is_active: r.is_active,
    });
  }

  if (jpy) {
    for (const storeCurrencyId of storeCurrencyIds) {
      if (storeCurrencyId === QUOTE_CURRENCY_ID) continue;
      const key = `${storeCurrencyId}|${QUOTE_CURRENCY_ID}`;
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      const from = currencyById.get(storeCurrencyId);
      if (!from) continue;
      ratePairs.push({
        from_currency: from,
        to_currency: jpy,
        rate: null,
        effective_date: null,
        notes: null,
        rate_id: null,
        days_since_effective: null,
        is_stale: false,
        is_in_use_by_store: true,
        is_active: null,
      });
    }
  }

  // 通貨マスタの使用状況を集計（全レコードベース、有効/無効問わず）
  const ratePairCountByCurrency: Record<string, number> = {};
  for (const r of allRates) {
    ratePairCountByCurrency[r.from_currency_id] =
      (ratePairCountByCurrency[r.from_currency_id] ?? 0) + 1;
    ratePairCountByCurrency[r.to_currency_id] =
      (ratePairCountByCurrency[r.to_currency_id] ?? 0) + 1;
  }

  const currenciesWithMeta: CurrencyWithMeta[] = currencies.map((c) => ({
    ...c,
    is_used_as_store_currency: storeCurrencyIds.has(c.id),
    rate_pair_count: ratePairCountByCurrency[c.id] ?? 0,
  }));

  // 警告バナー用：30 日超 active rate のサマリ
  const staleRates = ratePairs
    .filter((p) => p.is_stale && p.is_active === true && p.days_since_effective !== null)
    .sort(
      (a, b) =>
        (b.days_since_effective ?? 0) - (a.days_since_effective ?? 0),
    );

  return (
    <ExchangeRatesClient
      ratePairs={ratePairs}
      currencies={currenciesWithMeta}
      userRole={profile.role as Role}
      includeInactive={includeInactive}
      staleRates={staleRates}
    />
  );
}
