import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api/keys';
import { createAdminClient } from '@/lib/supabase/server';
import {
  aggregateStorePeriod,
  computeStorePeriodMetrics,
} from '@/lib/period-summary/aggregate';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/v1/period-summary?start=YYYY-MM-DD&end=YYYY-MM-DD — 店舗別 期間集計（読み取り・税抜） */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, 'read');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const start = url.searchParams.get('start') ?? '';
  const end = url.searchParams.get('end') ?? '';
  if (!DATE.test(start) || !DATE.test(end)) {
    return NextResponse.json({ error: 'start / end は YYYY-MM-DD 形式で指定してください' }, { status: 400 });
  }
  if (start > end) {
    return NextResponse.json({ error: 'start が end より後になっています' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: stores } = await admin
    .from('stores')
    .select('id, store_no, name, currency_id')
    .eq('is_active', true)
    .order('store_no');

  const rows = await Promise.all(
    (stores ?? []).map(async (s) => {
      const m = computeStorePeriodMetrics(await aggregateStorePeriod(admin, s.id, start, end));
      return {
        store_no: Number(s.store_no),
        name: s.name,
        currency: s.currency_id,
        net_sales: m.netSales,
        budget: m.budget,
        budget_pct: m.budgetPct,
        cogs: m.cogs,
        gross_profit: m.grossProfit,
        gross_margin_pct: m.grossMarginPct,
        margin_profit: m.marginProfit,
        margin_pct: m.marginPct,
        closing_inventory: m.closingInventory,
      };
    }),
  );

  return NextResponse.json({ period: { start, end }, data: rows });
}
