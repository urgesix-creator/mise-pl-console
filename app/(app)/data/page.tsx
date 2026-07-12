import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DataClient } from './_components/data-client';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { aggregateDepartmentSales } from './_lib/aggregate';
import type {
  Store,
  Role,
  DepartmentSalesSummary,
  DepartmentSaleDetailRow,
} from './_components/types';

export const metadata = {
  title: 'データ閲覧 | Sales Console',
};

type SearchParams = { [key: string]: string | string[] | undefined };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 当月初日（YYYY-MM-01） */
function monthStartISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export default async function DataPage({
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

  // RLS により、アクセス可能な店舗のみが返る
  const { data: storesData } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  const stores: Store[] = storesData ?? [];

  // 選択中の店舗を決定（URLクエリ ?store= → Cookie（前回選択）→ 先頭店舗）（#2）
  const requestedStoreId = pickString(searchParams?.store);
  const selectedStoreId = await resolveSelectedStoreId(requestedStoreId, stores);
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  // 期間：?from=&to=（既定 当月初〜今日）。不正値は既定にフォールバック
  const rawFrom = pickString(searchParams?.from);
  const rawTo = pickString(searchParams?.to);
  const fromDate = rawFrom && DATE_PATTERN.test(rawFrom) ? rawFrom : monthStartISO();
  const toDate = rawTo && DATE_PATTERN.test(rawTo) ? rawTo : todayISO();

  // 部門別売上の構成比集計（§8.8・案A：RLS適用SELECT → TS集計）。daily_sales は参照しない。
  let summary: DepartmentSalesSummary = { rows: [], total: 0, hasData: false };
  let detailRows: DepartmentSaleDetailRow[] = [];
  if (selectedStore && fromDate <= toDate) {
    const [salesResult, deptResult] = await Promise.all([
      // 明細（当該店舗・期間）。RLS: can_access_store(store_id) が適用される
      supabase
        .from('daily_department_sales')
        .select('business_date, department_id, gross_sales')
        .eq('store_id', selectedStore.id)
        .gte('business_date', fromDate)
        .lte('business_date', toDate),
      // 部門マスタ（名称・表示順の解決用）。無効部門も含めて取得（過去データの名称解決のため）
      supabase
        .from('sales_departments')
        .select('id, name, display_order')
        .eq('store_id', selectedStore.id),
    ]);

    const salesData = salesResult.data ?? [];
    const deptData = deptResult.data ?? [];

    // 集計（ロジックは不変。business_date を含む行を渡しても department_id/gross_sales のみ参照される）
    summary = aggregateDepartmentSales(salesData, deptData);

    // 明細エクスポート用の行（日付・部門名・税込売上）。display_order → 日付 の順に整列
    const metaById = new Map(deptData.map((d) => [d.id, d]));
    detailRows = salesData
      .map((r) => {
        const meta = metaById.get(r.department_id);
        return {
          business_date: r.business_date,
          department_id: r.department_id,
          name: meta?.name ?? '(不明な部門)',
          display_order: meta?.display_order ?? Number.MAX_SAFE_INTEGER,
          gross_sales: Number(r.gross_sales),
        };
      })
      .sort(
        (a, b) =>
          a.display_order - b.display_order ||
          a.business_date.localeCompare(b.business_date) ||
          a.name.localeCompare(b.name),
      );
  }

  return (
    <DataClient
      stores={stores}
      selectedStoreId={selectedStore?.id ?? null}
      fromDate={fromDate}
      toDate={toDate}
      userRole={profile.role as Role}
      summary={summary}
      detailRows={detailRows}
    />
  );
}
