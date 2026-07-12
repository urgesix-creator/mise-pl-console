// ====================================================================
// 店舗別 期間集計（read-only・実績ベース・現地通貨）
//
//   月次PL（lib/pl）と同じ「税抜net」概念で、任意期間 [start, end] の実績を集計する。
//   PL の原価予測（projectCost）と違い、按分（forecast）は使わず実績そのものを使う：
//     売上原価(cogs) = 期首在庫 + 期間仕入 − 期末在庫
//   在庫の引き方は PL と同一ルール（getInventorySnapshotOnOrBefore を再利用）：
//     期首在庫 = 開始日の前日以前の直近スナップショット（無→0）
//     期末在庫 = 終了日以前の直近スナップショット（無→0）
//   売上/予算/仕入の合算は lib/pl/queries.ts の sumBetween を再利用（PL と同じ集計）。
//
//   SELECT のみ。INSERT/UPDATE/DELETE はしない。税計算（§8.1）には触れない。
// ====================================================================

import type { createClient } from '@/lib/supabase/server';
import { sumBetween, getInventorySnapshotOnOrBefore, sumPurchasesByCostType } from '@/lib/pl/queries';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** 1店舗1期間の実績（生値） */
export type StorePeriodActuals = {
  netSales: number; // Σ daily_sales.net_sales（day_period='all'）[start,end]（税抜）
  budget: number; // Σ daily_targets.target_sales [start,end]（税抜）
  purchases: number; // Σ daily_purchases.amount [start,end]（全仕入先）
  openingInventory: number; // 開始日−1日 以前の直近在庫（無→0）
  closingInventory: number; // 終了日 以前の直近在庫（無→0）
  hasAnyInventory: boolean; // 棚卸が一度でも入力されているか（注記用）
};

/** 1店舗1期間の集計指標（派生値） */
export type StorePeriodMetrics = StorePeriodActuals & {
  cogs: number; // 売上原価 = 期首在庫 + 仕入 − 期末在庫
  grossProfit: number; // 粗利の額 = 売上 − 売上原価
  marginProfit: number; // 差益の額 = 売上 − 仕入
  budgetPct: number | null; // 売上の予算比 = 売上 ÷ 予算 ×100（予算0/無→null）
  grossMarginPct: number | null; // 粗利率 = 粗利 ÷ 売上 ×100（売上0→null）
  marginPct: number | null; // 差益率 = 差益 ÷ 売上 ×100（売上0→null）
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** 指定日(YYYY-MM-DD)の前日を返す（UTCで安全に1日減算） */
export function prevDayISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 当該店舗に棚卸データが一度でも存在するか（行があるか） */
async function hasAnyInventory(supabase: SupabaseServerClient, storeId: string): Promise<boolean> {
  const { count } = await supabase
    .from('inventory_estimates')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId);
  return (count ?? 0) > 0;
}

/** 1店舗1期間の実績を取得（PL と同じ集計・在庫補完を再利用） */
export async function aggregateStorePeriod(
  supabase: SupabaseServerClient,
  storeId: string,
  start: string,
  end: string,
): Promise<StorePeriodActuals> {
  const openingDate = prevDayISO(start); // 期首在庫＝開始日の前日以前の直近

  const [netSales, budget, purchases, opening, closing, anyInventory] = await Promise.all([
    sumBetween(supabase, 'daily_sales', 'net_sales', storeId, 'business_date', start, end, {
      day_period: 'all',
    }),
    sumBetween(supabase, 'daily_targets', 'target_sales', storeId, 'target_date', start, end),
    // 売上原価・差益は売上原価区分('cogs')の仕入のみ（販管費区分 'sga' は除外）
    sumPurchasesByCostType(supabase, storeId, start, end, 'cogs'),
    getInventorySnapshotOnOrBefore(supabase, storeId, openingDate),
    getInventorySnapshotOnOrBefore(supabase, storeId, end),
    hasAnyInventory(supabase, storeId),
  ]);

  return {
    netSales,
    budget,
    purchases,
    openingInventory: opening.found ? opening.amount : 0,
    closingInventory: closing.found ? closing.amount : 0,
    hasAnyInventory: anyInventory,
  };
}

/** グループ合計（純粋関数の入力：各行の指標＋通貨＋円換算レート） */
export type GroupTotalInputRow = {
  metrics: StorePeriodMetrics;
  currencyId: string;
  rate: number | null; // 現地通貨→JPY（無→null）
};

