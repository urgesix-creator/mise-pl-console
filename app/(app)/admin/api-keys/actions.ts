'use server';

// ====================================================================
// API キー管理 Server Actions（経営マスタ編集=exec_master 限定）
//   - 発行：平文は1回だけ返す（保存はハッシュ）。
//   - read_write（書き込み可）キーは「強力な権限」。発行時にリスク説明への
//     同意（acknowledged=true）が無ければ拒否する。
//   - 失効：is_active=false（論理）。物理削除なし。
//   - 操作は監査ログに記録。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/server';
import { generateApiKey } from '@/lib/api/keys';

type ActionResult = { success: true } | { success: false; error: string };
type CreateResult = { success: true; rawKey: string } | { success: false; error: string };

async function ensureExec(): Promise<{ success: false; error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { success: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'api_keys'))) {
    return { success: false, error: 'APIキーの管理権限がありません' };
  }
  return null;
}

const createSchema = z.object({
  label: z.string().trim().min(1, 'ラベルを入力してください').max(100, '100文字以内で入力してください'),
  scope: z.enum(['read', 'read_write']),
  acknowledged: z.boolean().default(false),
});
export type CreateApiKeyInput = z.infer<typeof createSchema>;

export async function createApiKey(input: CreateApiKeyInput): Promise<CreateResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }
  const denied = await ensureExec();
  if (denied) return denied;

  // 書き込み可キーはリスク同意が必須（「納得してOKをもらった場合のみ」）
  if (parsed.data.scope === 'read_write' && !parsed.data.acknowledged) {
    return { success: false, error: '書き込み可キーの発行にはリスクへの同意が必要です' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { raw, prefix, hash } = generateApiKey();
  const { error } = await supabase.from('api_keys').insert({
    label: parsed.data.label,
    key_prefix: prefix,
    key_hash: hash,
    scope: parsed.data.scope,
    created_by: user?.id ?? null,
  });
  if (error) return { success: false, error: `発行に失敗しました: ${error.message}` };

  await logAudit({
    action: 'api_key.create',
    targetType: 'api_key',
    targetLabel: `${parsed.data.label}（${prefix}…）`,
    details: { scope: parsed.data.scope },
  });

  revalidatePath('/admin/api-keys');
  return { success: true, rawKey: raw };
}

/** キーを失効（論理） */
export async function revokeApiKey(id: string): Promise<ActionResult> {
  const denied = await ensureExec();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: key } = await supabase.from('api_keys').select('label, key_prefix').eq('id', id).maybeSingle();
  const { error } = await supabase.from('api_keys').update({ is_active: false }).eq('id', id);
  if (error) return { success: false, error: `失効に失敗しました: ${error.message}` };

  await logAudit({
    action: 'api_key.revoke',
    targetType: 'api_key',
    targetLabel: key ? `${key.label}（${key.key_prefix}…）` : id,
  });

  revalidatePath('/admin/api-keys');
  return { success: true };
}
