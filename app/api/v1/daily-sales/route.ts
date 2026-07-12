import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api/keys';
import { createAdminClient } from '@/lib/supabase/server';
import { calculateSales, upsertDailySalesSchema } from '@/app/(app)/daily-input/sales/_schemas';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-fA-F-]{36}$/;

/** GET /api/v1/daily-sales?store=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD — 日次売上の取得（読み取り） */
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
  const { data, error } = await admin
    .from('daily_sales')
    .select('store_id, business_date, day_period, net_sales, gross_sales, service_fee, tax_amount, customer_count, is_closed')
    .eq('store_id', store)
    .eq('day_period', 'all')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

/**
 * POST /api/v1/daily-sales — 日次売上の登録/更新（書き込み・read_write キー必須）
 * body: { store_id, business_date, net_sales, gross_sales?, customer_count, weather?, event_note?, is_closed? }
 * 税計算（§8.1）はサーバ側で再計算（calculateSales）。day_period は常に 'all'。
 */
export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req, 'read_write');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON ボディが不正です' }, { status: 400 });
  }

  const parsed = upsertDailySalesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: store } = await admin
    .from('stores')
    .select('id, country_id, is_active, has_takeout')
    .eq('id', parsed.data.store_id)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: '店舗が見つかりません' }, { status: 404 });
  if (!store.is_active) return NextResponse.json({ error: 'この店舗は無効化されています' }, { status: 409 });

  const isClosed = parsed.data.is_closed ?? false;
  const netInput = isClosed ? 0 : parsed.data.net_sales;
  const grossInput = isClosed ? 0 : (parsed.data.gross_sales ?? 0);
  const customerInput = isClosed ? 0 : parsed.data.customer_count;

  // 税区分：軽減税率対応店（has_takeout）のときだけ受信値を採用。非対応店は常に標準10%。
  const taxCategory = store.has_takeout ? (parsed.data.tax_category ?? 'standard') : 'standard';

  const calc = calculateSales({
    netSales: netInput,
    grossSales: grossInput,
    taxCategory,
    customerCount: customerInput,
  });

  const { data: upserted, error: upsertError } = await admin
    .from('daily_sales')
    .upsert(
      {
        store_id: parsed.data.store_id,
        business_date: parsed.data.business_date,
        day_period: 'all',
        net_sales: calc.net_sales,
        gross_sales: calc.gross_sales,
        service_fee: calc.service_fee,
        tax_amount: calc.tax_amount,
        tax_category: taxCategory,
        customer_count: customerInput,
        weather: parsed.data.weather ?? null,
        event_note: parsed.data.event_note ?? null,
        is_closed: isClosed,
      },
      { onConflict: 'store_id,business_date,day_period' },
    )
    .select('store_id, business_date, net_sales, gross_sales, service_fee, tax_amount, customer_count, is_closed')
    .single();
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // API 経由の書き込みを監査ログに記録（actor = APIキー）
  void admin
    .from('audit_logs')
    .insert({
      actor_id: null,
      actor_email: `api_key:${auth.keyId}`,
      action: 'api.write',
      target_type: 'daily_sales',
      target_label: `${parsed.data.store_id} / ${parsed.data.business_date}`,
      details: { net_sales: calc.net_sales },
    })
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json({ data: upserted });
}
