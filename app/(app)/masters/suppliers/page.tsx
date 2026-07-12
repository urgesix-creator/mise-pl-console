import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { SuppliersClient } from './_components/suppliers-client';
import type { Role, SupplierWithMeta } from './_components/types';

export const metadata = {
  title: '仕入先マスタ | みせPL',
};

type PageProps = {
  searchParams: Promise<{ store?: string }>;
};

export default async function SuppliersPage({ searchParams: searchParamsPromise }: PageProps) {
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

  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  const accessibleStores = stores ?? [];

  if (accessibleStores.length === 0) {
    return <EmptyStoresState />;
  }

  // URLの?store= → Cookie（前回選択）→ 先頭店（#2）
  const selectedStoreId = await resolveSelectedStoreId(searchParams.store, accessibleStores);
  const selectedStore =
    accessibleStores.find((s) => s.id === selectedStoreId) ?? accessibleStores[0];

  const [categoriesResult, suppliersResult, purchasesResult] = await Promise.all([
    supabase
      .from('purchase_categories')
      .select('*')
      .eq('store_id', selectedStore.id)
      .order('display_order'),
    supabase
      .from('suppliers')
      .select('*')
      .eq('store_id', selectedStore.id)
      .order('display_order'),
    supabase
      .from('daily_purchases')
      .select('supplier_id, amount')
      .eq('store_id', selectedStore.id),
  ]);

  const allCategories = categoriesResult.data ?? [];
  const allSuppliers = suppliersResult.data ?? [];
  const purchases = purchasesResult.data ?? [];

  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  // 取引件数は「仕入額ゼロ（amount=0・空欄保存）の行を数えない」（amount>0 のみ）。
  // 金額の合算には一切影響しない（件数の数え方のみ）。
  const transactionCountBySupplier = purchases.reduce<Record<string, number>>((acc, p) => {
    if (Number(p.amount ?? 0) > 0) {
      acc[p.supplier_id] = (acc[p.supplier_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  const suppliersWithMeta: SupplierWithMeta[] = allSuppliers.map((s) => {
    const cat = categoryById.get(s.category_id);
    return {
      ...s,
      category_name: cat?.name ?? '（カテゴリ未取得）',
      category_is_active: cat?.is_active ?? false,
      transaction_count: transactionCountBySupplier[s.id] ?? 0,
    };
  });

  return (
    <SuppliersClient
      stores={accessibleStores}
      selectedStore={selectedStore}
      suppliers={suppliersWithMeta}
      categories={allCategories}
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
