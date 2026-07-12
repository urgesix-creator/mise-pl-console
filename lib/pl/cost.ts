// ====================================================================
// 月次PL：原価予測 オーケストレーション（read-only・現地通貨）
//
//   原価 = 期首在庫 + 仕入れ予測 − 直近在庫（統一式・月末で確定原価に収束）
//   仕入れ予測 = 仕入れ累計 ÷ 経過営業日数 × 当月営業日数
//   - 経過営業日数：daily_sales(day_period='all') で is_closed=false の日数（店休日除外）
//   - 当月営業日数：monthly_business_days（未入力→ no_business_days）
//   - 期首在庫：前月末以前の最新スナップショット（無→0＋no_opening_inventory）
//   - 直近在庫：asOf以前の最新スナップショット（無→0＋no_latest_inventory）
//   経過営業日数0→ no_elapsed_days。
// ====================================================================

import type { createClient } from '@/lib/supabase/server';
import { computeMonthBounds, projectCost } from './projection';
import {
  getElapsedBusinessDays,
  getInventorySnapshotOnOrBefore,
  getMonthBusinessDays,
  getPurchaseCum,
} from './queries';
import type { CostResult, Estimate, EstimateFlag } from './types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 指定店舗・対象月・評価日(asOf)の原価予測を返す（現地通貨）。
 * @param yearMonth 'YYYY-MM'（対象月）
 * @param asOf      'YYYY-MM-DD'（評価日。月途中=今日／過去月=月末を呼び出し側が渡す）
 */
export async function forecastMonthlyCost(
  supabase: SupabaseServerClient,
  storeId: string,
  yearMonth: string,
  asOf: string,
): Promise<Estimate<CostResult>> {
  const { monthStart, prevMonthEnd, yearMonthDate } = computeMonthBounds(yearMonth);

  const [purchaseCum, elapsedBusinessDays, monthBusinessDays, opening, latest] = await Promise.all([
    getPurchaseCum(supabase, storeId, monthStart, asOf),
    getElapsedBusinessDays(supabase, storeId, monthStart, asOf),
    getMonthBusinessDays(supabase, storeId, yearMonthDate),
    getInventorySnapshotOnOrBefore(supabase, storeId, prevMonthEnd), // 期首在庫
    getInventorySnapshotOnOrBefore(supabase, storeId, asOf), // 直近在庫
  ]);

  const flags: EstimateFlag[] = [];
  const openingInventory = opening.found ? opening.amount : 0;
  if (!opening.found) flags.push('no_opening_inventory');
  const latestInventory = latest.found ? latest.amount : 0;
  if (!latest.found) flags.push('no_latest_inventory');

  return projectCost({
    openingInventory,
    latestInventory,
    purchaseCum,
    elapsedBusinessDays,
    monthBusinessDays,
    flags,
  });
}
