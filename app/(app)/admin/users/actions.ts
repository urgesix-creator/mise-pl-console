'use server';

// ====================================================================
// ユーザー管理 Server Actions（経営マスタ編集=exec_master 限定）
//
//   - 招待＝仮パスワード発行方式（メール送信なし）。createAdminClient で
//     Supabase Auth に email_confirm 済みアカウントを作成し、仮パスワードを
//     画面に1回だけ返す（管理者が本人へ手動で伝える→初回ログイン後に変更）。
//   - profiles・user_store_assignments の書込は exec_master（RLS）。本Actionでも事前検証。
//   - 自分のロール変更・自分の無効化・自分の削除は禁止（ロックアウト防止）。
//   - 退職等はソフト削除（profiles.is_active=false）が基本。
//     ただし deleteUser は完全削除（例外・2026-06-12 比嘉専務承認）。監査ログに記録。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/server';
import { ROLES } from '@/lib/permissions/constants';

type ActionResult = { success: true } | { success: false; error: string };
type SecretResult =
  | { success: true; tempPassword: string }
  | { success: false; error: string };
/** 招待結果：仮パスワード方式は tempPassword、メール方式は emailed=true を返す */
export type InviteResult =
  | { success: true; method: 'password'; tempPassword: string }
  | { success: true; method: 'email' }
  | { success: false; error: string };

/** user_management 能力を持つアクティブユーザーか検証し、本人IDを返す */
async function ensureExec(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { ok: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'user_management'))) {
    return { ok: false, error: 'ユーザー管理の権限がありません' };
  }
  return { ok: true, userId: user.id };
}

/** URLセーフな仮パスワード（16文字相当・十分な強度） */
function genTempPassword(): string {
  return randomBytes(12).toString('base64url');
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email('メールアドレスが正しくありません').max(200),
  display_name: z.string().trim().min(1, '氏名を入力してください').max(100),
  role: z.enum(ROLES),
  country_id: z.string().trim().nullable().optional(),
  store_ids: z.array(z.string().uuid()).default([]),
  // 招待方式：password=仮パスワード発行（メールなし）／email=招待メール送信
  method: z.enum(['password', 'email']).default('password'),
});
export type CreateUserInput = z.infer<typeof createSchema>;

const updateSchema = z.object({
  display_name: z.string().trim().min(1, '氏名を入力してください').max(100),
  role: z.enum(ROLES),
  country_id: z.string().trim().nullable().optional(),
  store_ids: z.array(z.string().uuid()).default([]),
});
export type UpdateUserInput = z.infer<typeof updateSchema>;

function revalidate(): void {
  revalidatePath('/admin/users');
}

/**
 * 新規ユーザーを作成（認証アカウント＋profile＋店舗割当）。
 *   method='password'：仮パスワードを発行して返す（メール送信なし）。
 *   method='email'   ：招待メールを送信（リンク→/change-password でパスワード設定）。
 *                      ※ 実送信には Supabase の SMTP・リダイレクトURL設定が必要。
 */
