'use server';

// ====================================================================
// システム設定 Server Actions（exec_master 限定）
//   - Slack Webhook URL の保存（system_settings）。
//   - 日報のテスト送信（前日分を Slack へ）。※実際に Slack へ送信される。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/server';
import { buildDailyReportMessageForDate, getSlackWebhookUrl } from '@/lib/reports/daily';
import { sendToSlack } from '@/lib/slack/templates';
import { syncPreviousMonthEndRates } from '@/lib/exchange/sync';

type Result = { success: true } | { success: false; error: string };
type MessageResult = { success: true; message: string } | { success: false; error: string };

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

/** 前月末の為替レートを今すぐ取得して反映（手動トリガー・月次cronと同じ処理） */
export async function syncExchangeRatesNow(): Promise<MessageResult> {
  const denied = await ensureExec();
  if (denied) return denied;

  // 為替の書込は accounting_master 権限が必要なため admin 経由（system_settings 委任者でも実行可）
  const result = await syncPreviousMonthEndRates(createAdminClient());

  await logAudit({
    action: 'exchange_rate.auto_sync',
    targetType: 'exchange_rates',
    targetLabel: result.effectiveDate,
    details: { updated: result.updated.length, skipped: result.skipped.length },
  });
  revalidatePath('/masters/exchange-rates');
  revalidatePath('/dashboard');

  if (result.updated.length === 0) {
    return {
      success: false,
      error: `前月末(${result.effectiveDate})のレートを取得できませんでした（対象通貨が未対応の可能性）`,
    };
  }
  const detail = result.updated.map((u) => `${u.currency.toUpperCase()} ${u.rate}`).join(' / ');
  const skip = result.skipped.length ? `／対象外 ${result.skipped.map((s) => s.toUpperCase()).join(',')}` : '';
  return {
    success: true,
    message: `前月末(${result.effectiveDate})を反映：${detail}${skip}`,
  };
}
