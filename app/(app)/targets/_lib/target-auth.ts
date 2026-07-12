// ====================================================================
// 売上予算の書き込み権限・店舗スコープ判定（共通ヘルパー）
//
//   - カレンダー手入力の保存Action（target-input-actions）が使用する。
//   - 既存の Excel取り込みAction（target-import-actions）は変更しない（独自に同等判定を持つ）。
//   - 権限：店長以上（executive / country_rep / store_manager）。staff・accounting 不可。
//     daily_targets の書込RLS と一致（最終防衛線は RLS）。
//   - このファイルは Server Action ではない通常モジュール（'use server' を付けない）。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** 売上予算を書き込めるロール（店長以上） */
export const TARGET_WRITE_ROLES = ['executive', 'country_rep', 'store_manager'] as const;

export type TargetAuthResult =
  | { ok: false; error: string }
  | { ok: true; supabase: SupabaseServerClient; storeName: string };

/**
 * 認証・ロール（店長以上）・店舗スコープを検証する。
 * 成功時は supabase クライアントと店舗名を返す（呼び出し側で書き込みに使う）。
 */
export async function ensureTargetWriteAccess(storeId: string): Promise<TargetAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country_id, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { ok: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'targets'))) {
    return { ok: false, error: '売上予算の編集権限がありません' };
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, country_id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (storeError) return { ok: false, error: `店舗情報の取得に失敗しました: ${storeError.message}` };
  if (!store) return { ok: false, error: 'アクセス可能な店舗が見つかりません' };
  if (!store.is_active) return { ok: false, error: 'この店舗は無効化されています' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { ok: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager') {
    const { data: assignment } = await supabase
      .from('user_store_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!assignment) return { ok: false, error: '担当店舗外です' };
  }
  // executive は全店アクセス可

  return { ok: true, supabase, storeName: store.name };
}