export async function createUser(input: CreateUserInput): Promise<InviteResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }
  const guard = await ensureExec();
  if (!guard.ok) return { success: false, error: guard.error };

  const role = parsed.data.role;
  const countryId = parsed.data.country_id?.trim() ? parsed.data.country_id.trim() : null;
  if (role === 'country_rep' && !countryId) {
    return { success: false, error: '各国代表には担当国を指定してください' };
  }
  // 全店アクセスのロール（経営層・経理）は店舗割当不要。店長・現場は割当推奨だが必須にはしない。

  const admin = createAdminClient();
  const useEmail = parsed.data.method === 'email';
  const tempPassword = useEmail ? null : genTempPassword();

  // 1. 認証アカウント作成
  let uid: string;
  if (useEmail) {
    // 招待メール送信（パスワードは本人がリンク先で設定）。
    // redirectTo は /auth/confirm（メールリンク→セッション確立ルート）→ /change-password。
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const options = siteUrl
      ? { redirectTo: `${siteUrl}/auth/confirm?next=/change-password` }
      : undefined;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      options,
    );
    if (inviteErr || !invited?.user) {
      const msg = inviteErr?.message ?? 'unknown';
      if (/already.*registered|exists/i.test(msg)) {
        return { success: false, error: 'このメールアドレスは既に登録されています' };
      }
      return {
        success: false,
        error: `招待メールの送信に失敗しました（Supabaseのメール設定をご確認ください）: ${msg}`,
      };
    }
    uid = invited.user.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: tempPassword as string,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? 'unknown';
      if (/already.*registered|exists/i.test(msg)) {
        return { success: false, error: 'このメールアドレスは既に登録されています' };
      }
      return { success: false, error: `アカウント作成に失敗しました: ${msg}` };
    }
    uid = created.user.id;
  }

  // 2. profile 作成（admin で投入＝作成直後のRLS鶏卵問題を回避）
  const { error: profileErr } = await admin.from('profiles').insert({
    id: uid,
    email: parsed.data.email,
    display_name: parsed.data.display_name,
    role,
    country_id: countryId,
    is_active: true,
    has_2fa: false,
    invited_at: new Date().toISOString(),
    accepted_at: null,
    last_login_at: null,
  });
  if (profileErr) {
    // 失敗時：孤児アカウントを残さないよう認証アカウントを削除（招待のロールバック）
    await admin.auth.admin.deleteUser(uid);
    return { success: false, error: `プロフィール作成に失敗しました: ${profileErr.message}` };
  }

  // 3. 店舗割当（任意）
  if (parsed.data.store_ids.length > 0) {
    const rows = parsed.data.store_ids.map((sid) => ({ user_id: uid, store_id: sid }));
    const { error: assignErr } = await admin.from('user_store_assignments').insert(rows);
    if (assignErr) {
      revalidate();
      return {
        success: false,
        error: `ユーザーは作成しましたが、店舗割当に失敗しました（編集から再設定してください）: ${assignErr.message}`,
      };
    }
  }

  await logAudit({
    action: 'user.create',
    targetType: 'user',
    targetLabel: parsed.data.email,
    details: { role, method: parsed.data.method, stores: parsed.data.store_ids.length },
  });

  revalidate();
  return useEmail
    ? { success: true, method: 'email' }
    : { success: true, method: 'password', tempPassword: tempPassword as string };
}

