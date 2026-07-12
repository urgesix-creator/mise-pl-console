'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export type LoginState = {
  error?: string;
  success?: boolean;
};

/**
 * ログイン Server Action
 */
export async function signIn(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const rememberMe = formData.get('rememberMe') === 'on';

  if (!email || !password) {
    return { error: 'メールアドレスとパスワードを入力してください' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // 情報漏洩防止：具体的な失敗理由は伝えない
    return { error: 'ログインに失敗しました' };
  }

  // 最終ログイン時刻を更新（失敗してもログインは継続）
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.user.id);

  // 「この端末を信頼する」設定（is_active チェックは (app)/layout.tsx で実施）
  if (rememberMe) {
    (await cookies()).set('trusted_device', 'true', {
      maxAge: 60 * 60 * 24 * 30, // 30日
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  redirect('/dashboard');
}

/**
 * パスワードリセット要求 Server Action
 */
export async function requestPasswordReset(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string;

  if (!email || !email.includes('@')) {
    return { error: '正しいメールアドレスを入力してください' };
  }

  const supabase = await createClient();

  // redirectTo は /auth/confirm（メールリンク→セッション確立ルート）→ /change-password。
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/change-password`,
  });

  // 情報漏洩防止：登録あり/なしに関わらず同じレスポンス
  return { success: true };
}

/**
 * パスワード変更 Server Action（リセットリンク経由）
 */
export async function changePassword(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (newPassword !== confirmPassword) {
    return { error: 'パスワードが一致しません' };
  }

  // バリデーション
  if (newPassword.length < 8) {
    return { error: 'パスワードは8文字以上で設定してください' };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: 'パスワードの更新に失敗しました。リンクの有効期限切れの可能性があります' };
  }

  // 招待受諾の記録：未受諾なら accepted_at を記録（best-effort・失敗してもパスワードは更新済み）
  if (updated?.user?.id) {
    await supabase
      .from('profiles')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', updated.user.id)
      .is('accepted_at', null);
  }

  return { success: true };
}

/**
 * ログアウト Server Action
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete('trusted_device');
  redirect('/login');
}
