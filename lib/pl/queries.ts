// ====================================================================
// 月次PL集計の読み取りクエリ（read-only）
//
//   - Supabase サーバクライアントを引数で受け取る通常モジュール（'use server' なし）。
//   - daily_sales / daily_purchases / inventory_estimates / daily_targets /
//     monthly_business_days を SELECT のみ。INSERT/UPDATE/DELETE はしない。
//   - 税計算（§8.1）には触れない（読み取りのみ）。
//   - 金額は NUMERIC が文字列で返るため Number() 変換する。
// ====================================================================

import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** 在庫スナップショット取得結果（該当なしは found=false） */
export type InventorySnapshot = { found: true; amount: number } | { found: false };

/**
 * 汎用累計：table.amountCol の合計を [from, to]（business/target 日付）で取得。
 * extraEq で追加の等値条件（例：day_period='all'）を指定できる。
 * 行なし／NULL は 0。
 */
export async function sumBetween(
  supabase: SupabaseServerClient,
  table: 'daily_sales' | 'daily_purchases' | 'daily_targets',
  amountCol: string,
  storeId: string,
  dateCol: string,
  from: string,
  to: string,
  extraEq?: Record<string, string>,
): Promise<number> {
  let query = supabase
    .from(table)
    .select(amountCol)
    .eq('store_id', storeId)
    .gte(dateCol, from)
    .lte(dateCol, to);
  if (extraEq) {
    for (const [k, v] of Object.entries(extraEq)) query = query.eq(k, v);
  }
  const { data, error } = await query;
  if (error || !data) return 0;
  // 動的列名 select のため PostgREST の型推論が効かない → unknown 経由で安全に集計
  return (data as unknown as Record<string, number | string>[]).reduce(
    (sum, row) => sum + Number(row[amountCol] ?? 0),
    0,
  );
}

/** 実績累計：daily_sales(day_period='all') の net_sales を当月〜asOf で合計（税抜） */
export function getSalesActualCum(
  supabase: SupabaseServerClient,
  storeId: string,
  monthStart: string,
  asOf: string,
): Promise<number> {
  return sumBetween(supabase, 'daily_sales', 'net_sales', storeId, 'business_date', monthStart, asOf, {
    day_period: 'all',
  });
}

/** 予算累計：daily_targets の target_sales を当月〜asOf で合計 */
export function getBudgetCum(
  supabase: SupabaseServerClient,
  storeId: string,
  monthStart: string,
  asOf: string,
): Promise<number> {
  return sumBetween(supabase, 'daily_targets', 'target_sales', storeId, 'target_date', monthStart, asOf);
}

/** 月予算総計：daily_targets の target_sales を当月全体で合計 */
export function getBudgetMonthTotal(
  supabase: SupabaseServerClient,
  storeId: string,
  monthStart: string,
  monthEnd: string,
): Promise<number> {
  return sumBetween(supabase, 'daily_targets', 'target_sales', storeId, 'target_date', monthStart, monthEnd);
}

/**
 * 仕入れ累計（原価区分で絞った合計）：cost_type が costType の仕入先からの
 * daily_purchases.net_amount（税抜＝原価基準）を [from, to] で合計。is_active は問わない。
 * 該当仕入先が無ければ 0。
 * ※原価は「税抜(net)」基準（VAT控除前提）。既存行は net_amount=amount のため過去PLは不変。
 */
export async function sumPurchasesByCostType(
  supabase: SupabaseServerClient,
  storeId: string,
  from: string,
  to: string,
  costType: 'cogs' | 'sga',
): Promise<number> {
  const { data: suppliers, error: supError } = await supabase
    .from('suppliers')
    .select('id')
    .eq('store_id', storeId)
    .eq('cost_type', costType);
  if (supError || !suppliers || suppliers.length === 0) return 0;
  const ids = (suppliers as { id: string }[]).map((s) => s.id);

  const { data, error } = await supabase
    .from('daily_purchases')
    .select('net_amount')
    .eq('store_id', storeId)
    .in('supplier_id', ids)
    .gte('business_date', from)
    .lte('business_date', to);
  if (error || !data) return 0;
  return (data as { net_amount: number | string }[]).reduce((sum, r) => sum + Number(r.net_amount ?? 0), 0);
}

/**
 * 仕入れ累計（売上原価分）：daily_purchases の amount を当月〜asOf で合計。
 * cost_type='cogs' の仕入先のみ（販管費区分 'sga' は売上原価から除外）。
 */
export function getPurchaseCum(
  supabase: SupabaseServerClient,
  storeId: string,
  monthStart: string,
  asOf: string,
): Promise<number> {
  return sumPurchasesByCostType(supabase, storeId, monthStart, asOf, 'cogs');
}

/**
 * 経過営業日数：daily_sales(day_period='all') でレコードがあり is_closed=false の日数。
 * 売上0でも is_closed=false なら営業日として数える。店休日（is_closed=true）は除外。
 */
export async function getElapsedBusinessDays(
  supabase: SupabaseServerClient,
  storeId: string,
  monthStart: string,
  asOf: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('daily_sales')
    .select('business_date')
    .eq('store_id', storeId)
    .eq('day_period', 'all')
    .eq('is_closed', false)
    .gte('business_date', monthStart)
    .lte('business_date', asOf);
  if (error || !data) return 0;
  // day_period='all' なら business_date は一意だが、念のため distinct を取る
  return new Set((data as { business_date: string }[]).map((r) => r.business_date)).size;
}

/**
 * 当月営業日数：monthly_business_days.business_days を取得（year_month=月初DATE）。
 * 未入力（行なし）は null（＝計算不可の判定材料）。
 */
export async function getMonthBusinessDays(
  supabase: SupabaseServerClient,
  storeId: string,
  yearMonthDate: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('monthly_business_days')
    .select('business_days')
    .eq('store_id', storeId)
    .eq('year_month', yearMonthDate)
    .maybeSingle();
  if (error || !data) return null;
  return Number((data as { business_days: number }).business_days);
}

/**
 * 在庫スナップショット：対象日（onOrBefore）以前で最新の inventory_estimates.amount。
 * 期首在庫（前月末以前）・直近在庫（asOf以前）の両方に使う。
 * 該当なしは found=false（呼び出し側で0扱い＋フラグ）。
 */
export async function getInventorySnapshotOnOrBefore(
  supabase: SupabaseServerClient,
  storeId: string,
  onOrBefore: string,
): Promise<InventorySnapshot> {
  const { data, error } = await supabase
    .from('inventory_estimates')
    .select('amount')
    .eq('store_id', storeId)
    .lte('business_date', onOrBefore)
    .order('business_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { found: false };
  return { found: true, amount: Number((data as { amount: number }).amount) };
}
