-- ====================================================================
-- 018_expense_formulas.sql
-- 変動費の「計算式の科目」（FCロイヤリティ等）を保存するテーブルを新設
--
-- 目的：
--   月次PLの販管費に、手入力科目（monthly_expenses）とは別に「計算式で自動計算する科目」を
--   持たせる。計算式は店舗×科目で1つ・全月共通で、その月の net_sales（税抜売上）から金額を
--   都度計算する（金額そのものは保存しない＝このテーブルは式とパラメータのみ保持）。
--
-- 計算タイプ（calc_type）と必要パラメータ：
--   - 'percent'             ①一律％        ：net × rate1
--   - 'tiered'              ②段階制％(2段階)：net≤threshold ? net×rate1 : threshold×rate1 + (net−threshold)×rate2
--   - 'fixed'               ③固定額        ：fixed_amount（net に非依存）
--   - 'fixed_plus_percent'  ④固定額＋％     ：fixed_amount + net×rate1
--   率（rate1/rate2）は小数で保存（0.05＝5%）。計算ロジック・UIは本マイグレーションでは作らない。
--
-- 設計：
--   - year_month は持たない（店舗×科目で全月共通のため）。月ごとの金額は表示時に都度計算。
--   - account_name は自由text（保存前 trim() 正規化は UI/Action 側）。
--   - category_tag は monthly_expenses(016) と同じ4種（labor/rent/depreciation/other）。
--   - display_order は手入力科目と並べて表示するための表示順（既定0）。
--   - 金額・しきい値は現地通貨（NUMERIC）。
--
-- 計算タイプ別 CHECK：各タイプに必要なパラメータが揃っていることを担保（不要分は問わない）。
-- 範囲 CHECK：率は 0〜1、しきい値・固定額は 0 以上。
--
-- 権限（RLS）：
--   - 読取：can_access_store(store_id)。
--   - 書込：can_write() AND can_access_store(store_id)（店長以上・staff含む・販管費手入力と一致）。
--   ※ public スキーマの既存ヘルパー（SECURITY DEFINER・search_path固定）を使用。
--
-- 冪等性：テーブル/索引は IF NOT EXISTS。ポリシーは DROP POLICY IF EXISTS → CREATE POLICY。
--
-- 既存の monthly_expenses（015/016/017）・他テーブルには触れない。
-- 経営データ（daily_sales）・税計算（§8.1）は変更しない。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. テーブル作成
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,                                     -- 科目名（自由入力・店舗ごと）
  category_tag TEXT NOT NULL CHECK (category_tag IN ('labor', 'rent', 'depreciation', 'other')),
  calc_type TEXT NOT NULL CHECK (calc_type IN ('percent', 'tiered', 'fixed', 'fixed_plus_percent')),
  rate1 NUMERIC(8,5),            -- 率（小数）：①一律 / ②1段階目 / ④の％部分
  rate2 NUMERIC(8,5),            -- 率（小数）：②2段階目（超過分）
  threshold NUMERIC(15,2),       -- ②の境目金額（現地通貨）
  fixed_amount NUMERIC(15,2),    -- ③固定額 / ④の固定部分（現地通貨）
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 店舗×科目で1つ（全月共通）。手入力科目との名前衝突回避は UI/Action 側で担保。
  UNIQUE (store_id, account_name),

  -- 計算タイプ別：必要パラメータが揃っていること
  CONSTRAINT expense_formulas_params_by_type CHECK (
    CASE calc_type
      WHEN 'percent'            THEN rate1 IS NOT NULL
      WHEN 'tiered'             THEN rate1 IS NOT NULL AND rate2 IS NOT NULL AND threshold IS NOT NULL
      WHEN 'fixed'              THEN fixed_amount IS NOT NULL
      WHEN 'fixed_plus_percent' THEN fixed_amount IS NOT NULL AND rate1 IS NOT NULL
      ELSE FALSE
    END
  ),

  -- 範囲：率は 0〜1（小数）、しきい値・固定額は 0 以上（NULL は許容＝該当タイプ以外）
  CONSTRAINT expense_formulas_rate1_range CHECK (rate1 IS NULL OR (rate1 >= 0 AND rate1 <= 1)),
  CONSTRAINT expense_formulas_rate2_range CHECK (rate2 IS NULL OR (rate2 >= 0 AND rate2 <= 1)),
  CONSTRAINT expense_formulas_threshold_nonneg CHECK (threshold IS NULL OR threshold >= 0),
  CONSTRAINT expense_formulas_fixed_amount_nonneg CHECK (fixed_amount IS NULL OR fixed_amount >= 0)
);

COMMENT ON TABLE expense_formulas IS '変動費の計算式科目（店舗×科目で1つ・全月共通）。net_sales から都度計算（金額は保存しない）。4タイプ：percent/tiered/fixed/fixed_plus_percent。区分タグ・display_order で手入力科目(monthly_expenses)と並べて表示。';
COMMENT ON COLUMN expense_formulas.account_name IS '科目名（自由入力・例 FCロイヤリティ）。保存前 trim() 正規化は呼び出し側。手入力科目との名前衝突回避も呼び出し側。';
COMMENT ON COLUMN expense_formulas.category_tag IS '区分タグ：labor/rent/depreciation/other（016と同4種）。指標(FL/FLR/EBITDA)集計用。';
COMMENT ON COLUMN expense_formulas.calc_type IS 'percent=一律% / tiered=段階制%(2段階) / fixed=固定額 / fixed_plus_percent=固定額+%。計算は表示時（net_sales基準）。';
COMMENT ON COLUMN expense_formulas.rate1 IS '率（小数・0.05=5%）：percent/tiered1段階目/fixed_plus_percentの%部分。';
COMMENT ON COLUMN expense_formulas.rate2 IS '率（小数）：tiered の2段階目（threshold 超過分）。';
COMMENT ON COLUMN expense_formulas.threshold IS 'tiered の境目金額（現地通貨）。net がこれ以下は rate1、超過分は rate2。';
COMMENT ON COLUMN expense_formulas.fixed_amount IS '固定額（現地通貨）：fixed / fixed_plus_percent の固定部分。';
COMMENT ON COLUMN expense_formulas.display_order IS '表示順（店舗×科目で1つ）。手入力科目(monthly_expenses)と並べて表示するため。';

-- --------------------------------------------------------------------
-- 2. インデックス（店舗単位の取得）
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_expense_formulas_store
  ON expense_formulas(store_id);

-- --------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_expense_formulas_updated_at ON expense_formulas;
CREATE TRIGGER trg_expense_formulas_updated_at
  BEFORE UPDATE ON expense_formulas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 4. RLS（読取＝自店／書込＝店長以上 can_write かつ自店）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP POLICY IF EXISTS で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE expense_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_formulas_read_accessible" ON expense_formulas;
CREATE POLICY "expense_formulas_read_accessible" ON expense_formulas
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "expense_formulas_write" ON expense_formulas;
CREATE POLICY "expense_formulas_write" ON expense_formulas
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- --------------------------------------------------------------------
-- 5. GRANT（raw SQL 作成テーブルは明示付与しないと "permission denied"／silent failure）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON expense_formulas TO authenticated;
GRANT ALL ON expense_formulas TO service_role;
