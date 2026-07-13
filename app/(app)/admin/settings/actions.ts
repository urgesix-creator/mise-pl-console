'use server';

// ====================================================================
// システム設定 Server Actions（exec_master 限定）
//   - Slack Webhook URL の保存（system_settings）。
//   - 日報のテスト送信（前日分を Slack へ）。※実際に Slack へ送信される。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/server';
import { buildDailyReportMessageForDate, getSlackWebhookUrl } from '@/lib/reports/daily';
import { sendToSlack } from '@/lib/slack/templates';

type Result = { success: true } | { success: false; error: string };

async function ensureExec(): Promise<{ success: false; error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { success: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'system_settings'))) {
    return { success: false, error: 'システム設定の権限がありません' };
  }
  return null;
}

/** Slack Webhook URL を保存（空文字でクリア可） */
export async function saveSlackWebhook(url: string): Promise<Result> {
  const denied = await ensureExec();
  if (denied) return denied;

  const trimmed = (url ?? '').trim();
  if (trimmed !== '' && !/^https:\/\/\S+$/.test(trimmed)) {
    return { success: false, error: 'https から始まる URL を入力してください' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('system_settings')
    .upsert(
      { key: 'slack_webhook_url', value: trimmed, description: 'Slack Webhook URL（日報・通知用）' },
      { onConflict: 'key' },
    );
  if (error) return { success: false, error: `保存に失敗しました: ${error.message}` };

  await logAudit({ action: 'settings.update', targetType: 'system_settings', targetLabel: 'slack_webhook_url' });
  revalidatePath('/admin/settings');
  return { success: true };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function jstYesterday(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 日報のテスト送信（前日分を Slack へ実送信） */
export async function sendTestDailyReport(): Promise<Result> {
  const denied = await ensureExec();
  if (denied) return denied;

  const supabase = await createClient();
  const webhook = await getSlackWebhookUrl(supabase);
  if (!webhook) return { success: false, error: 'Slack Webhook URL が未設定です' };

  const date = jstYesterday();
  const message = await buildDailyReportMessageForDate(supabase, date);
  if (!message) return { success: false, error: '対象店舗がありません' };

  try {
    await sendToSlack(webhook, message);
  } catch (e) {
    return { success: false, error: `Slack送信に失敗: ${e instanceof Error ? e.message : String(e)}` };
  }

  await logAudit({ action: 'report.test_send', targetType: 'daily_report', targetLabel: date });
  return { success: true };
}
