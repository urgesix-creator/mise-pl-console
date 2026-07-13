'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight, Settings as SettingsIcon, Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSlackWebhook, sendTestDailyReport } from '../actions';

export type AdminLink = { href: string; label: string; desc: string };

export function SettingsClient({
  slackWebhookUrl,
  adminLinks,
  canManageSystem,
}: {
  slackWebhookUrl: string;
  adminLinks: AdminLink[];
  canManageSystem: boolean;
}) {
  const [url, setUrl] = useState(slackWebhookUrl);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const save = () => {
    startSave(async () => {
      const res = await saveSlackWebhook(url);
      if (res.success) toast.success('保存しました');
      else toast.error(res.error);
    });
  };

  const test = () => {
    startTest(async () => {
      const res = await sendTestDailyReport();
      if (res.success) toast.success('テスト日報を Slack に送信しました');
      else toast.error(res.error);
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-2xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">システム設定</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <SettingsIcon className="w-7 h-7 text-slate-700" />
          システム設定
        </h1>
        <p className="text-sm text-slate-600">Slack通知（日報）などのシステム設定を管理します。</p>
      </div>

      {/* 管理メニュー（アクセスできるものだけ表示） */}
      {adminLinks.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">管理メニュー</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adminLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group rounded-xl border border-slate-200 bg-white px-4 py-3.5 flex items-center justify-between hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <span>
                  <span className="block text-sm font-medium text-slate-900">{l.label}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{l.desc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Slack 通知 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-slate-600" />
          <h2 className="font-display text-base font-bold text-slate-900">Slack 日報通知</h2>
        </div>
        <p className="text-[12px] text-slate-500 mb-4">
          毎朝（JST 9:00・Vercel Cron）、前日の店舗別売上サマリを Slack に自動配信します。Incoming Webhook の URL を設定してください。
        </p>

        <div className="space-y-1.5 mb-4">
          <Label htmlFor="slack">Slack Webhook URL</Label>
          <Input
            id="slack"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/XXX/YYY/ZZZ"
            className="font-num text-xs"
          />
          <p className="text-[11px] text-slate-500">空にすると配信を停止します。</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            保存
          </Button>
          <Button variant="outline" onClick={test} disabled={testing || url.trim() === ''}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            テスト送信（前日分）
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-amber-600">
          ※「テスト送信」は実際に Slack へ送信されます。先に「保存」してからお試しください。
        </p>
      </div>

      <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· 自動配信（cron）は本番デプロイ（Vercel）時に有効になります。配信先は <code>/api/reports/daily</code>。</p>
        <p>· cron を保護する場合、環境変数 <code>CRON_SECRET</code> を設定してください（未設定でも動作します）。</p>
        <p>· Slack 側の準備：ワークスペースで Incoming Webhook を作成し、発行された URL を上に貼り付けます。</p>
      </div>
    </div>
  );
}
