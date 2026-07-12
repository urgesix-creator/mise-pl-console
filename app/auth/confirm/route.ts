import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ====================================================================
// メールリンク（パスワードリセット・招待）→ セッション確立ルート
//
//   Supabase の SSR 推奨方式（token_hash + verifyOtp）。端末・ブラウザを
//   またいでも動作する（PKCE の code_verifier クッキーに依存しない）。
//
//   メールテンプレートのリンク先をこのルートにする：
//     {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/change-password
//     （招待は type=invite）
//
//   verifyOtp 成功でセッションクッキーが張られ、next（/change-password）で
//   updateUser によるパスワード設定が可能になる。
//   後方互換：?code=（PKCE）が来た場合は exchangeCodeForSession も試みる。
//   ※ redirect() は next/navigation のもの（保留中のクッキー変更を確実に反映する）。
// ====================================================================

/** next はオープンリダイレクト防止のため自サイト内の絶対パスのみ許可 */
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/change-password';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  const supabase = await createClient();

  // 方式1（推奨・端末をまたげる）：token_hash + verifyOtp
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  // 方式2（後方互換）：PKCE の ?code= を交換（同一ブラウザ発行時のみ成立）
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  // 失敗：リンク無効/期限切れ。ログインへ（再発行を案内）
  redirect('/login?error=link_invalid');
}
