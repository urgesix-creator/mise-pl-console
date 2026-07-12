import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api/keys';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-fA-F-]{36}$/;

/**
 * GET /api/v1/daily-purchases?store=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   日次仕入（仕入先名・原価区分つき）を取得する（読み取り）。
 *   cost_type: 'cogs'=売上原価 / 'sga'=販管費。
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, 'read');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const store = url.searchParams.get('store') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!UUID.test(store)) return NextResponse.json({ error: 'store（店舗UUID）が必要です' }, { status: 400 });
  if (!DATE.test(from) || !DATE.test(to)) {
    return NextResponse.json({ error: 'from / to は YYYY-MM-DD 形式で指定してください' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('daily_purchases')
    .select('supplier_id, business_date, amount')
    .eq('store_id', store)
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const supplierIds = [...new Set((rows ?? []).map((r) => r.supplier_id))];
  const supplierById = new Map<string, { name: string; cost_type: string }>();
  if (supplierIds.length > 0) {
    const { data: sups } = await admin
      .from('suppliers')
      .select('id, name, cost_type')
      .in('id', supplierIds);
    for (const s of sups ?? []) supplierById.set(s.id, { name: s.name, cost_type: s.cost_type });
  }

  const data = (rows ?? []).map((r) => {
    const sup = supplierById.get(r.supplier_id);
    return {
      business_date: r.business_date,
      amount: Number(r.amount),
      supplier: sup?.name ?? null,
      cost_type: sup?.cost_type ?? null,
    };
  });

  return NextResponse.json({ data });
}
