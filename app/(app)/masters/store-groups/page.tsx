import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { StoreGroupsClient } from './_components/store-groups-client';
import type { GroupStore, StoreGroupWithMembers } from './_components/types';

export const metadata = {
  title: '店舗グループ | Sales Console',
};

export const dynamic = 'force-dynamic';

export default async function StoreGroupsPage() {
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

  const [groupsResult, membersResult, storesResult] = await Promise.all([
    supabase.from('store_groups').select('*').order('display_order'),
    supabase.from('store_group_members').select('group_id, store_id').eq('is_active', true),
    supabase.from('stores').select('id, store_no, name').eq('is_active', true).order('store_no'),
  ]);

  const groups = groupsResult.data ?? [];
  const members = membersResult.data ?? [];
  const activeStores: GroupStore[] = (storesResult.data ?? []).map((s) => ({
    id: s.id,
    store_no: Number(s.store_no),
    name: s.name,
  }));

  // group_id → 所属店舗（有効・store_no順。無効化された店舗は一覧に出さない）
  const storeById = new Map(activeStores.map((s) => [s.id, s]));
  const membersByGroup = new Map<string, GroupStore[]>();
  for (const m of members) {
    const store = storeById.get(m.store_id);
    if (!store) continue; // 無効店舗は除外
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push(store);
    membersByGroup.set(m.group_id, list);
  }
  for (const list of membersByGroup.values()) {
    list.sort((a, b) => a.store_no - b.store_no);
  }

  const groupsWithMembers: StoreGroupWithMembers[] = groups.map((g) => ({
    ...g,
    members: membersByGroup.get(g.id) ?? [],
  }));

  return (
    <StoreGroupsClient
      groups={groupsWithMembers}
      activeStores={activeStores}
      canWrite={await roleHasCapability(supabase, profile.role, 'exec_master')}
    />
  );
}
