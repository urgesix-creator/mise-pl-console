import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { ApiKeysClient, type ApiKeyRow } from './_components/api-keys-client';

export const metadata = {
  title: 'APIキー | Sales Console',
};

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
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

  const canManage = await roleHasCapability(supabase, profile.role, 'api_keys');
  if (!canManage) {
    return (
      <div className="px-5 sm:px-8 py-20 max-w-xl mx-auto text-center">
        <ShieldAlert className="w-7 h-7 text-slate-400 mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">APIキー</h1>
        <p className="text-sm text-slate-600">この画面は経営マスタ編集の権限を持つユーザーのみ利用できます。</p>
      </div>
    );
  }

  // key_hash は返さない（ラベル・prefix・scope・状態・利用日時のみ）
  const { data } = await supabase
    .from('api_keys')
    .select('id, label, key_prefix, scope, is_active, last_used_at, created_at')
    .order('created_at', { ascending: false });

  return <ApiKeysClient keys={(data ?? []) as ApiKeyRow[]} />;
}
