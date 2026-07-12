/**
 * ビジネスロジック共通関数
 * - 達成率計算・色分け
 * - 税・サービス料計算
 * - JPY換算
 * - 数値・日付フォーマット
 */

import type { Country, Store, ExchangeRate } from '@/types/database';

// ====================================================================
// 達成率（システム全体共通ルール v2.1）
// ====================================================================

export type AchievementLevel = 'success' | 'neutral' | 'warning';

/**
 * 達成率に応じた色分けレベル取得
 * - 100%以上: success（緑）
 * - 95%以上100%未満: neutral（黒）
 * - 95%未満: warning（朱色）
 */
export function getAchievementLevel(pct: number): AchievementLevel {
  if (pct >= 100) return 'success';
  if (pct >= 95) return 'neutral';
  return 'warning';
}

/**
 * 達成率を計算（targetが0/未設定の場合はnull）
 */
export function calcAchievementPct(actual: number, target: number): number | null {
  if (target <= 0) return null;
  return Math.round((actual / target) * 1000) / 10; // 小数1位
}

/**
 * Tailwindクラス取得（バッジ用）
 */
export function getAchievementBadgeClass(pct: number | null): string {
  if (pct === null) return 'bg-slate-100 text-slate-500';
  const level = getAchievementLevel(pct);
  switch (level) {
    case 'success': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'neutral': return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'warning': return 'bg-rose-50 text-rose-700 border border-rose-200';
  }
}

/**
 * Tailwindクラス取得（バー用）
 */
export function getAchievementBarClass(pct: number | null): string {
  if (pct === null) return 'bg-slate-300';
  const level = getAchievementLevel(pct);
  switch (level) {
    case 'success': return 'bg-emerald-500';
    case 'neutral': return 'bg-slate-900';
    case 'warning': return 'bg-rose-500';
  }
}

// ====================================================================
// 税・サービス料計算
// ====================================================================

export type TaxBreakdown = {
  netSales: number;       // 税抜売上
  serviceFee: number;     // サービス料
  taxAmount: number;      // 税額
  grossSales: number;     // 税込総額（input値と一致するはず）
};

/**
 * 税込売上から税抜・サービス料・税額を逆算
 *
 * タイ（tax_base='net_sales'）：
 *   税抜 × (1 + サービス料率) × (1 + 税率) = 税込
 *   サービス料 = 税抜 × サービス料率
 *   税額 = 税抜 × 税率
 *
 * インドネシア（tax_base='net_plus_service'）：
 *   (税抜 + サービス料) × (1 + 税率) = 税込
 *   サービス料 = 税抜 × サービス料率
 *   税額 = (税抜 + サービス料) × 税率
 *
 * @param grossSales 税込総額
 * @param serviceFeeRate サービス料率（0.10 = 10%）
 * @param taxRate 税率（0.07 = 7%）
 * @param taxBase 課税ベース
 */
export function calculateTaxBreakdown(
  grossSales: number,
  serviceFeeRate: number,
  taxRate: number,
  taxBase: 'net_sales' | 'net_plus_service'
): TaxBreakdown {
  let netSales: number;
  let serviceFee: number;
  let taxAmount: number;

  if (taxBase === 'net_sales') {
    // 税抜売上のみに課税
    // gross = net × (1 + service_rate) × (1 + tax_rate) ... ではなく
    // gross = net + (net × service_rate) + (net × tax_rate) として計算
    // gross = net × (1 + service_rate + tax_rate)
    netSales = grossSales / (1 + serviceFeeRate + taxRate);
    serviceFee = netSales * serviceFeeRate;
    taxAmount = netSales * taxRate;
  } else {
    // 税抜＋サービス料に課税（インドネシア）
    // gross = (net + service) × (1 + tax_rate)
    // gross = net × (1 + service_rate) × (1 + tax_rate)
    netSales = grossSales / ((1 + serviceFeeRate) * (1 + taxRate));
    serviceFee = netSales * serviceFeeRate;
    taxAmount = (netSales + serviceFee) * taxRate;
  }

  return {
    netSales: Math.round(netSales * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    grossSales,
  };
}

/**
 * 店舗・国マスタから直接計算
 */
export function calculateStoreTaxBreakdown(
  grossSales: number,
  store: Pick<Store, 'service_fee_rate'>,
  country: Pick<Country, 'tax_rate' | 'tax_base'>
): TaxBreakdown {
  return calculateTaxBreakdown(
    grossSales,
    store.service_fee_rate,
    country.tax_rate,
    country.tax_base
  );
}

// ====================================================================
// JPY 換算（月末レート方式 v2.2）
// ====================================================================

/**
 * 原通貨をJPYに換算
 * 月末レート方式：登録されている最新レートで換算（履歴は使わない）
 *
 * @param amount 原通貨金額
 * @param fromCurrencyId 元通貨ID（'thb', 'idr' 等）
 * @param exchangeRates 為替レートのリスト
 * @returns JPY金額。レート未登録ならnull
 */
export function convertToJpy(
  amount: number,
  fromCurrencyId: string,
  exchangeRates: Pick<ExchangeRate, 'from_currency_id' | 'to_currency_id' | 'rate'>[]
): number | null {
  if (fromCurrencyId === 'jpy') return amount;
  const rate = exchangeRates.find(
    r => r.from_currency_id === fromCurrencyId && r.to_currency_id === 'jpy'
  );
  if (!rate) return null;
  return amount * rate.rate;
}

// ====================================================================
// フォーマッタ
// ====================================================================

/**
 * 数値を3桁カンマ区切りで表示
 */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US');
}

/**
 * JPY金額を簡略表示（億・万）
 */
export function formatJpyShort(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(1)}万`;
  return `¥${formatNumber(n)}`;
}

/**
 * 通貨記号付きで金額表示
 */
export function formatCurrency(amount: number | null | undefined, symbol: string): string {
  if (amount === null || amount === undefined) return '—';
  return `${symbol}${formatNumber(amount)}`;
}

/**
 * パーセント表示
 */
export function formatPercent(pct: number | null | undefined, decimals = 0): string {
  if (pct === null || pct === undefined) return '—';
  return `${pct.toFixed(decimals)}%`;
}

/**
 * 日付YYYY-MM-DD化
 */
export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 日本語日付フォーマット
 */
export function formatJpDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 曜日取得（漢字）
 */
export function getDayOfWeekJp(dateStr: string): string {
  const d = new Date(dateStr);
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
}

// ====================================================================
// 数値パース（カンマ区切り対応）
// ====================================================================

export function parseNumber(input: string | number): number {
  if (typeof input === 'number') return input;
  const cleaned = String(input).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}
