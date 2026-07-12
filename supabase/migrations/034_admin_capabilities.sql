-- ====================================================================
-- 034_admin_capabilities.sql
-- 管理機能を権限設定（role_permissions）で個別に許可できるよう capability を追加
--
-- 背景：
--   ユーザー管理・APIキー・監査ログ・システム設定（Slack/為替）を後から追加したが、
--   いずれも exec_master（経営マスタ編集）に束ねられ、ロール別に委任できなかった。
--   これらを独立 capability にし、権限設定の画面で経営層が任意のロールへ許可できるようにする。
--
-- 追加 capability（既定はすべて executive のみ＝現状の挙動と一致）：
--   user_management   ユーザー管理（招待・ロール付与・店舗割当・有効/無効）
--   api_keys          APIキー管理（発行・失効）
--   audit_log         監査ログ閲覧
--   system_settings   システム設定（Slack通知・為替自動取得 等）
--   ※ 権限設定そのもの（/admin/permissions）は引き続き exec_master（委任しない強い権限）。
--
-- RLS 差し替え（意味は現状と一致＝executive が既定で全 capability を保持）：
--   audit_logs 読取   exec_master → audit_log
--   api_keys 読取/発行/更新 exec_master → api_keys
--   system_settings 書込 is_executive() → system_settings
--   profiles 読取(admin)・user_store_assignments 読取(admin) に user_management を追加
--     （ユーザー管理委任者が一覧を読めるように）。書込は従来どおり（管理操作は service_role
--      経由のアプリ Action ＋ アプリ側の自己保護で実施）。
--
-- 影響：seed 既定が executive のみのため、現状の表示・権限は変わらない。
-- 冪等性：INSERT ... ON CONFLICT DO NOTHING／DROP POLICY IF EXISTS → CREATE。
-- ====================================================================

INSERT INTO role_permissions (capability, role, allowed) VALUES
  ('user_management','executive',true),
  ('user_management','country_rep',false),
  ('user_management','store_manager',false),
  ('user_management','staff',false),
  ('user_management','accounting',false),

  ('api_keys','executive',true),
  ('api_keys','country_rep',false),
  ('api_keys','store_manager',false),
  ('api_keys','staff',false),
  ('api_keys','accounting',false),

  ('audit_log','executive',true),
  ('audit_log','country_rep',false),
  ('audit_log','store_manager',false),
  ('audit_log','staff',false),
  ('audit_log','accounting',false),

  ('system_settings','executive',true),
  ('system_settings','country_rep',false),
  ('system_settings','store_manager',false),
  ('system_settings','staff',false),
  ('system_settings','accounting',false)
ON CONFLICT (capability, role) DO NOTHING;

-- 監査ログ 読取 → audit_log
DROP POLICY IF EXISTS "audit_logs_read_exec" ON audit_logs;
CREATE POLICY "audit_logs_read_exec" ON audit_logs
  FOR SELECT TO authenticated USING (has_capability('audit_log'));

-- APIキー 読取/発行/更新 → api_keys
DROP POLICY IF EXISTS "api_keys_read_exec" ON api_keys;
CREATE POLICY "api_keys_read_exec" ON api_keys
  FOR SELECT TO authenticated USING (has_capability('api_keys'));

DROP POLICY IF EXISTS "api_keys_insert_exec" ON api_keys;
CREATE POLICY "api_keys_insert_exec" ON api_keys
  FOR INSERT TO authenticated WITH CHECK (has_capability('api_keys'));

DROP POLICY IF EXISTS "api_keys_update_exec" ON api_keys;
CREATE POLICY "api_keys_update_exec" ON api_keys
  FOR UPDATE TO authenticated USING (has_capability('api_keys')) WITH CHECK (has_capability('api_keys'));

-- システム設定 書込 → system_settings
DROP POLICY IF EXISTS "system_settings_write_executive" ON system_settings;
DROP POLICY IF EXISTS "system_settings_write" ON system_settings;
CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL TO authenticated USING (has_capability('system_settings')) WITH CHECK (has_capability('system_settings'));

-- profiles 読取(admin) に user_management を追加
DROP POLICY IF EXISTS "profiles_read_admin" ON profiles;
CREATE POLICY "profiles_read_admin" ON profiles
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text]) OR has_capability('user_management'));

-- user_store_assignments 読取(admin) に user_management を追加
DROP POLICY IF EXISTS "user_store_assignments_read_admin" ON user_store_assignments;
CREATE POLICY "user_store_assignments_read_admin" ON user_store_assignments
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text]) OR has_capability('user_management'));
