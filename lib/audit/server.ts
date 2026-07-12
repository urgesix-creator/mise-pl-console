// ====================================================================
// 監査ログ記録ヘルパー（server）
//   - 機微な管理操作（権限変更・ユーザー管理）から呼び、audit_logs に追記する。
//   - best-effort：記録に失敗しても本来の操作は失敗させない。
//   - 操作者は現在のセッション（auth.uid()）。RLS の insert_self と整合。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export type AuditEntry = {
  action: string;
  targetType?: string | null;
  targetLabel?: string | null;
  details?: Json | null;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_label: entry.targetLabel ?? null,
      details: entry.details ?? null,
    });
  } catch {
    // best-effort（監査記録の失敗で本来の操作は失敗させない）
  }
}
