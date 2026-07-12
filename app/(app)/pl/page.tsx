import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { forecastMonthlySales } from '@/lib/pl/sales';
import { forecastMonthlyCost } from '@/lib/pl/cost';
import { sumBetween } from '@/lib/pl/queries';
import { roleHasCapability } from '@/lib/permissions/server';
import { convertToJpy } from '@/lib/business';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import type { CostResult, Estimate, SalesForecastResult } from '@/lib/pl/types';
import {
  PlClient,
  type PlMonth,
  type PlStore,
  type ExpenseAccountInit,
  type FormulaAccountInit,
} from './_components/pl-client';
import type { CategoryTag } from './_lib/expense-constants';
import type { CalcType } from './_lib/formula-constants';

export const metadata = {
  title: '月次PL（損益） | みせPL',
};

type SearchParams = { [key: string]: string | string[] | undefined };

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default async function MonthlyPlPage({
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

  // RLS で参照可能な有効店舗（PL用パラメータ込み）
  const { data: storesData } = await supabase
    .from('stores')
    .select('id, name, currency_id, fiscal_year_start_month, service_fee_rate, employee_rebate_rate')
    .eq('is_active', true)
    .order('display_order');
  const stores: PlStore[] = (storesData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    currency_id: s.currency_id,
    fiscal_year_start_month: Number(s.fiscal_year_start_month),
    service_fee_rate: Number(s.service_fee_rate),
    employee_rebate_rate: Number(s.employee_rebate_rate),
  }));

  // 店舗選択
  const rawStore = pickString(searchParams?.store);
  // URL の ?store= → Cookie（前回選択）→ 先頭店 の順で既定を決める（#2）
  const selectedStoreId = await resolveSelectedStoreId(rawStore, stores);
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  // S6：円換算用レート（その店舗の通貨→JPY・最新の1値）。表示トグル用・読み取りのみ。
  // 月末レート方式：通貨ペアごとに1値。無ければ null（円トグルは無効表示）。
  let jpyRate: number | null = null;
  if (selectedStore) {
    const { data: rateRows } = await supabase
      .from('exchange_rates')
      .select('from_currency_id, to_currency_id, rate')
      .eq('to_currency_id', 'jpy')
      .eq('is_active', true);
    jpyRate = convertToJpy(
      1,
      selectedStore.currency_id,
      (rateRows ?? []) as { from_currency_id: string; to_currency_id: string; rate: number }[],
    );
  }

  const today = todayISO();
  const [ty, tm] = today.split('-').map(Number);
  const startMonth = selectedStore?.fiscal_year_start_month ?? 1; // 1-12

  // 決算期（年度）：fiscal year の開始年。既定は「今日を含む年度」
  const defaultFyStartYear = tm >= startMonth ? ty : ty - 1;
  const rawFy = pickString(searchParams?.fy);
  const fyStartYear =
    rawFy && /^\d{4}$/.test(rawFy) ? Number(rawFy) : defaultFyStartYear;

  // 12ヶ月（fiscal_year_start_month 起点）を構築し、各月の予測を取得
  let months: PlMonth[] = [];
  const businessDays: Record<string, number> = {}; // 'YYYY-MM' → 営業日数
  const bankBalances: Record<string, number> = {}; // 'YYYY-MM' → 通帳残高（現地通貨）
  let expenseAccounts: ExpenseAccountInit[] = [];
  let formulaAccounts: FormulaAccountInit[] = [];
  if (selectedStore) {
    const monthDefs = Array.from({ length: 12 }, (_, i) => {
      const idx = startMonth - 1 + i; // 0-based 通し月
      const year = fyStartYear + Math.floor(idx / 12);
      const month = (idx % 12) + 1;
      const yearMonth = `${year}-${pad(month)}`;
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthStart = `${yearMonth}-01`;
      const monthEnd = `${yearMonth}-${pad(daysInMonth)}`;
      // asOf：当月=今日／過去月=月末／未来月=評価しない
      let asOf: string | null;
      if (monthEnd < today) asOf = monthEnd; // 過去月
      else if (monthStart <= today) asOf = today; // 当月
      else asOf = null; // 未来月（評価しない）
      return { year, month, yearMonth, asOf };
    });

    // 既存の営業日数（monthly_business_days）を読み込み（year_month は月初DATE）
    const monthStartDates = monthDefs.map((d) => `${d.yearMonth}-01`);
    const { data: bdData } = await supabase
      .from('monthly_business_days')
      .select('year_month, business_days')
      .eq('store_id', selectedStore.id)
      .in('year_month', monthStartDates);
    for (const r of (bdData ?? []) as { year_month: string; business_days: number }[]) {
      businessDays[r.year_month.slice(0, 7)] = Number(r.business_days);
    }

    // 既存の通帳残高（monthly_bank_balances・040）を読み込み（year_month は月初DATE）
    const { data: bbData } = await supabase
      .from('monthly_bank_balances')
      .select('year_month, balance')
      .eq('store_id', selectedStore.id)
      .in('year_month', monthStartDates);
    for (const r of (bbData ?? []) as { year_month: string; balance: number | string }[]) {
      bankBalances[r.year_month.slice(0, 7)] = Number(r.balance);
    }

    // 既存の販管費（monthly_expenses）を読み込み、科目（account_name）ごとに集約
    const { data: exData } = await supabase
      .from('monthly_expenses')
      .select('year_month, account_name, category_tag, amount, display_order')
      .eq('store_id', selectedStore.id)
      .in('year_month', monthStartDates);
    const exMap = new Map<string, ExpenseAccountInit>();
    for (const r of (exData ?? []) as {
      year_month: string;
      account_name: string;
      category_tag: CategoryTag;
      amount: number | string;
      display_order: number;
    }[]) {
      let row = exMap.get(r.account_name);
      if (!row) {
        row = {
          account_name: r.account_name,
          category_tag: r.category_tag,
          amounts: {},
          display_order: Number(r.display_order),
        };
        exMap.set(r.account_name, row);
      }
      row.category_tag = r.category_tag;
      row.display_order = Number(r.display_order);
      row.amounts[r.year_month.slice(0, 7)] = Number(r.amount);
    }
    // display_order 順（同値は名前順）で安定ソート
    expenseAccounts = [...exMap.values()].sort(
      (a, b) => a.display_order - b.display_order || a.account_name.localeCompare(b.account_name, 'ja'),
    );

    // 計算式の科目（expense_formulas・018）を読み込み（読み取りのみ・display_order 昇順）。
    // 金額は保存せず、表示時に各月の売上高（net）から都度計算する。
    const { data: fmData } = await supabase
      .from('expense_formulas')
      .select('account_name, category_tag, calc_type, rate1, rate2, threshold, fixed_amount, display_order')
      .eq('store_id', selectedStore.id)
      .order('display_order', { ascending: true });
    formulaAccounts = ((fmData ?? []) as {
      account_name: string;
      category_tag: CategoryTag;
      calc_type: CalcType;
      rate1: number | string | null;
      rate2: number | string | null;
      threshold: number | string | null;
      fixed_amount: number | string | null;
      display_order: number | string;
    }[]).map((r) => ({
      account_name: r.account_name,
      category_tag: r.category_tag,
      calc_type: r.calc_type,
      rate1: r.rate1 === null ? null : Number(r.rate1),
      rate2: r.rate2 === null ? null : Number(r.rate2),
      threshold: r.threshold === null ? null : Number(r.threshold),
      fixed_amount: r.fixed_amount === null ? null : Number(r.fixed_amount),
      display_order: Number(r.display_order),
    }));

    months = await Promise.all(
      monthDefs.map(async (def): Promise<PlMonth> => {
        let sales: Estimate<SalesForecastResult> | null = null;
        let cost: Estimate<CostResult> | null = null;
        // S5：客数（customer_count）・税込売上（gross_sales）の実績合計（当月〜asOf・day_period='all'）。
        // 予測はせず、入力済みの実績のみ。未評価（未来月）は null。lib/pl の sumBetween を流用（読み取り）。
        let customerCount: number | null = null;
        let grossActual: number | null = null;
        if (def.asOf !== null) {
          const monthStart = `${def.yearMonth}-01`;
          const [s, c, cust, gross] = await Promise.all([
            forecastMonthlySales(supabase, selectedStore.id, def.yearMonth, def.asOf),
            forecastMonthlyCost(supabase, selectedStore.id, def.yearMonth, def.asOf),
            sumBetween(supabase, 'daily_sales', 'customer_count', selectedStore.id, 'business_date', monthStart, def.asOf, { day_period: 'all' }),
            sumBetween(supabase, 'daily_sales', 'gross_sales', selectedStore.id, 'business_date', monthStart, def.asOf, { day_period: 'all' }),
          ]);
          sales = s;
          cost = c;
          customerCount = cust;
          grossActual = gross;
        }
        return {
          year: def.year,
          month: def.month,
          yearMonth: def.yearMonth,
          evaluated: def.asOf !== null,
          sales,
          cost,
          customerCount,
          grossActual,
        };
      }),
    );
  }

  const canEdit = await roleHasCapability(supabase, profile.role, 'daily_input');

  return (
    <PlClient
      stores={stores}
      selectedStoreId={selectedStoreId}
      fyStartYear={fyStartYear}
      months={months}
      businessDays={businessDays}
      bankBalances={bankBalances}
      expenseAccounts={expenseAccounts}
      formulaAccounts={formulaAccounts}
      canEdit={canEdit}
      currencyCode={selectedStore?.currency_id?.toUpperCase() ?? ''}
      jpyRate={jpyRate}
    />
  );
}
