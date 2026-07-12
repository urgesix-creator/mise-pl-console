import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { buildDailyReportMessageForDate, getSlackWebhookUrl } from '@/lib/reports/daily';
import { sendToSlack } from '@/lib/slack/templates';

export const dynamic = 'force-dynamic';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
/** 日本時間の「前日」 YYYY-MM-DD（朝9時=UTC0時に前日の結果を配信） */
function jstYesterday(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * GET /api/reports/daily — 前日の日報を Slack へ配信（Vercel Cron 0 0 * * * = JST 9:00）。
 * CRON_SECRET を設定している場合は Authorization: Bearer <CRON_SECRET> を要求する。
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
  const date = jstYesterday();

  const webhook = await getSlackWebhookUrl(admin);
  if (!webhook) {
    return NextResponse.json({ error: 'Slack Webhook URL が未設定です（/admin/settings で設定）' }, { status: 400 });
  }

  const message = await buildDailyReportMessageForDate(admin, date);
  if (!message) {
    return NextResponse.json({ ok: false, reason: 'no_stores', date }, { status: 200 });
  }

  try {
    await sendToSlack(webhook, message);
  } catch (e) {
    return NextResponse.json({ error: `Slack送信に失敗: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, date });
}
