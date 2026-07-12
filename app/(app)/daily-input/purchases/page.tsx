import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { getUserAccessibleStores } from '../sales/actions';
import {
  getDailyPurchasesByKey,
  getInventoryByKey,
  getRecentInventory,
  getSuppliersAndCategories,
  type InventorySnapshot,
} from './actions';
import { PurchasesInputClient } from './_components/purchases-input-client';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';

export const metadata = {
  title: '日次仕入入力 | みせPL',
};

type SearchParams = { [key: string]: string | string[] | undefined };

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function DailyPurchasesInputPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<SearchParams>;
}) {
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

  const stores = await getUserAccessibleStores();

  // URL クエリから初期状態を抽出（売上入力と同じ ?store= / ?date= 規約・過去日付対応）
  const rawStore = pickString(searchParams?.store);
  const rawDate = pickString(searchParams?.date);

  // URL の ?store= → Cookie（前回選択）→ 先頭店 の順で既定を決める（#2）
  const selectedStoreId = await resolveSelectedStoreId(rawStore, stores);

  const selectedDate = rawDate && DATE_PATTERN.test(rawDate) ? rawDate : todayISO();

  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  // 店舗の仕入入力モード（税抜/税込）・店舗標準仕入税率（新規仕入先の既定）を取得
  let inputMode: 'excluded' | 'included' = 'excluded';
  let defaultTaxRate = 0;
  if (selectedStoreId !== null) {
    const { data: st } = await supabase
      .from('stores')
      .select('purchase_tax_input_mode, purchase_tax_rate_default')
      .eq('id', selectedStoreId)
      .maybeSingle();
    inputMode = (st?.purchase_tax_input_mode as 'excluded' | 'included') ?? 'excluded';
    defaultTaxRate = Number(st?.purchase_tax_rate_default ?? 0);
  }

  // 仕入先・カテゴリ・既存仕入をロード（store 未選択なら空）
  let suppliers: Awaited<ReturnType<typeof getSuppliersAndCategories>>['suppliers'] = [];
  let categories: Awaited<ReturnType<typeof getSuppliersAndCategories>>['categories'] = [];
  let initialValues: Record<string, number> = {};
  let inventoryAmount: number | null = null;
  let recentInventory: InventorySnapshot[] = [];
  if (selectedStoreId !== null) {
    const [scResult, existing, inv, recent] = await Promise.all([
      getSuppliersAndCategories(selectedStoreId),
      getDailyPurchasesByKey(selectedStoreId, selectedDate),
      getInventoryByKey(selectedStoreId, selectedDate),
      getRecentInventory(selectedStoreId),
    ]);
    suppliers = scResult.suppliers;
    categories = scResult.categories;
    // 入力モードに応じ、初期表示は net（税抜）か gross（税込）。
    initialValues = Object.fromEntries(
      Object.entries(existing).map(([id, v]) => [id, inputMode === 'included' ? v.gross : v.net]),
    );
    inventoryAmount = inv;
    recentInventory = recent;
  }

  // 仕入入力は daily_input または daily_purchase_input（仕入のみ権限）で保存可
  const canWrite =
    (await roleHasCapability(supabase, profile.role, 'daily_input')) ||
    (await roleHasCapability(supabase, profile.role, 'daily_purchase_input'));
  // 「新規仕入先を追加」ボタンは仕入先マスタの編集権限（store_master）を持つ人のみ表示
  const canManageSuppliers = await roleHasCapability(supabase, profile.role, 'store_master');

  return (
    <PurchasesInputClient
      stores={stores}
      selectedStoreId={selectedStoreId}
      selectedDate={selectedDate}
      currencyCode={selectedStore?.currency_id?.toUpperCase() ?? ''}
      currencyId={selectedStore?.currency_id ?? ''}
      suppliers={suppliers}
      categories={categories}
      initialValues={initialValues}
      inventoryAmount={inventoryAmount}
      recentInventory={recentInventory}
      canWrite={canWrite}
      canManageSuppliers={canManageSuppliers}
      inputMode={inputMode}
      defaultTaxRate={defaultTaxRate}
    />
  );
}
