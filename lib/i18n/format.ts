/**
 * ロケール対応のフォーマッタ
 * 言語に応じた数値・日付・通貨表示
 */

import { INTL_LOCALES, type Locale } from './locales';

// ====================================================================
// 数値フォーマット
// ====================================================================

/**
 * ロケール別の数値フォーマット
 * - ja/en: 1,234,567
 * - id: 1.234.567
 */
export function formatNumber(n: number | null | undefined, locale: Locale): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(n);
}

/**
 * 通貨記号付き金額表示（記号は言語によらず統一）
 * @example formatCurrency(85600, '฿', 'th') → '฿85,600'
 */
export function formatCurrency(
  amount: number | null | undefined,
  symbol: string,
  locale: Locale
): string {
  if (amount === null || amount === undefined) return '—';
  return `${symbol}${formatNumber(amount, locale)}`;
}

/**
 * JPY 簡略表示（億・万）
 * 日本語以外では full number で表示
 */
export function formatJpyShort(n: number | null | undefined, locale: Locale): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  
  if (locale === 'ja') {
    if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
    if (n >= 10_000) return `¥${(n / 10_000).toFixed(1)}万`;
  } else {
    // 英語等では K/M 形式
    if (n >= 1_000_000_000) return `¥${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `¥${(n / 1_000).toFixed(1)}K`;
  }
  return `¥${formatNumber(n, locale)}`;
}

/**
 * パーセント表示
 */
export function formatPercent(
  pct: number | null | undefined,
  locale: Locale,
  decimals = 0
): string {
  if (pct === null || pct === undefined) return '—';
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(pct) + '%';
}

// ====================================================================
// 日付フォーマット
// ====================================================================

/**
 * 標準的な日付表示
 * - ja: 2026年5月10日
 * - en: May 10, 2026
 * - th: 10 พฤษภาคม 2026
 * - id: 10 Mei 2026
 */
export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * 短縮日付表示
 * - ja: 2026/05/10
 * - en: May 10
 * - th: 10 พ.ค.
 * - id: 10 Mei
 */
export function formatDateShort(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (locale === 'ja') {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * 月年表示
 * - ja: 2026年5月
 * - en: May 2026
 * - th: พฤษภาคม 2026
 * - id: Mei 2026
 */
export function formatMonthYear(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (locale === 'ja') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    year: 'numeric',
    month: 'long',
  }).format(d);
}

/**
 * 時刻表示
 */
export function formatTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * 相対時間（〜分前、〜時間前 等）
 */
export function formatRelativeTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: 'auto' });
  
  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');
  if (diffDay < 30) return rtf.format(-diffDay, 'day');
  return formatDateShort(d, locale);
}

// ====================================================================
// 曜日表示
// ====================================================================

/**
 * 曜日（短縮形）
 * - ja: 日月火水木金土
 * - en: Sun, Mon, Tue, ...
 * - th/id: 各言語の短縮形
 */
export function getDayOfWeek(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (locale === 'ja') {
    return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  }
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'short' }).format(d);
}

/**
 * 曜日が週末か判定
 */
export function isWeekend(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}
