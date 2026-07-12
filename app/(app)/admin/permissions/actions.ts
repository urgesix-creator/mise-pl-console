'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/server';
import {
  CAPABILITIES,
  ROLES,
  LOCKED_PERMISSION,
} from '@/lib/permissions/constants';

type ActionResult = { success: true } | { success: false; error: string };

/** 能力×ロールの許可を更新（executive=exec_master のみ可・seed行をUPDATE） */
export async function updateRolePermission(
  capability: string,
  role: string,
  allowed: boolean,
): Promise<ActionResult> {
  if (!(CAPABILITIES as readonly string[]).includes(capability)) {
    return { success: false, error: '不正な能力です' };
  }
  if (!(ROLES as readonly string[]).includes(role)) {
    return { success: false, error: '不正なロールです' };
  }
  // 自分ロックアウト防止（UIでも無効化するが、サーバ側でも拒否。DBトリガーが最終防衛）
  if (
    capability === LOCKED_PERMISSION.capability &&
    role === LOCKED_PERMISSION.role &&
    !allowed
  ) {
    return { success: false, error: '経営層の「経営マスタ編集」権限は無効化できません' };
  }

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
  if (!(await roleHasCapability(supabase, profile.role, 'exec_master'))) {
    return { success: false, error: '権限設定を変更する権限がありません' };
  }

  const { error } = await supabase
    .from('role_permissions')
    .update({ allowed })
    .eq('capability', capability)
    .eq('role', role);
  if (error) return { success: false, error: `保存に失敗しました: ${error.message}` };

  await logAudit({
    action: 'permission.update',
    targetType: 'role_permission',
    targetLabel: `${capability} / ${role}`,
    details: { allowed },
  });

  revalidatePath('/admin/permissions');
  return { success: true };
}
