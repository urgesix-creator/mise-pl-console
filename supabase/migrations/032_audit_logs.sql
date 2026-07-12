-- ====================================================================
-- 032_audit_logs.sql
-- 監査ログ（操作履歴）テーブルを新設する
--
-- 目的：
--   権限設定の変更・ユーザーの作成/更新/有効化/無効化/パスワード再発行など、
--   機微な管理操作の履歴を記録し、経営層が閲覧できるようにする（ガバナンス）。
--
-- 設計：
--   - actor_id / actor_email：操作者（後で無効化されても表示できるようメールを控える）。
--   - action：操作種別（例 'permission.update', 'user.create'）。
--   - target_type / target_label：対象（例 'user' / メール、'role_permission' / 'capability:role'）。
--   - details：補足（jsonb・before/after 等）。
--   - 追記専用（UPDATE/DELETE ポリシーを作らない＝改ざん防止）。
--
-- RLS：
--   - SELECT：exec_master（経営マスタ編集）のみ。
--   - INSERT：認証ユーザーが自分の actor_id（=auth.uid()）でのみ記録可（ログ偽装防止）。
--     ※ service_role（サーバ内部）は RLS バイパス。
--   - UPDATE/DELETE：ポリシーなし＝不可（追記専用）。
--
-- 影響：新規テーブル追加のみ。既存データ・実績・税計算には触れない。物理削除なし。
-- 冪等性：IF NOT EXISTS／DROP POLICY IF EXISTS→CREATE。
-- ====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_label TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS '監査ログ（機微な管理操作の履歴・追記専用）。閲覧は exec_master のみ。';

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_read_exec" ON audit_logs;
CREATE POLICY "audit_logs_read_exec" ON audit_logs
  FOR SELECT TO authenticated USING (has_capability('exec_master'));

DROP POLICY IF EXISTS "audit_logs_insert_self" ON audit_logs;
CREATE POLICY "audit_logs_insert_self" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- UPDATE / DELETE ポリシーは作らない（追記専用）。
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;
