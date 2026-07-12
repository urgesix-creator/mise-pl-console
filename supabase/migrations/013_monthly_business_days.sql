-- ====================================================================
-- 013_monthly_business_days.sql
-- 月次の「営業日数」を店舗×月で保持するテーブルを新設
--
-- 目的：
--   売上・原価の月次予測の分母×倍率に使う「その月の営業日数」を保持する。
--     予測 = 当月累計 ÷ 経過営業日数 × 当月営業日数
--   水かけ祭り等で月ごとに変動するため手入力（店舗×月で1値）。月次PL画面で入力する。
--
-- 設計判断：
--   - year_month は DATE（各月の1日＝月初）。既存の日付列（business_date/target_date）が
--     すべて DATE のため統一。CHECK で「月初日のみ」を強制（表記揺れ防止）。
--   - business_days は INTEGER・CHECK (1〜31)。
--   - UNIQUE (store_id, year_month)：同一店舗・同一月は1件（UPSERT上書き対象）。
--
-- 権限（RLS）：
--   - 読取：can_access_store(store_id)（自店のみ・経営層/経理は全店）。
--   - 書込：can_write() AND can_access_store(store_id)（売上・仕入と同一。店長・スタッフも入力可。
--           営業日数は店舗の現場知識で入力するため、日次入力者と同じ権限に揃える）。
--   ※ ヘルパー関数は public スキーマの既存 can_access_store()/can_write()
--     （SECURITY DEFINER・search_path 固定済み）を使用。
--
-- 冪等性：
--   - テーブル/索引：IF NOT EXISTS、ポリシー：DROP POLICY IF EXISTS → CREATE POLICY
--     （CREATE POLICY に IF NOT EXISTS は無いため）。
--
-- 経営データ（daily_sales）・税計算・他テーブルには一切触れない。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. テーブル作成
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_business_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year_month DATE NOT NULL,                                       -- 対象月（各月の1日。月初のみ許可）
  business_days INTEGER NOT NULL CHECK (business_days >= 1 AND business_days <= 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- year_month は必ず月初日（YYYY-MM-01）であること
  CONSTRAINT monthly_business_days_year_month_is_first_of_month
    CHECK (year_month = date_trunc('month', year_month)::date),
  UNIQUE (store_id, year_month)
);

COMMENT ON TABLE monthly_business_days IS '月次の営業日数（店舗×月・手入力）。売上/原価の月次予測（累計÷経過営業日数×当月営業日数）に使用。year_month は月初日。';
COMMENT ON COLUMN monthly_business_days.year_month IS '対象月（各月の1日＝月初。CHECKで月初のみ許可）。';
COMMENT ON COLUMN monthly_business_days.business_days IS 'その月の営業日数（1〜31・手入力）。祝祭日・臨時休業で変動。';

-- --------------------------------------------------------------------
-- 2. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_monthly_business_days_updated_at ON monthly_business_days;
CREATE TRIGGER trg_monthly_business_days_updated_at
  BEFORE UPDATE ON monthly_business_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 3. RLS（読取＝自店／書込＝executive＋accounting かつ自店）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP POLICY IF EXISTS で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE monthly_business_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_business_days_read_accessible" ON monthly_business_days;
CREATE POLICY "monthly_business_days_read_accessible" ON monthly_business_days
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "monthly_business_days_write" ON monthly_business_days;
CREATE POLICY "monthly_business_days_write" ON monthly_business_days
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- --------------------------------------------------------------------
-- 4. GRANT（raw SQL 作成テーブルは明示付与しないと "permission denied"／silent failure）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_business_days TO authenticated;
GRANT ALL ON monthly_business_days TO service_role;
