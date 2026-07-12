// ====================================================================
// REST API キーの生成・検証（server）
//   - 平文は保存しない（sha256 ハッシュで照合）。
//   - Bearer トークンを検証し、scope（read/read_write）を返す。
//   - 書き込みは read_write スコープが必須（「強力な権限」）。
// ====================================================================

import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';

export type ApiScope = 'read' | 'read_write';

/** 新しいAPIキーを生成（平文・表示用prefix・保存用hash） */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `sc_${randomBytes(24).toString('base64url')}`;
  const prefix = raw.slice(0, 11); // 'sc_' + 先頭8文字（識別用）
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export type ApiAuthResult =
  | { ok: true; keyId: string; scope: ApiScope }
  | { ok: false; status: number; error: string };

/**
 * リクエストの Authorization: Bearer <key> を検証する。
 * need='read_write' の場合は read_write スコープを要求する。
 */
export async function authenticateApiRequest(
  req: Request,
  need: ApiScope,
): Promise<ApiAuthResult> {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Authorization: Bearer <APIキー> が必要です' };
  }
  const raw = match[1].trim();
  const hash = hashApiKey(raw);

  const admin = createAdminClient();
  const { data: key } = await admin
    .from('api_keys')
    .select('id, scope, is_active')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!key || !key.is_active) {
    return { ok: false, status: 401, error: 'APIキーが無効です' };
  }
  if (need === 'read_write' && key.scope !== 'read_write') {
    return { ok: false, status: 403, error: 'このキーは読み取り専用です（書き込みには read_write キーが必要）' };
  }

  // 最終利用日時を更新（best-effort）
  void admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
    .then(
      () => {},
      () => {},
    );

  return { ok: true, keyId: key.id, scope: key.scope as ApiScope };
}
