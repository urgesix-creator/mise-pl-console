// ====================================================================
// 月次PL 予測の純関数（DB非依存・副作用なし・単体テスト容易）
//
//   - projectSalesByBudget：予算ベース売上予測（実績累計÷予算累計×月予算総計）。
//   - projectCost：営業日数ベースの原価（統一式：期首在庫＋仕入れ予測−直近在庫）。
//     月末で仕入れ予測が実績に・直近在庫が月末在庫に収束し、確定原価に一致する。
//   - すべて現地通貨。数値だけを受け取り Estimate を返す（DBに触れない）。
// ====================================================================

import {
  ok,
  unavailable,
  type Estimate,
  type EstimateFlag,
  type CostResult,
  type SalesForecastResult,
} from './types';

/** 小数2桁に丸める（金額表示の安定化。判定には影響しない） */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 予算ベース売上予測。
 *   売上予測 = 実績累計 ÷ 予算累計 × 月予算総計
 * 予算累計が0以下（予算未入力）はゼロ除算回避で計算不可（no_budget）。
 */
export function projectSalesByBudget(
  actualCum: number,
  budgetCum: number,
  budgetMonthTotal: number,
): Estimate<SalesForecastResult> {
  if (!(budgetCum > 0)) {
    return unavailable('no_budget');
  }
  const forecast = round2((actualCum / budgetCum) * budgetMonthTotal);
  return ok({ forecast, actualCum, budgetCum, budgetMonthTotal });
}

export type ProjectCostInput = {
  /** 期首在庫（前月末以前の最新スナップショット。無ければ0＋フラグ） */
  openingInventory: number;
  /** 直近在庫（asOf以前の最新スナップショット。無ければ0＋フラグ） */
  latestInventory: number;
  /** 当月の仕入れ累計（asOfまで） */
  purchaseCum: number;
  /** 経過営業日数（is_closed=false の日数） */
  elapsedBusinessDays: number;
  /** 当月営業日数（monthly_business_days。未入力は null） */
  monthBusinessDays: number | null;
  /** 在庫データなしフラグ（呼び出し側で付与） */
  flags?: EstimateFlag[];
};

/**
 * 営業日数ベースの原価（統一式）。
 *   仕入れ予測 = 仕入れ累計 ÷ 経過営業日数 × 当月営業日数
 *   原価       = 期首在庫 + 仕入れ予測 − 直近在庫
 * - 当月営業日数が未入力（null）→ 計算不可（no_business_days）。
 * - 経過営業日数が0以下 → 計算不可（no_elapsed_days）。
 * - 在庫なし（0扱い）はフラグで継続（—にしない）。
 */
export function projectCost(input: ProjectCostInput): Estimate<CostResult> {
  const {
    openingInventory,
    latestInventory,
    purchaseCum,
    elapsedBusinessDays,
    monthBusinessDays,
    flags = [],
  } = input;

  if (monthBusinessDays === null) {
    return unavailable('no_business_days');
  }
  if (!(elapsedBusinessDays > 0)) {
    return unavailable('no_elapsed_days');
  }

  const purchaseForecast = round2((purchaseCum / elapsedBusinessDays) * monthBusinessDays);
  const cost = round2(openingInventory + purchaseForecast - latestInventory);

  return ok(
    {
      cost,
      purchaseForecast,
      openingInventory,
      latestInventory,
      purchaseCum,
      elapsedBusinessDays,
      monthBusinessDays,
    },
    flags,
  );
}

/** 'YYYY-MM'（または monthStart 'YYYY-MM-DD'）から月境界の各日付文字列を導く（TZ非依存） */
export function computeMonthBounds(yearMonth: string): {
  monthStart: string;
  monthEnd: string;
  prevMonthEnd: string;
  yearMonthDate: string;
} {
  // yearMonth は 'YYYY-MM' か 'YYYY-MM-DD'。先頭の年月だけ使う。
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const pad = (n: number) => String(n).padStart(2, '0');
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthStart = `${y}-${pad(m)}-01`;
  const monthEnd = `${y}-${pad(m)}-${pad(daysInMonth)}`;
  // 前月末日
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevDays = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const prevMonthEnd = `${prevY}-${pad(prevM)}-${pad(prevDays)}`;
  return { monthStart, monthEnd, prevMonthEnd, yearMonthDate: monthStart };
}
