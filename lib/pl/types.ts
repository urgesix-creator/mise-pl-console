// ====================================================================
// 月次PL集計の共通型（DB非依存）
//
//   - Estimate<T>：計算可（値＋任意フラグ）／計算不可（理由）を表す判別ユニオン。
//     lib は「判定」だけを返し、表示（—やフラグ注記）はしない（画面層の責務）。
//   - すべて現地通貨で算出する前提（円換算は次のステップ）。
// ====================================================================

/** 計算不可の理由 */
export type EstimateReason =
  | 'no_budget' // 予算累計が0（予算未入力）→ 予算ベース売上予測が不能
  | 'no_elapsed_days' // 経過営業日数が0（月初・営業日0）→ 仕入れ予測が不能
  | 'no_business_days'; // 当月営業日数が未入力（monthly_business_days 無）→ 仕入れ予測が不能

/** 計算は継続するが精度に注意を要するフラグ */
export type EstimateFlag =
  | 'no_opening_inventory' // 期首在庫のスナップショットなし（0扱いで計算）
  | 'no_latest_inventory'; // 直近在庫のスナップショットなし（0扱いで計算）

/** 計算結果：値（＋任意フラグ）or 計算不可（理由） */
export type Estimate<T> =
  | { ok: true; value: T; flags: EstimateFlag[] }
  | { ok: false; reason: EstimateReason };

export function ok<T>(value: T, flags: EstimateFlag[] = []): Estimate<T> {
  return { ok: true, value, flags };
}
export function unavailable<T>(reason: EstimateReason): Estimate<T> {
  return { ok: false, reason };
}

/** 原価予測の内訳（すべて現地通貨） */
export type CostResult = {
  /** 原価＝期首在庫＋仕入れ予測−直近在庫 */
  cost: number;
  /** 仕入れ予測＝仕入れ累計÷経過営業日数×当月営業日数 */
  purchaseForecast: number;
  openingInventory: number;
  latestInventory: number;
  purchaseCum: number;
  elapsedBusinessDays: number;
  monthBusinessDays: number;
};

/** 売上予測（予算ベース）の内訳（すべて現地通貨・net_sales 税抜基準） */
export type SalesForecastResult = {
  /** 売上予測＝実績累計÷予算累計×月予算総計 */
  forecast: number;
  actualCum: number;
  budgetCum: number;
  budgetMonthTotal: number;
};

/** 対象月（'YYYY-MM'）から導く境界日（すべて 'YYYY-MM-DD' 文字列・タイムゾーン非依存） */
export type MonthBounds = {
  /** 当月初日 YYYY-MM-01 */
  monthStart: string;
  /** 当月末日 */
  monthEnd: string;
  /** 前月末日（期首在庫の基準） */
  prevMonthEnd: string;
  /** 当月の月初DATE（monthly_business_days.year_month 検索用＝monthStart と同値） */
  yearMonthDate: string;
};
