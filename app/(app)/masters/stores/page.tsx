import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { StoresClient } from './_components/stores-client';

export const metadata = {
  title: '店舗マスタ | Sales Console',
};

// 国・通貨マスタ等はマイグレーションで DB 直追加され得る（アプリ外で更新）。
// Next.js の fetch Data Cache が古い一覧を返さないよう、常に最新を取得する。
export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isExecutive = profile?.role
    ? await roleHasCapability(supabase, profile.role, 'exec_master')
    : false;

  const [storesResult, countriesResult, currenciesResult] = await Promise.all([
    supabase.from('stores').select('*').order('display_order'),
    supabase.from('countries').select('*').order('display_order'),
    supabase.from('currencies').select('*').order('display_order'),
  ]);

  return (
    <StoresClient
      stores={storesResult.data ?? []}
      countries={countriesResult.data ?? []}
      currencies={currenciesResult.data ?? []}
      isExecutive={isExecutive}
    />
  );
}
