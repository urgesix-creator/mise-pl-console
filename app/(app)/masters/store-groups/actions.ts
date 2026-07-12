'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { storeGroupFormSchema, type StoreGroupFormData } from './_schemas';

type ActionResult = { success: true } | { success: false; error: string };

async function ensureWritePermission(): Promise<ActionResult | null> {
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
    return { success: false, error: '店舗グループの編集権限がありません' };
  }
  return null;
}

function revalidate(): void {
  revalidatePath('/masters/store-groups');
  revalidatePath('/period-summary');
}

/**
 * 所属の差分保存：
 *   - 選択された店舗は UPSERT（ON CONFLICT (group_id, store_id) DO UPDATE is_active=true）
 *   - 既存で有効だが選択から外れた店舗は is_active=false に UPDATE（論理削除）
 * 物理 DELETE は行わない。
 */
async function syncMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  storeIds: string[],
): Promise<{ error: string } | null> {
  // 既存の所属（全件・is_active 問わず）
  const { data: existing, error: exError } = await supabase
    .from('store_group_members')
    .select('store_id, is_active')
    .eq('group_id', groupId);
  if (exError) return { error: `所属の取得に失敗しました: ${exError.message}` };

  const selected = new Set(storeIds);

  // 追加・再所属：UPSERT で is_active=true
  if (storeIds.length > 0) {
    const rows = storeIds.map((sid) => ({ group_id: groupId, store_id: sid, is_active: true }));
    const { error: upError } = await supabase
      .from('store_group_members')
      .upsert(rows, { onConflict: 'group_id,store_id' });
    if (upError) return { error: `所属の保存に失敗しました: ${upError.message}` };
  }

  // 解除：現在 is_active=true で選択から外れた店舗を is_active=false に（論理削除）
  const toDeactivate = (existing ?? [])
    .filter((m) => m.is_active && !selected.has(m.store_id))
    .map((m) => m.store_id);
  if (toDeactivate.length > 0) {
    const { error: deError } = await supabase
      .from('store_group_members')
      .update({ is_active: false })
      .eq('group_id', groupId)
      .in('store_id', toDeactivate);
    if (deError) return { error: `所属の解除に失敗しました: ${deError.message}` };
  }

  return null;
}

/** グループを追加（store_groups に INSERT ＋ 所属を UPSERT） */
export async function createStoreGroup(input: StoreGroupFormData): Promise<ActionResult> {
  const parsed = storeGroupFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from('store_groups')
    .insert({
      name: parsed.data.name,
      display_order: parsed.data.display_order,
      is_active: true,
    })
    .select('id')
    .single();
  if (error || !created) {
    return { success: false, error: `保存に失敗しました: ${error?.message ?? 'unknown'}` };
  }

  const memberError = await syncMembers(supabase, created.id, parsed.data.store_ids);
  if (memberError) return { success: false, error: memberError.error };

  revalidate();
  return { success: true };
}

/** グループを更新（名前・表示順 ＋ 所属の差分保存） */
export async function updateStoreGroup(
  id: string,
  input: StoreGroupFormData,
): Promise<ActionResult> {
  const parsed = storeGroupFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();

  const { error } = await supabase
    .from('store_groups')
    .update({ name: parsed.data.name, display_order: parsed.data.display_order })
    .eq('id', id);
  if (error) return { success: false, error: `更新に失敗しました: ${error.message}` };

  const memberError = await syncMembers(supabase, id, parsed.data.store_ids);
  if (memberError) return { success: false, error: memberError.error };

  revalidate();
  return { success: true };
}

/** グループの有効・無効を切替（論理削除。物理削除はしない） */
export async function setStoreGroupActive(id: string, isActive: boolean): Promise<ActionResult> {
  const denied = await ensureWritePermission();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from('store_groups').update({ is_active: isActive }).eq('id', id);
  if (error) return { success: false, error: `処理に失敗しました: ${error.message}` };

  revalidate();
  return { success: true };
}
