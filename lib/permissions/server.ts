// ====================================================================
// 権限（能力×ロール）サーバ側ヘルパー（read-only）
//
//   role_permissions（030）を参照して「ロール×能力」の許可を判定する。
//   RLS が本当の番人だが、Server Action / 画面の出し分けも同じ設定を参照することで
//   3層の判定を一致させる。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { CAPABILITIES, type Capability, type Role } from './constants';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** ロールが能力を持つか（role_permissions を1行参照） */
export async function roleHasCapability(
  supabase: SupabaseServerClient,
  role: string,
  capability: Capability,
): Promise<boolean> {
  const { data } = await supabase
    .from('role_permissions')
    .select('allowed')
    .eq('capability', capability)
    .eq('role', role)
    .maybeSingle();
  return data?.allowed === true;
}

/** 現ユーザーのロールと、許可されている能力集合を取得（画面の出し分け用） */
export async function getMyPermissions(): Promise<{
  role: Role | null;
  capabilities: Set<Capability>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: null, capabilities: new Set() };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { role: null, capabilities: new Set() };

  const { data: rows } = await supabase
    .from('role_permissions')
    .select('capability, allowed')
    .eq('role', profile.role)
    .eq('allowed', true);

  const caps = new Set<Capability>();
  for (const r of (rows ?? []) as { capability: string; allowed: boolean }[]) {
    if ((CAPABILITIES as readonly string[]).includes(r.capability)) {
      caps.add(r.capability as Capability);
    }
  }
  return { role: profile.role as Role, capabilities: caps };
}

/** 全 capability × role の許可マトリクスを取得（権限設定画面用） */
export async function fetchPermissionMatrix(
  supabase: SupabaseServerClient,
): Promise<Record<string, Record<string, boolean>>> {
  const { data } = await supabase.from('role_permissions').select('capability, role, allowed');
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const r of (data ?? []) as { capability: string; role: string; allowed: boolean }[]) {
    (matrix[r.capability] ??= {})[r.role] = r.allowed;
  }
  return matrix;
}
