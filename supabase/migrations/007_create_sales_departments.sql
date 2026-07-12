-- ====================================================================
-- 007_create_sales_departments.sql
-- 部門別売上（参考データ）機能 Phase 1：部門マスタ
--
-- 正典：docs/data_model_v1.8.md §4.16 sales_departments
--
-- 概要：
--   - 部門別売上（参考データ）の「部門」を店舗ごとに完全独立で管理するマスタ。
--   - 共通初期値（seed）は持たない。各店が運用開始時にゼロから登録する。
--   - 削除はソフト削除（is_active = false）。物理削除しない（過去データ保護）。
--   - 経営データ（daily_sales 等）には一切影響しない追加レイヤー。
--
-- 既存マスタ（purchase_categories / expense_accounts）と同型。
-- 本ファイルは冪等（再実行可能）に構成している。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. テーブル作成
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                                             -- 部門名（例：朝食／昼食／夕食／デリバリー）。店舗ごと自由
  display_order INTEGER NOT NULL DEFAULT 0,                       -- 表示順
  is_active BOOLEAN NOT NULL DEFAULT TRUE,                        -- 有効フラグ（ソフト削除：false で無効化）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)                                         -- 同一店舗内で部門名は重複不可
);

COMMENT ON TABLE sales_departments IS '部門マスタ（店舗別・参考データ用）。部門別売上の部門定義。共通初期値なし・ソフト削除。経営計算には不使用。';

-- --------------------------------------------------------------------
-- 2. インデックス（有効な部門の店舗別取得を高速化）
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_departments_store
  ON sales_departments(store_id) WHERE is_active = TRUE;

-- --------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sales_departments_updated_at ON sales_departments;
CREATE TRIGGER trg_sales_departments_updated_at
  BEFORE UPDATE ON sales_departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 4. RLS（店舗別マスタのパターンを踏襲：purchase_categories / expense_accounts と同一）
--    - 読取：自店のみ（経営層は全店）＝ can_access_store(store_id)
--    - 書込：店長以上（executive / country_rep / store_manager）かつ自店
--    CREATE POLICY は IF NOT EXISTS 非対応のため、冒頭で DROP POLICY IF EXISTS して冪等化。
--
--    【注意】本番DBのRLSヘルパー関数は public スキーマ（プレフィックスなし）に存在し、
--    ロール取得は current_user_role() を使用する（can_access_store / current_user_role）。
--    リポジトリの 002_rls_policies.sql は auth.xxx / auth.user_role() 表記だが、
--    実DBは上記の名称で構築されている。本ファイルは実DB（=本番）の実関数名に合わせる。
-- --------------------------------------------------------------------
ALTER TABLE sales_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_departments_read_accessible" ON sales_departments;
DROP POLICY IF EXISTS "sales_departments_write" ON sales_departments;

-- 読取：アクセス可能な店舗（自店／経営層は全店）
CREATE POLICY "sales_departments_read_accessible" ON sales_departments
  FOR SELECT TO authenticated USING (can_access_store(store_id));

-- 書込：経営層・各国代表・店長が自店に対して可能（マスタ編集は店長以上）
CREATE POLICY "sales_departments_write" ON sales_departments
  FOR ALL TO authenticated USING (
    current_user_role() IN ('executive', 'country_rep', 'store_manager')
    AND can_access_store(store_id)
  ) WITH CHECK (
    current_user_role() IN ('executive', 'country_rep', 'store_manager')
    AND can_access_store(store_id)
  );

-- --------------------------------------------------------------------
-- 5. GRANT（raw SQL 作成テーブルは明示付与が必要。実アクセス制御は RLS）
--    005_table_grants.sql の ALTER DEFAULT PRIVILEGES でも自動付与されるが、
--    自己完結性のため明示的にも付与する。
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_departments TO authenticated;
GRANT ALL ON sales_departments TO service_role;
