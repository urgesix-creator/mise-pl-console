/**
 * 多言語対応の設定とロケール定数
 * 国内向けフォーク（みせPL）: 日本語のみ対応（ja単独）
 */

// ====================================================================
// ロケール定義（国内MVPは日本語のみ）
// ====================================================================
export const LOCALES = ['ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ja';

// ====================================================================
// 表示名（各言語の自国語表記）
// ====================================================================
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  ja: '日本語',
};

// 旗（UI表示用）
export const LOCALE_FLAGS: Record<Locale, string> = {
  ja: '🇯🇵',
};

// ====================================================================
// Intl ロケール文字列（Intl.NumberFormat / DateTimeFormat 用）
// ====================================================================
export const INTL_LOCALES: Record<Locale, string> = {
  ja: 'ja-JP',
};

// ====================================================================
// 言語推定（ブラウザ Accept-Language ヘッダから）
// ====================================================================

/**
 * Accept-Language ヘッダから対応する Locale を推定
 * 国内MVPでは日本語固定のため常に 'ja' を返す。
 */
export function detectLocaleFromHeader(_acceptLanguage: string | null): Locale {
  return DEFAULT_LOCALE;
}

/**
 * 文字列が有効な Locale か判定
 */
export function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// ====================================================================
// 国コードから推奨言語を取得（国内MVPは日本語固定）
// ====================================================================
export function suggestLocaleByCountry(_countryId: string): Locale {
  return DEFAULT_LOCALE;
}
