// ====================================================================
// 月次PL：予算ベース売上予測 オーケストレーション（read-only・現地通貨）
//
//   売上予測 = 実績累計 ÷ 予算累計 × 月予算総計
//   - 実績累計：daily_sales(day_period='all') の net_sales（当月〜asOf・税抜）
//   - 予算累計：daily_targets の target_sales（当月〜asOf）
//   - 月予算総計：daily_targets の target_sales（当月全体）
//   予算累計が0（予算未入力）は計算不可（no_budget）。
// ====================================================================

import type { createClient } from '@/lib/supabase/server';
import { computeMonthBounds, projectSalesByBudget } from './projection';
import {
  getBudgetCum,
  getBudgetMonthTotal,
  getSalesActualCum,
} from './queries';
import type { Estimate, SalesForecastResult } from './types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 指定店舗・対象月・評価日(asOf)の予算ベース売上予測を返す（現地通貨）。
 * @param yearMonth 'YYYY-MM'（対象月）
 * @param asOf      'YYYY-MM-DD'（評価日。月途中=今日／過去月=月末を呼び出し側が渡す）
 */
export async function forecastMonthlySales(
  supabase: SupabaseServerClient,
  storeId: string,
  yearMonth: string,
  asOf: string,
): Promise<Estimate<SalesForecastResult>> {
  const { monthStart, monthEnd } = computeMonthBounds(yearMonth);

  const [actualCum, budgetCum, budgetMonthTotal] = await Promise.all([
    getSalesActualCum(supabase, storeId, monthStart, asOf),
    getBudgetCum(supabase, storeId, monthStart, asOf),
    getBudgetMonthTotal(supabase, storeId, monthStart, monthEnd),
  ]);

  return projectSalesByBudget(actualCum, budgetCum, budgetMonthTotal);
}
