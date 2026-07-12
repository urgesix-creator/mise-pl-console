import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMyPermissions } from '@/lib/permissions/server';
import type { Capability } from '@/lib/permissions/constants';
import { SettingsClient, type AdminLink } from './_components/settings-client';

const ADMIN_LINKS: { href: string; label: string; desc: string; capability: Capability }[] = [
  { href: '/admin/permissions', label: '権限設定', desc: 'ロール別のできることを設定', capability: 'exec_master' },
  { href: '/admin/users', label: 'ユーザー管理', desc: '招待・ロール付与・店舗割当', capability: 'user_management' },
  { href: '/admin/audit', label: '監査ログ', desc: '操作履歴の閲覧', capability: 'audit_log' },
  { href: '/admin/api-keys', label: 'APIキー', desc: '外部連携キーの発行・失効', capability: 'api_keys' },
];

export const metadata = {
  title: 'システム設定 | みせPL',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) redirect('/login');

  const { capabilities } = await getMyPermissions();
  const canManageSystem = capabilities.has('system_settings');
  // 管理メニュー：自分がアクセスできる管理ページへの導線のみ表示
  const adminLinks: AdminLink[] = ADMIN_LINKS.filter((l) => capabilities.has(l.capability)).map(
    ({ href, label, desc }) => ({ href, label, desc }),
  );
  // システム設定は管理機能の入口。いずれかの管理権限があれば開ける（中身は権限に応じて表示）。
  const canAccess = canManageSystem || adminLinks.length > 0;
  if (!canAccess) {
    return (
      <div className="px-5 sm:px-8 py-20 max-w-xl mx-auto text-center">
        <ShieldAlert className="w-7 h-7 text-slate-400 mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">システム設定</h1>
        <p className="text-sm text-slate-600">この画面を利用する権限がありません。</p>
      </div>
    );
  }

  let slackWebhookUrl = '';
  if (canManageSystem) {
    const { data: row } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'slack_webhook_url')
      .maybeSingle();
    slackWebhookUrl = typeof row?.value === 'string' ? row.value : '';
  }

  return (
    <SettingsClient
      slackWebhookUrl={slackWebhookUrl}
      adminLinks={adminLinks}
      canManageSystem={canManageSystem}
    />
  );
}
