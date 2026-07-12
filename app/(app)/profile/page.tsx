import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABELS, type Role } from '@/lib/permissions/constants';
import { ProfileClient } from './_components/profile-client';

export const metadata = {
  title: 'プロフィール | みせPL',
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, role, country_id')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  let countryLabel: string | null = null;
  if (profile.country_id) {
    const { data: c } = await supabase
      .from('countries')
      .select('name, flag')
      .eq('id', profile.country_id)
      .maybeSingle();
    countryLabel = c ? `${c.flag ?? ''} ${c.name}` : profile.country_id;
  }

  const { data: assignments } = await supabase
    .from('user_store_assignments')
    .select('store_id')
    .eq('user_id', user.id);
  const ids = (assignments ?? []).map((a) => a.store_id);

  let storeLabels: string[] = [];
  if (ids.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('store_no, name')
      .in('id', ids)
      .order('store_no');
    storeLabels = (stores ?? []).map(
      (s) => `${String(s.store_no).padStart(3, '0')} ${s.name}`,
    );
  }

  return (
    <ProfileClient
      displayName={profile.display_name}
      email={profile.email}
      roleLabel={ROLE_LABELS[profile.role as Role] ?? profile.role}
      countryLabel={countryLabel}
      storeLabels={storeLabels}
    />
  );
}
