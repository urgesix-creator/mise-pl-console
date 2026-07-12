import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncPreviousMonthEndRates } from '@/lib/exchange/sync';

export const dynamic = 'force-dynamic';

/**
 * GET /api/exchange-rates/sync — 前月末の対JPYレートを取得して反映（Vercel Cron 0 0 1 * * = 毎月1日 JST 9:00）。
 * CRON_SECRET を設定していれば Authorization: Bearer <CRON_SECRET> を要求。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const result = await syncPreviousMonthEndRates(admin);

  void admin
    .from('audit_logs')
    .insert({
      actor_id: null,
      actor_email: 'cron',
      action: 'exchange_rate.auto_sync',
      target_type: 'exchange_rates',
      target_label: result.effectiveDate,
      details: { updated: result.updated.length, skipped: result.skipped.length },
    })
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json({ ok: true, ...result });
}