/** グループ合計行 */
export type GroupTotal = {
  memberCount: number;
  /** 全行が同一通貨ならその通貨id・混在なら null（現地通貨合計の可否） */
  sameCurrencyId: string | null;
  /** 現地通貨合計（同一通貨のときのみ・絶対額） */
  local: { netSales: number; grossProfit: number; marginProfit: number; closingInventory: number } | null;
  /** 円換算合計（全行のレートが揃っているときのみ・絶対額） */
  jpy: { netSales: number; grossProfit: number; marginProfit: number; closingInventory: number } | null;
  /** 比率（同一通貨→現地合計から／混在→JPY合計から／不能→null） */
  budgetPct: number | null;
  grossMarginPct: number | null;
  marginPct: number | null;
};

const round1 = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

/**
 * グループ合計を算出（純粋関数）。
 *   - 絶対額：現地通貨は同一通貨のときのみ／円換算は全行レート揃いのときのみ。
 *   - 比率：同一通貨なら現地合計から、混在ならJPY合計から、いずれも不能なら null。
 *   - 棚卸未入力の店は在庫0として算入済み（各行の metrics に反映済み）。
 */
export function computeGroupTotal(rows: GroupTotalInputRow[]): GroupTotal {
  const sum = (f: (r: GroupTotalInputRow) => number): number => rows.reduce((s, r) => s + f(r), 0);

  // 現地通貨の素合計（同一通貨のときだけ意味を持つ）
  const localNet = sum((r) => r.metrics.netSales);
  const localBudget = sum((r) => r.metrics.budget);
  const localPurch = sum((r) => r.metrics.purchases);
  const localOpen = sum((r) => r.metrics.openingInventory);
  const localClose = sum((r) => r.metrics.closingInventory);
  const localCogs = localOpen + localPurch - localClose;
  const localGross = localNet - localCogs;
  const localMargin = localNet - localPurch;

  const currencies = new Set(rows.map((r) => r.currencyId));
  const sameCurrencyId = currencies.size === 1 ? [...currencies][0] : null;
  const local =
    sameCurrencyId !== null
      ? { netSales: localNet, grossProfit: localGross, marginProfit: localMargin, closingInventory: localClose }
      : null;

  // 円換算合計（全行のレートが揃っているときのみ）
  const allRates = rows.length > 0 && rows.every((r) => r.rate !== null);
  let jpy: GroupTotal['jpy'] = null;
  let jpyNet = 0;
  let jpyBudget = 0;
  let jpyGross = 0;
  let jpyMargin = 0;
  if (allRates) {
    jpyNet = sum((r) => r.metrics.netSales * (r.rate as number));
    jpyBudget = sum((r) => r.metrics.budget * (r.rate as number));
    const jpyPurch = sum((r) => r.metrics.purchases * (r.rate as number));
    const jpyOpen = sum((r) => r.metrics.openingInventory * (r.rate as number));
    const jpyClose = sum((r) => r.metrics.closingInventory * (r.rate as number));
    const jpyCogs = jpyOpen + jpyPurch - jpyClose;
    jpyGross = jpyNet - jpyCogs;
    jpyMargin = jpyNet - jpyPurch;
    jpy = { netSales: jpyNet, grossProfit: jpyGross, marginProfit: jpyMargin, closingInventory: jpyClose };
  }

  // 比率の基準：同一通貨→現地合計／混在→JPY合計／不能→null
  let budgetPct: number | null = null;
  let grossMarginPct: number | null = null;
  let marginPct: number | null = null;
  if (sameCurrencyId !== null) {
    budgetPct = round1(localNet, localBudget);
    grossMarginPct = round1(localGross, localNet);
    marginPct = round1(localMargin, localNet);
  } else if (allRates) {
    budgetPct = round1(jpyNet, jpyBudget);
    grossMarginPct = round1(jpyGross, jpyNet);
    marginPct = round1(jpyMargin, jpyNet);
  }

  return {
    memberCount: rows.length,
    sameCurrencyId,
    local,
    jpy,
    budgetPct,
    grossMarginPct,
    marginPct,
  };
}

/** 実績から派生指標を計算（純粋関数） */
export function computeStorePeriodMetrics(a: StorePeriodActuals): StorePeriodMetrics {
  const cogs = a.openingInventory + a.purchases - a.closingInventory;
  const grossProfit = a.netSales - cogs;
  const marginProfit = a.netSales - a.purchases;
  const ratio = (num: number, den: number): number | null =>
    den > 0 ? Math.round((num / den) * 1000) / 10 : null; // 小数1位
  return {
    ...a,
    cogs,
    grossProfit,
    marginProfit,
    budgetPct: ratio(a.netSales, a.budget),
    grossMarginPct: ratio(grossProfit, a.netSales),
    marginPct: ratio(marginProfit, a.netSales),
  };
}
