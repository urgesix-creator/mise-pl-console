import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import type { Role } from '@/lib/permissions/constants';
import { UsersClient } from './_components/users-client';
import type { CountryOption, StoreOption, UserRow } from './_components/types';

export const metadata = {
  title: 'ユーザー管理 | みせPL',
};

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
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

  const canManage = await roleHasCapability(supabase, profile.role, 'user_management');
  if (!canManage) {
    return (
      <div className="px-5 sm:px-8 py-20 max-w-xl mx-auto text-center">
        <ShieldAlert className="w-7 h-7 text-slate-400 mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">ユーザー管理</h1>
        <p className="text-sm text-slate-600">この画面は経営マスタ編集の権限を持つユーザーのみ利用できます。</p>
      </div>
    );
  }

  const [profilesResult, assignmentsResult, storesResult, countriesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, email, role, country_id, is_active, invited_at, last_login_at')
      .order('created_at'),
    supabase.from('user_store_assignments').select('user_id, store_id'),
    supabase.from('stores').select('id, store_no, name').eq('is_active', true).order('store_no'),
    supabase.from('countries').select('id, name, flag').order('display_order'),
  ]);

  const assignmentsByUser = new Map<string, string[]>();
  for (const a of (assignmentsResult.data ?? []) as { user_id: string; store_id: string }[]) {
    const list = assignmentsByUser.get(a.user_id) ?? [];
    list.push(a.store_id);
    assignmentsByUser.set(a.user_id, list);
  }

  const users: UserRow[] = (profilesResult.data ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: p.email,
    role: p.role as Role,
    country_id: p.country_id,
    is_active: p.is_active,
    invited_at: p.invited_at,
    last_login_at: p.last_login_at,
    store_ids: assignmentsByUser.get(p.id) ?? [],
  }));

  const stores: StoreOption[] = (storesResult.data ?? []).map((s) => ({
    id: s.id,
    store_no: Number(s.store_no),
    name: s.name,
  }));
  const countries: CountryOption[] = (countriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    flag: c.flag,
  }));

  return (
    <UsersClient users={users} stores={stores} countries={countries} currentUserId={user.id} />
  );
}
