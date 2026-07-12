-- ====================================================================
-- 033_api_keys.sql
-- 外部AI/ツール連携用の API キー（REST API 認証）テーブルを新設する
--
-- 目的：
--   /api/v1 の REST API を、APIキー（Bearer）で認証して利用できるようにする。
--   外部AI（Claude/Codex 等）・自作エージェント・スクリプトからのデータ取得/更新に使う。
--
-- 設計：
--   - キーは平文を保存しない（sha256 ハッシュのみ保存）。発行時に1回だけ平文を表示。
--   - scope：'read'（読み取り専用・既定）／'read_write'（読み書き）。
--     書き込みは「強力な権限」のため read_write キーが必要。発行は exec_master のみ。
--   - 失効は is_active=false（論理）。物理削除なし。
--   - last_used_at：最終利用日時（監視用・best-effort 更新）。
--
-- RLS：
--   - SELECT/INSERT/UPDATE：exec_master（経営マスタ編集）のみ。
--     ※ API リクエスト自体の照合は service_role（RLSバイパス）で行う（セッションが無いため）。
--   - DELETE：ポリシーなし＝不可。
--
-- 影響：新規テーブル追加のみ。既存データ・実績・税計算には触れない。
-- 冪等性：IF NOT EXISTS／DROP POLICY IF EXISTS→CREATE。
-- ====================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'read_write')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE api_keys IS 'REST API 用キー（外部AI/ツール連携）。平文は保存せず sha256 ハッシュのみ。scope=read/read_write。失効=is_active=false。';

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_read_exec" ON api_keys;
CREATE POLICY "api_keys_read_exec" ON api_keys
  FOR SELECT TO authenticated USING (has_capability('exec_master'));

DROP POLICY IF EXISTS "api_keys_insert_exec" ON api_keys;
CREATE POLICY "api_keys_insert_exec" ON api_keys
  FOR INSERT TO authenticated WITH CHECK (has_capability('exec_master'));

DROP POLICY IF EXISTS "api_keys_update_exec" ON api_keys;
CREATE POLICY "api_keys_update_exec" ON api_keys
  FOR UPDATE TO authenticated USING (has_capability('exec_master')) WITH CHECK (has_capability('exec_master'));

GRANT SELECT, INSERT, UPDATE ON api_keys TO authenticated;
GRANT ALL ON api_keys TO service_role;