/** 既存ユーザーの氏名・ロール・国・店舗割当を更新 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }
  const guard = await ensureExec();
  if (!guard.ok) return { success: false, error: guard.error };

  const role = parsed.data.role;
  const countryId = parsed.data.country_id?.trim() ? parsed.data.country_id.trim() : null;
  if (role === 'country_rep' && !countryId) {
    return { success: false, error: '各国代表には担当国を指定してください' };
  }
  // 自分のロール変更は禁止（自分ロックアウト防止）
  if (id === guard.userId) {
    const supabase = await createClient();
    const { data: me } = await supabase.from('profiles').select('role').eq('id', id).single();
    if (me && me.role !== role) {
      return { success: false, error: '自分自身のロールは変更できません（別の経営層に依頼してください）' };
    }
  }

  // 書き込みは admin（service_role）経由。権限は本Actionの user_management 検証＋自己保護で担保し、
  // 直接DBアクセス時は RLS/トリガー（exec_master）が最終防衛線。
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.display_name, role, country_id: countryId })
    .eq('id', id);
  if (error) return { success: false, error: `更新に失敗しました: ${error.message}` };

  // 店舗割当の差分同期（追加＝insert／解除＝delete）
  const { data: existing } = await supabase
    .from('user_store_assignments')
    .select('store_id')
    .eq('user_id', id);
  const current = new Set((existing ?? []).map((r) => r.store_id));
  const selected = new Set(parsed.data.store_ids);
  const toAdd = parsed.data.store_ids.filter((s) => !current.has(s));
  const toRemove = [...current].filter((s) => !selected.has(s));

  if (toAdd.length > 0) {
    const { error: addErr } = await supabase
      .from('user_store_assignments')
      .insert(toAdd.map((sid) => ({ user_id: id, store_id: sid })));
    if (addErr) return { success: false, error: `店舗割当の追加に失敗しました: ${addErr.message}` };
  }
  if (toRemove.length > 0) {
    const { error: rmErr } = await supabase
      .from('user_store_assignments')
      .delete()
      .eq('user_id', id)
      .in('store_id', toRemove);
    if (rmErr) return { success: false, error: `店舗割当の解除に失敗しました: ${rmErr.message}` };
  }

  const { data: target } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
  await logAudit({
    action: 'user.update',
    targetType: 'user',
    targetLabel: target?.email ?? id,
    details: { role, country_id: countryId, stores: parsed.data.store_ids.length },
  });

  revalidate();
  return { success: true };
}

/** 有効/無効の切替（無効化＝ソフト削除）。自分自身は無効化不可 */
export async function setUserActive(id: string, isActive: boolean): Promise<ActionResult> {
  const guard = await ensureExec();
  if (!guard.ok) return { success: false, error: guard.error };
  if (id === guard.userId && !isActive) {
    return { success: false, error: '自分自身を無効化することはできません' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
  if (error) return { success: false, error: `処理に失敗しました: ${error.message}` };

  const { data: target } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
  await logAudit({
    action: isActive ? 'user.activate' : 'user.deactivate',
    targetType: 'user',
    targetLabel: target?.email ?? id,
  });

  revalidate();
  return { success: true };
}

/**
 * ユーザーを完全削除（認証アカウント＋profile＋店舗割当）。自分自身は削除不可。
 * ※ ソフト削除原則の例外（2026-06-12 比嘉専務承認・どのユーザーも削除可）。監査ログに記録する。
 *   取引データ（売上・仕入等）はユーザーを参照しないため帳簿は壊れない。監査ログは actor_email で保全。
 */
export async function deleteUser(id: string): Promise<ActionResult> {
  const guard = await ensureExec();
  if (!guard.ok) return { success: false, error: guard.error };
  if (id === guard.userId) {
    return { success: false, error: '自分自身は削除できません' };
  }

  const admin = createAdminClient();
  // 監査用にメールを先取得（削除後は引けない）
  const { data: target } = await admin.from('profiles').select('email').eq('id', id).maybeSingle();

  // 店舗割当 → profile の順で明示削除（CASCADE 設定の有無に関わらず確実に消す）
  await admin.from('user_store_assignments').delete().eq('user_id', id);
  const { error: pErr } = await admin.from('profiles').delete().eq('id', id);
  if (pErr) return { success: false, error: `削除に失敗しました: ${pErr.message}` };

  // 認証アカウントを削除
  const { error: aErr } = await admin.auth.admin.deleteUser(id);
  if (aErr) {
    return {
      success: false,
      error: `認証アカウントの削除に失敗しました（プロフィールは削除済み・要手動確認）: ${aErr.message}`,
    };
  }

  await logAudit({ action: 'user.delete', targetType: 'user', targetLabel: target?.email ?? id });
  revalidate();
  return { success: true };
}

/** パスワードを再発行（新しい仮パスワードを返す） */
export async function resetUserPassword(id: string): Promise<SecretResult> {
  const guard = await ensureExec();
  if (!guard.ok) return { success: false, error: guard.error };

  const admin = createAdminClient();
  const tempPassword = genTempPassword();
  const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
  if (error) return { success: false, error: `パスワード再発行に失敗しました: ${error.message}` };

  const { data: target } = await admin.from('profiles').select('email').eq('id', id).maybeSingle();
  await logAudit({ action: 'user.reset_password', targetType: 'user', targetLabel: target?.email ?? id });

  return { success: true, tempPassword };
}
