import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMyPermissions } from '@/lib/permissions/server';
import { InitialSetupClient } from './_components/initial-setup-client';
import type { Store, Role } from '@/app/(app)/data/_components/types';

export const metadata = {
  title: '初期設定 | Sales Console',
};

export const dynamic = 'force-dynamic';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export default async function InitialSetupPage() {
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
  if (!capabilities.has('manage_initial_setup')) {
    return (
      <div className="px-5 sm:px-8 py-20 max-w-xl mx-auto text-center">
        <ShieldAlert className="w-7 h-7 text-slate-400 mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">初期設定</h1>
        <p className="text-sm text-slate-600">この画面を利用する権限がありません。</p>
      </div>
    );
  }

  const { data: storesData } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  const stores = (storesData ?? []) as Store[];

  const now = jstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const defaultFrom = `${y}-${pad(m)}-01`;
  const defaultTo = `${y}-${pad(m)}-${pad(d)}`;

  return (
    <InitialSetupClient
      stores={stores}
      role={profile.role as Role}
      defaultFrom={defaultFrom}
      defaultTo={defaultTo}
    />
  );
}
