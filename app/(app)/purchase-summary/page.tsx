import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { PurchaseSummaryClient } from './_components/purchase-summary-client';
import type { PurchaseGroup, PurchaseRow, StoreOption } from './_components/types';

export const metadata = {
  title: '仕入先別 仕入集計 | Sales Console',
};

export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
/** 日本時間（JST=UTC+9）基準の今日 */
function jstToday(): { y: number; m: number } {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
}

export default async function PurchaseSummaryPage({
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
    .select('is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) redirect('/login');

  // RLS で参照可能な有効店舗
  const { data: storesData } = await supabase
    .from('stores')
    .select('id, store_no, name, currency_id, fiscal_year_start_month')
    .eq('is_active', true)
    .order('store_no');
  const stores: StoreOption[] = (storesData ?? []).map((s) => ({
    id: s.id,
    store_no: Number(s.store_no),
    name: s.name,
    currency_id: s.currency_id,
    fiscal_year_start_month: Number(s.fiscal_year_start_month),
  }));

  if (stores.length === 0) {
    return (
      <PurchaseSummaryClient
        stores={[]}
        selectedStoreId={null}
        currencyCode=""
        fyStartYear={jstToday().y}
        fyLabel=""
        monthLabels={[]}
        monthKeys={[]}
        groups={[]}
      />
    );
  }

  // 店舗選択（URLの?store= → Cookie（前回選択）→ 先頭店）（#2）
  const rawStore = pickString(searchParams?.store);
  const selectedStoreId = await resolveSelectedStoreId(rawStore, stores);
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? stores[0];

  // 会計年度（fiscal_year_start_month 起点）。既定＝今日を含む年度
  const startMonth = selectedStore.fiscal_year_start_month; // 1-12
  const today = jstToday();
  const defaultFyStartYear = today.m >= startMonth ? today.y : today.y - 1;
  const rawFy = pickString(searchParams?.fy);
  const fyStartYear = rawFy && /^\d{4}$/.test(rawFy) ? Number(rawFy) : defaultFyStartYear;

  // 12ヶ月の定義
  const monthDefs = Array.from({ length: 12 }, (_, i) => {
    const idx = startMonth - 1 + i;
    const year = fyStartYear + Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    return { key: `${year}-${pad(month)}`, label: `${year}/${pad(month)}` };
  });
  const monthLabels = monthDefs.map((d) => d.label);
  const monthKeys = monthDefs.map((d) => d.key); // 'YYYY-MM'（日別内訳の対象月指定に使用）
  const monthIndexByKey = new Map(monthDefs.map((d, i) => [d.key, i]));
  const fyStart = `${monthDefs[0].key}-01`;
  const lastKey = monthDefs[11].key;
  const [ly, lm] = lastKey.split('-').map(Number);
  const fyEnd = `${lastKey}-${pad(new Date(Date.UTC(ly, lm, 0)).getUTCDate())}`;
  const fyLabel =
    startMonth === 1 ? `${fyStartYear}年` : `${fyStartYear}年度（${startMonth}月開始）`;

  // 仕入先・カテゴリ・期間内の仕入を取得
  const [suppliersResult, categoriesResult, purchasesResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, category_id, display_order, is_active, cost_type')
      .eq('store_id', selectedStore.id)
      .order('display_order'),
    supabase
      .from('purchase_categories')
      .select('id, name, display_order')
      .eq('store_id', selectedStore.id),
    supabase
      .from('daily_purchases')
      .select('supplier_id, business_date, amount')
      .eq('store_id', selectedStore.id)
      .gte('business_date', fyStart)
      .lte('business_date', fyEnd),
  ]);

  const suppliers = suppliersResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const purchases = purchasesResult.data ?? [];

  const categoryById = new Map(
    categories.map((c) => [c.id, { name: c.name, display_order: Number(c.display_order) }]),
  );

  // supplier_id → 月別合計
  const monthlyBySupplier = new Map<string, number[]>();
  const hasPurchase = new Set<string>();
  for (const p of purchases as { supplier_id: string; business_date: string; amount: number | string }[]) {
    const idx = monthIndexByKey.get(p.business_date.slice(0, 7));
    if (idx === undefined) continue;
    let arr = monthlyBySupplier.get(p.supplier_id);
    if (!arr) {
      arr = new Array(12).fill(0);
      monthlyBySupplier.set(p.supplier_id, arr);
    }
    arr[idx] += Number(p.amount ?? 0);
    hasPurchase.add(p.supplier_id);
  }

  // 行に含める仕入先：有効 or 期間内に仕入がある（無効でも履歴があれば表示）
  const rows: PurchaseRow[] = suppliers
    .filter((s) => s.is_active || hasPurchase.has(s.id))
    .map((s) => {
      const monthly = monthlyBySupplier.get(s.id) ?? new Array(12).fill(0);
      const cat = categoryById.get(s.category_id);
      return {
        supplierId: s.id,
        supplierName: s.name,
        categoryName: cat?.name ?? '（カテゴリ未取得）',
        categoryOrder: cat?.display_order ?? 9999,
        costType: s.cost_type,
        isActive: s.is_active,
        displayOrder: Number(s.display_order),
        monthly,
        yearTotal: monthly.reduce((a, b) => a + b, 0),
      };
    });

  // 区分でグループ化（cogs→sga）。グループ内はカテゴリ順→表示順
  const buildGroup = (costType: 'cogs' | 'sga'): PurchaseGroup => {
    const groupRows = rows
      .filter((r) => r.costType === costType)
      .sort((a, b) => a.categoryOrder - b.categoryOrder || a.displayOrder - b.displayOrder);
    const monthlySubtotal = new Array(12).fill(0);
    for (const r of groupRows) for (let i = 0; i < 12; i++) monthlySubtotal[i] += r.monthly[i];
    return {
      costType,
      rows: groupRows,
      monthlySubtotal,
      yearSubtotal: monthlySubtotal.reduce((a, b) => a + b, 0),
    };
  };

  const groups: PurchaseGroup[] = [buildGroup('cogs'), buildGroup('sga')];

  return (
    <PurchaseSummaryClient
      stores={stores}
      selectedStoreId={selectedStore.id}
      currencyCode={selectedStore.currency_id.toUpperCase()}
      fyStartYear={fyStartYear}
      fyLabel={fyLabel}
      monthLabels={monthLabels}
      monthKeys={monthKeys}
      groups={groups}
    />
  );
}
