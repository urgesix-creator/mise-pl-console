import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api/keys';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/v1/stores — 店舗一覧（読み取り） */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, 'read');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('stores')
    .select('id, store_no, name, country_id, currency_id, is_active, fiscal_year_start_month')
    .order('store_no');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
