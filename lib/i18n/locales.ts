/**
 * 多言語対応の設定とロケール定数
 * 要件定義 v2.3 6.5節 / データモデル v1.6
 */

// ====================================================================
// ロケール定義
// ====================================================================
export const LOCALES = ['ja', 'en', 'th', 'id'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ja';

// ====================================================================
// 表示名（各言語の自国語表記）
// ====================================================================
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  th: 'ภาษาไทย',
  id: 'Bahasa Indonesia',
};

// 旗（UI表示用）
export const LOCALE_FLAGS: Record<Locale, string> = {
  ja: '🇯🇵',
  en: '🌐',
  th: '🇹🇭',
  id: '🇮🇩',
};

// ====================================================================
// Intl ロケール文字列（Intl.NumberFormat / DateTimeFormat 用）
// ====================================================================
export const INTL_LOCALES: Record<Locale, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  th: 'th-TH',
  id: 'id-ID',
};

// ====================================================================
// 言語推定（ブラウザ Accept-Language ヘッダから）
// ====================================================================

/**
 * Accept-Language ヘッダから対応する Locale を推定
 * @example "ja-JP,en-US;q=0.9" → "ja"
 */
export function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  
  const langs = acceptLanguage.toLowerCase();
  
  // 完全一致を優先
  for (const locale of LOCALES) {
    if (langs.includes(locale)) return locale;
  }
  
  // 部分一致（en-USなど）
  if (langs.startsWith('ja')) return 'ja';
  if (langs.startsWith('th')) return 'th';
  if (langs.startsWith('id')) return 'id';
  if (langs.startsWith('en')) return 'en';
  
  return DEFAULT_LOCALE;
}

/**
 * 文字列が有効な Locale か判定
 */
export function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// ====================================================================
// 国コードから推奨言語を取得
// ====================================================================
export function suggestLocaleByCountry(countryId: string): Locale {
  switch (countryId) {
    case 'jp': return 'ja';
    case 'th': return 'th';
    case 'id': return 'id';
    case 'tw': return 'en';  // 中国語繁体字対応はPhase 2
    default: return DEFAULT_LOCALE;
  }
}
