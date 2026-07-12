import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { CountriesClient } from './_components/countries-client';
import type { CountryWithMeta } from './_components/types';

export const metadata = {
  title: '国マスタ | Sales Console',
};

// 国マスタはマイグレーションで DB 直追加され得る（アプリ外で更新）。
// fetch Data Cache が古い一覧を返さないよう、常に最新を取得する。
export const dynamic = 'force-dynamic';

export default async function CountriesPage() {
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

  const [countriesResult, storesResult] = await Promise.all([
    supabase.from('countries').select('*').order('display_order'),
    supabase.from('stores').select('country_id').eq('is_active', true),
  ]);

  const countries = countriesResult.data ?? [];
  const stores = storesResult.data ?? [];

  const storeCountByCountry: Record<string, number> = {};
  for (const s of stores) {
    storeCountByCountry[s.country_id] = (storeCountByCountry[s.country_id] ?? 0) + 1;
  }

  const countriesWithMeta: CountryWithMeta[] = countries.map((c) => ({
    ...c,
    store_count: storeCountByCountry[c.id] ?? 0,
  }));

  const canWrite = await roleHasCapability(supabase, profile.role, 'exec_master');
  return <CountriesClient countries={countriesWithMeta} canWrite={canWrite} />;
}
