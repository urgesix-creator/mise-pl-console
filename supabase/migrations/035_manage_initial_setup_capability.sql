-- ====================================================================
-- 035_manage_initial_setup_capability.sql
-- 「初期設定」ページ用の能力 manage_initial_setup を追加
--
-- 目的：
--   システム設定配下の「初期設定」ハブ（Excel一括投入の集約画面）への
--   アクセス可否を能力(capability)で制御する。既定は経営層のみ。
--
-- 設計：
--   - role_permissions に manage_initial_setup を seed（executive=true・他=false）。
--   - この能力は「初期設定ページの表示」と「ページ専用の取込Action（仕入先一括取込）」の
--     ゲートに使う。実テーブルへの書き込みは従来どおり各テーブルの RLS
--     （仕入先/カテゴリ＝store_master＋can_access_store／予算＝targets 等）が最終防衛線。
--   - 既存能力・他テーブルの RLS は変更しない。挙動は既定で従来どおり（経営層のみ新機能可）。
--
-- 冪等性：ON CONFLICT DO NOTHING。
-- ====================================================================

INSERT INTO role_permissions (capability, role, allowed) VALUES
  ('manage_initial_setup','executive',true),
  ('manage_initial_setup','country_rep',false),
  ('manage_initial_setup','store_manager',false),
  ('manage_initial_setup','staff',false),
  ('manage_initial_setup','accounting',false)
ON CONFLICT (capability, role) DO NOTHING;
