import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { DailySummaryClient, type DailyRow, type StoreLite } from './_components/daily-summary-client';

export const metadata = {
  title: '日別売上 | Sales Console',
};

export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

function pickString(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
/** 月（YYYY-MM）の初日・末日を返す */
function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  const start = `${y}-${pad(m)}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m は1始まり→翌月0日=当月末
  const end = `${y}-${pad(m)}-${pad(last)}`;
  return { start, end };
}

export default async function DailySummaryPage({
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
    .select('is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) redirect('/login');

  // アクセス可能店舗（daily_sales の RLS が範囲を担保）＋通貨記号
  const { data: storesData } = await supabase
    .from('stores')
    .select('id, name, currency_id')
    .eq('is_active', true)
    .order('display_order');
  const { data: currenciesData } = await supabase.from('currencies').select('id, symbol');
  const symbolById = new Map(
    (currenciesData ?? []).map((c) => [c.id as string, c.symbol as string]),
  );
  const stores: StoreLite[] = (storesData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    currency: symbolById.get(s.currency_id) ?? s.currency_id.toUpperCase(),
  }));

  const selectedStoreId = await resolveSelectedStoreId(pickString(searchParams?.store), stores);
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  // 対象月（?month=YYYY-MM、既定は当月・JST）
  const now = jstNow();
  const defaultMonth = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const rawMonth = pickString(searchParams?.month);
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : defaultMonth;

  let rows: DailyRow[] = [];
  if (selectedStoreId) {
    const { start, end } = monthRange(month);
    const { data } = await supabase
      .from('daily_sales')
      .select('business_date, net_sales, gross_sales, customer_count, is_closed')
      .eq('store_id', selectedStoreId)
      .eq('day_period', 'all')
      .gte('business_date', start)
      .lte('business_date', end)
      .order('business_date');
    rows = (data ?? []).map((r) => {
      const net = Number(r.net_sales ?? 0);
      const gross = Number(r.gross_sales ?? 0);
      const cust = Number(r.customer_count ?? 0);
      return {
        date: r.business_date as string,
        net,
        gross,
        customers: cust,
        avgNet: cust > 0 ? Math.round((net / cust) * 100) / 100 : null,
        isClosed: Boolean(r.is_closed),
      };
    });
  }

  return (
    <DailySummaryClient
      stores={stores}
      selectedStoreId={selectedStoreId}
      currency={selectedStore?.currency ?? ''}
      month={month}
      rows={rows}
    />
  );
}
