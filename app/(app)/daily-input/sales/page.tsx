import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { SalesInputClient } from './_components/sales-input-client';
import { getDailySalesByKey, getUserAccessibleStores } from './actions';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { type DayPeriod } from './_schemas';

export const metadata = {
  title: '日次売上入力 | みせPL',
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

export default async function DailySalesInputPage({
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

  // URL クエリから初期状態を抽出
  const rawStore = pickString(searchParams?.store);
  const rawDate = pickString(searchParams?.date);

  // URL の ?store= → Cookie（前回選択）→ 先頭店 の順で既定を決める（#2）
  const selectedStoreId = await resolveSelectedStoreId(rawStore, stores);

  const selectedDate = rawDate && DATE_PATTERN.test(rawDate) ? rawDate : todayISO();

  // 全店 day_period='all' 運用。昼夜分離は廃止したため常に 'all'。
  const selectedDayPeriod: DayPeriod = 'all';

  // 既存レコードのロード
  const initialRecord =
    selectedStoreId !== null
      ? await getDailySalesByKey(selectedStoreId, selectedDate, selectedDayPeriod)
      : null;

  // 部門別売上（参考データ）：有効な部門と、当日の既存値をロード（経営データとは独立）
  let departments: { id: string; name: string; display_order: number }[] = [];
  let departmentSales: Record<string, number> = {};
  if (selectedStoreId !== null) {
    const [deptResult, deptSalesResult] = await Promise.all([
      supabase
        .from('sales_departments')
        .select('id, name, display_order')
        .eq('store_id', selectedStoreId)
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('daily_department_sales')
        .select('department_id, gross_sales')
        .eq('store_id', selectedStoreId)
        .eq('business_date', selectedDate),
    ]);
    departments = deptResult.data ?? [];
    departmentSales = Object.fromEntries(
      (deptSalesResult.data ?? []).map((r) => [r.department_id, Number(r.gross_sales)]),
    );
  }

  return (
    <SalesInputClient
      stores={stores}
      selectedStoreId={selectedStoreId}
      selectedDate={selectedDate}
      selectedDayPeriod={selectedDayPeriod}
      initialRecord={initialRecord}
      userRole={profile.role as never}
      canWrite={await roleHasCapability(supabase, profile.role, 'daily_input')}
      departments={departments}
      departmentSales={departmentSales}
    />
  );
}
