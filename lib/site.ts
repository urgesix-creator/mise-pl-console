// サイトURL関連の共通ヘルパー（QRコード・メールリンク等で参照）。
// 環境変数 NEXT_PUBLIC_SITE_URL を優先。無い場合のフォールバックはローカル開発URL。
// 本番URLは Vercel の環境変数で指定する（フォールバックに本番URLは埋め込まない）。
const FALLBACK_SITE_URL = 'http://localhost:3000';

/** 末尾スラッシュを除いたサイトURL */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');
}

/** ログイン画面の絶対URL */
export function loginUrl(): string {
  return `${siteUrl()}/login`;
}
