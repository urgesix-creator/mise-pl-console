-- ====================================================================
-- 015_monthly_expenses.sql
-- 販管費を「店舗×月×科目」で月次保存するテーブルを新設
--
-- 目的：
--   月次PLの販管費を、店舗ごと・月ごと・科目ごとに1値で保持する。
--   科目名は自由入力（先日の科目マスタ expense_accounts は使わない）。
--   各行に区分タグ（人件費/減価償却/その他）を1つ持たせ、指標（FL=原価+人件費、
--   EBITDA=営業利益+減価償却）の自動集計に使う。
--
-- 設計：
--   - amount 1列で「予測→実績」を上書き（別々には持たない）。過去月へ遡って UPSERT 上書き可。
--   - account_name は自由text。保存前の trim() 正規化は UI/Action 側で行う（完全な名寄せはしない）。
--   - category_tag は 'labor'/'depreciation'/'other' の3種固定（CHECK）。表示ラベルは画面層。
--   - year_month は月初DATE（013 monthly_business_days と統一・CHECKで月初のみ）。
--   - 現地通貨で保存（円換算は表示時）。
--
-- 権限（RLS）：
--   - 読取：can_access_store(store_id)（自店・経営層/経理は全店）。
--   - 書込：can_write() AND can_access_store(store_id)（店長以上。売上・仕入と同権限）。
--   ※ public スキーマの既存ヘルパー（SECURITY DEFINER・search_path固定）を使用。
--
-- 冪等性：
--   - テーブル/索引：IF NOT EXISTS。ポリシー：DROP POLICY IF EXISTS → CREATE POLICY。
--
-- 既存の expense_accounts / expense_categories / daily_expenses は触らない（温存）。
-- 経営データ（daily_sales）・税計算（§8.1）・他テーブルには触れない。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. テーブル作成
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year_month DATE NOT NULL,                                       -- 対象月（各月の1日＝月初）
  account_name TEXT NOT NULL,                                     -- 科目名（自由入力・店舗ごと）
  category_tag TEXT NOT NULL CHECK (category_tag IN ('labor', 'depreciation', 'other')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),              -- 金額（現地通貨）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- year_month は必ず月初日（YYYY-MM-01）であること
  CONSTRAINT monthly_expenses_year_month_is_first_of_month
    CHECK (year_month = date_trunc('month', year_month)::date),
  -- 店舗×月×科目で1値（UPSERT上書きキー）
  UNIQUE (store_id, year_month, account_name)
);

COMMENT ON TABLE monthly_expenses IS '月次販管費（店舗×月×科目）。科目名は自由text。区分タグ(labor/depreciation/other)で指標FL/EBITDA集計。amount 1列で予測→実績を上書き。現地通貨。';
COMMENT ON COLUMN monthly_expenses.account_name IS '科目名（自由入力）。expense_accounts マスタとは無関係。保存前 trim() 正規化は呼び出し側。';
COMMENT ON COLUMN monthly_expenses.category_tag IS '区分タグ：labor=人件費 / depreciation=減価償却 / other=その他。指標(FL/EBITDA)自動集計用。';
COMMENT ON COLUMN monthly_expenses.amount IS '金額（現地通貨）。予測値→実績値を同一列で上書き（別々には持たない）。';

-- --------------------------------------------------------------------
-- 2. インデックス（月次PL取得の高速化）
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_monthly_expenses_store_month
  ON monthly_expenses(store_id, year_month);

-- --------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_monthly_expenses_updated_at ON monthly_expenses;
CREATE TRIGGER trg_monthly_expenses_updated_at
  BEFORE UPDATE ON monthly_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 4. RLS（読取＝自店／書込＝店長以上 can_write かつ自店）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP POLICY IF EXISTS で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_expenses_read_accessible" ON monthly_expenses;
CREATE POLICY "monthly_expenses_read_accessible" ON monthly_expenses
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "monthly_expenses_write" ON monthly_expenses;
CREATE POLICY "monthly_expenses_write" ON monthly_expenses
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- --------------------------------------------------------------------
-- 5. GRANT（raw SQL 作成テーブルは明示付与しないと "permission denied"／silent failure）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_expenses TO authenticated;
GRANT ALL ON monthly_expenses TO service_role;
