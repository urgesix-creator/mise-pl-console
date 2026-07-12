// サイトURL関連の共通ヘルパー（QRコード・メールリンク等で参照）。
// 本番URLは CLAUDE.md のデプロイ節と一致。環境変数が無い場合のフォールバック。
const FALLBACK_SITE_URL = 'https://sales-console-rho.vercel.app';

/** 末尾スラッシュを除いたサイトURL（例：https://sales-console-rho.vercel.app） */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');
}

/** ログイン画面の絶対URL */
export function loginUrl(): string {
  return `${siteUrl()}/login`;
}
