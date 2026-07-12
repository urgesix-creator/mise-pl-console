-- ====================================================================
-- Table Grants v1.0
-- raw SQL でテーブルを作成した場合、authenticated / anon ロールに
-- は自動的にアクセス権が付与されない（Supabase ダッシュボード経由
-- 作成時のみ自動付与）。
--
-- RLS ポリシーが効くのはこの GRANT より後の段階。GRANT がないと
-- "permission denied for table" になり、RLS は評価されない。
-- ====================================================================

-- schema usage（authenticated, anon が public スキーマを参照可能に）
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- 全テーブルに対する CRUD 権限（実際のアクセス制御は RLS で行う）
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ビュー（v_daily_sales_with_target 等）も含めて
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- シーケンス（UUID PK 以外で使用される場合）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- service_role は RLS をバイパスして全権限
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 今後新規追加されるテーブル・シーケンスにも自動適用
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

-- 確認用：profiles に対する authenticated の権限を表示
-- SELECT grantee, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_schema = 'public' AND table_name = 'profiles';
