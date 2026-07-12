'use server';

// ====================================================================
// プロフィール（本人）Server Actions
//   - 氏名の変更、パスワードの変更（現在のパスワードを再認証で検証）。
//   - role / country / is_active 等の特権列は変更しない（031 トリガーでも保護）。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase/server';

type Result = { success: true } | { success: false; error: string };

const nameSchema = z
  .string()
  .trim()
  .min(1, '氏名を入力してください')
  .max(100, '氏名は100文字以内で入力してください');

/** 自分の表示名を変更 */
export async function updateMyName(displayName: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  const parsed = nameSchema.safeParse(displayName);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力を確認してください' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data })
    .eq('id', user.id);
  if (error) return { success: false, error: `更新に失敗しました: ${error.message}` };

  revalidatePath('/profile');
  revalidatePath('/dashboard');
  return { success: true };
}

/** 自分のパスワードを変更（現在のパスワードを検証してから更新） */
export async function updateMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { success: false, error: '認証が必要です' };

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { success: false, error: '新しいパスワードは8文字以上で設定してください' };
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { success: false, error: 'パスワードは英字と数字を含めてください' };
  }
  if (currentPassword === newPassword) {
    return { success: false, error: '現在のパスワードと異なるものを設定してください' };
  }

  // 現在のパスワードを検証（実セッションを汚さない検証専用クライアント）
  const verify = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
  const { error: reauthErr } = await verify.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthErr) return { success: false, error: '現在のパスワードが正しくありません' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: `パスワードの更新に失敗しました: ${error.message}` };

  return { success: true };
}
