import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { DepartmentsClient } from './_components/departments-client';
import type { SalesDepartment } from './_components/types';

export const metadata = {
  title: '部門マスタ | みせPL',
};

type PageProps = {
  searchParams: Promise<{ store?: string }>;
};

export default async function DepartmentsPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
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

  // RLS により、アクセス可能な店舗のみが返る
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  const accessibleStores = stores ?? [];

  // アクセス可能な店舗がない場合
  if (accessibleStores.length === 0) {
    return <EmptyStoresState />;
  }

  // 選択中の店舗を決定（URLの?store= → Cookie（前回選択）→ 先頭店）（#2）
  const selectedStoreId = await resolveSelectedStoreId(searchParams.store, accessibleStores);
  const selectedStore =
    accessibleStores.find((s) => s.id === selectedStoreId) ?? accessibleStores[0];

  const { data: departmentsData } = await supabase
    .from('sales_departments')
    .select('*')
    .eq('store_id', selectedStore.id)
    .order('display_order');

  const departments: SalesDepartment[] = departmentsData ?? [];

  return (
    <DepartmentsClient
      stores={accessibleStores}
      selectedStore={selectedStore}
      departments={departments}
      canWrite={await roleHasCapability(supabase, profile.role, 'store_master')}
    />
  );
}

function EmptyStoresState() {
  return (
    <div className="px-5 sm:px-8 py-20 max-w-xl mx-auto text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">
        アクセス可能な店舗がありません
      </h1>
      <p className="text-sm text-slate-600">
        担当店舗の割当がない可能性があります。管理者にお問い合わせください。
      </p>
    </div>
  );
}
