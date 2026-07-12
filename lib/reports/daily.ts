// ====================================================================
// 日報メッセージ生成（指定日・全店）— Slack 配信用
//   既存の lib/slack/templates.ts（buildDailyReportMessage）と
//   集計（sumBetween）・円換算（convertToJpy）・達成率（calcAchievementPct）を再利用。
//   読み取りのみ。
// ====================================================================

import type { createClient } from '@/lib/supabase/server';
import { sumBetween } from '@/lib/pl/queries';
import { convertToJpy, calcAchievementPct } from '@/lib/business';
import { buildDailyReportMessage, type StoreReport } from '@/lib/slack/templates';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 指定日（YYYY-MM-DD）の日報メッセージ（Slack Block Kit）を組み立てる。
 * 店舗が無ければ null。
 */
export async function buildDailyReportMessageForDate(
  supabase: SupabaseServerClient,
  dateISO: string,
): Promise<object | null> {
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, country_id, currency_id')
    .eq('is_active', true)
    .order('store_no');
  if (!stores || stores.length === 0) return null;

  const [countriesRes, currenciesRes, ratesRes] = await Promise.all([
    supabase.from('countries').select('id, flag'),
    supabase.from('currencies').select('id, symbol'),
    supabase
      .from('exchange_rates')
      .select('from_currency_id, to_currency_id, rate')
      .eq('to_currency_id', 'jpy')
      .eq('is_active', true),
  ]);
  const flagById = new Map((countriesRes.data ?? []).map((c) => [c.id, c.flag ?? '']));
  const symbolById = new Map((currenciesRes.data ?? []).map((c) => [c.id, c.symbol]));
  const rates = (ratesRes.data ?? []) as { from_currency_id: string; to_currency_id: string; rate: number }[];

  const monthStart = `${dateISO.slice(0, 8)}01`; // YYYY-MM-01

  let totalNetSalesJpy = 0;
  let totalCustomers = 0;
  let mtdNetJpy = 0;
  let mtdBudgetJpy = 0;
  const storeReports: StoreReport[] = [];

  for (const s of stores) {
    const { data: row } = await supabase
      .from('daily_sales')
      .select('net_sales, gross_sales, customer_count, weather, event_note')
      .eq('store_id', s.id)
      .eq('business_date', dateISO)
      .eq('day_period', 'all')
      .maybeSingle();

    const net = Number(row?.net_sales ?? 0);
    const gross = Number(row?.gross_sales ?? 0);
    const customers = Number(row?.customer_count ?? 0);
    const budget = await sumBetween(
      supabase,
      'daily_targets',
      'target_sales',
      s.id,
      'target_date',
      dateISO,
      dateISO,
    );
    const netJpy = convertToJpy(net, s.currency_id, rates) ?? 0;

    storeReports.push({
      storeName: s.name,
      countryFlag: flagById.get(s.country_id) ?? '',
      currencySymbol: symbolById.get(s.currency_id) ?? s.currency_id.toUpperCase(),
      grossSales: gross,
      netSalesJpy: netJpy,
      customerCount: customers,
      achievementPct: calcAchievementPct(net, budget),
      weather: row?.weather ?? null,
      eventNote: row && !row.net_sales && !row.gross_sales && !row.customer_count ? null : (row?.event_note ?? null),
    });

    totalNetSalesJpy += netJpy;
    totalCustomers += customers;

    const mtdNet = await sumBetween(supabase, 'daily_sales', 'net_sales', s.id, 'business_date', monthStart, dateISO, { day_period: 'all' });
    const mtdBudget = await sumBetween(supabase, 'daily_targets', 'target_sales', s.id, 'target_date', monthStart, dateISO);
    mtdNetJpy += convertToJpy(mtdNet, s.currency_id, rates) ?? 0;
    mtdBudgetJpy += convertToJpy(mtdBudget, s.currency_id, rates) ?? 0;
  }

  const monthAchievementPct = mtdBudgetJpy > 0 ? Math.round((mtdNetJpy / mtdBudgetJpy) * 1000) / 10 : null;

  return buildDailyReportMessage({
    date: dateISO,
    stores: storeReports,
    totalNetSalesJpy,
    totalCustomers,
    monthAchievementPct,
  });
}

/** Slack Webhook URL を取得（system_settings 優先・無ければ env） */
export async function getSlackWebhookUrl(supabase: SupabaseServerClient): Promise<string | null> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'slack_webhook_url')
    .maybeSingle();
  const fromSettings = typeof data?.value === 'string' ? data.value : null;
  return fromSettings || process.env.SLACK_WEBHOOK_URL || null;
}
