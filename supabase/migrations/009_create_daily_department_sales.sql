-- ====================================================================
-- 009_create_daily_department_sales.sql
-- 部門別売上（参考データ）機能 Phase 2：日次部門別売上
--
-- 正典：docs/data_model_v1.8.md §4.17 daily_department_sales
--
-- 概要：
--   - 部門別の「税込売上のみ」を保持する参考データ（店舗ローカル通貨・JPY換算なし）。
--   - 経営データ（daily_sales 等）とは完全に独立。損益・原価率・予算比には一切使用しない。
--   - 1日・1部門・1レコード。UPSERT（ON CONFLICT）で上書き（daily_purchases と同方式）。
--   - ソフト削除は部門マスタ側（sales_departments.is_active）で管理するため本表に is_active は持たない。
--
-- RLS は本番DBの実態（public スキーマのヘルパー関数）に合わせ、daily_sales と同一パターン：
--   - 読取：can_access_store(store_id)
--   - 書込：can_write() AND can_access_store(store_id)（売上入力と同権限。staff も入力可）
--
-- 【型の注記】gross_sales は正典の表記は DECIMAL(12,2) だが、実DBの金額列
--   （daily_sales / daily_purchases）は NUMERIC(15,2) + CHECK (>= 0)。IDR 等の大きな
--   金額の桁あふれ回避と既存慣例への整合のため NUMERIC(15,2) + CHECK を採用する
--   （DECIMAL と NUMERIC は同一型・精度のみ差）。
--
-- 本ファイルは冪等（再実行可能）に構成している。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. テーブル作成
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_department_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  business_date DATE NOT NULL,                                   -- 営業日（店舗ローカル時間ベース）
  department_id UUID NOT NULL REFERENCES sales_departments(id) ON DELETE RESTRICT,
  gross_sales NUMERIC(15,2) NOT NULL CHECK (gross_sales >= 0),   -- 税込売上（参考値・ローカル通貨。JPY換算しない）
  notes TEXT,                                                     -- 備考（任意）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_date, department_id)                -- 1日1部門1レコード（UPSERTマッチング条件）
);

COMMENT ON TABLE daily_department_sales IS '日次部門別売上（参考データ）。税込のみ・経営計算には不使用。UNIQUE (store_id,business_date,department_id) でUPSERT上書き。';

-- --------------------------------------------------------------------
-- 2. インデックス
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_daily_department_sales_store_date
  ON daily_department_sales(store_id, business_date);
CREATE INDEX IF NOT EXISTS idx_daily_department_sales_department
  ON daily_department_sales(department_id);

-- --------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_daily_department_sales_updated_at ON daily_department_sales;
CREATE TRIGGER trg_daily_department_sales_updated_at
  BEFORE UPDATE ON daily_department_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 4. RLS（daily_sales と同一パターン。本番DBの public スキーマ関数を使用）
--    - 読取：自店のみ（経営層は全店）＝ can_access_store(store_id)
--    - 書込：売上入力と同権限 ＝ can_write() AND can_access_store(store_id)（staff も可）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP POLICY IF EXISTS で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE daily_department_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_department_sales_read_accessible" ON daily_department_sales;
DROP POLICY IF EXISTS "daily_department_sales_write" ON daily_department_sales;

-- 読取：アクセス可能な店舗（自店／経営層は全店）
CREATE POLICY "daily_department_sales_read_accessible" ON daily_department_sales
  FOR SELECT TO authenticated USING (can_access_store(store_id));

-- 書込：売上入力者と同権限（can_write）かつ自店
CREATE POLICY "daily_department_sales_write" ON daily_department_sales
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- --------------------------------------------------------------------
-- 5. GRANT（raw SQL 作成テーブルは明示付与。実アクセス制御は RLS）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_department_sales TO authenticated;
GRANT ALL ON daily_department_sales TO service_role;
