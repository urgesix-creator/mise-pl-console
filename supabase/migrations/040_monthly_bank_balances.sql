-- ====================================================================
-- 040_monthly_bank_balances.sql
-- 月次の「通帳残高」を店舗×月で保持するテーブルを新設
--
-- 目的：
--   月次PL画面（/pl）の指標欄（客単価の下）に、各月の「通帳残高」を手入力で記録する。
--   現場/本部が月末の銀行残高（現地通貨）をメモする用途。PL計算・税計算には一切使わない
--   （表示・記録のみの参考値）。
--
-- 設計判断（013_monthly_business_days と同型）：
--   - year_month は DATE（各月の1日＝月初）。既存の日付列に統一。CHECK で月初日のみ強制。
--   - balance は NUMERIC(16,2)：IDR 等の大きな額に対応。負値（当座貸越等）も許容（CHECK なし）。
--   - UNIQUE (store_id, year_month)：同一店舗・同一月は1件（UPSERT 上書き対象）。
--
-- 権限（RLS）：
--   - 読取：can_access_store(store_id)（自店のみ・経営層/経理は全店）。
--   - 書込：can_write() AND can_access_store(store_id)（営業日数と同一。店長・スタッフも入力可）。
--
-- 冪等性：テーブル/索引は IF NOT EXISTS、ポリシーは DROP POLICY IF EXISTS → CREATE POLICY。
-- 経営データ（daily_sales）・税計算・他テーブルには一切触れない。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. テーブル作成
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_bank_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year_month DATE NOT NULL,                                       -- 対象月（各月の1日。月初のみ許可）
  balance NUMERIC(16, 2) NOT NULL,                                -- 通帳残高（現地通貨・手入力）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- year_month は必ず月初日（YYYY-MM-01）であること
  CONSTRAINT monthly_bank_balances_year_month_is_first_of_month
    CHECK (year_month = date_trunc('month', year_month)::date),
  UNIQUE (store_id, year_month)
);

COMMENT ON TABLE monthly_bank_balances IS '月次の通帳残高（店舗×月・手入力・現地通貨）。PL/税計算には使わない参考メモ。year_month は月初日。';
COMMENT ON COLUMN monthly_bank_balances.year_month IS '対象月（各月の1日＝月初。CHECKで月初のみ許可）。';
COMMENT ON COLUMN monthly_bank_balances.balance IS 'その月の通帳残高（現地通貨・手入力）。負値も許容。';

-- --------------------------------------------------------------------
-- 2. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_monthly_bank_balances_updated_at ON monthly_bank_balances;
CREATE TRIGGER trg_monthly_bank_balances_updated_at
  BEFORE UPDATE ON monthly_bank_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 3. RLS（読取＝自店／書込＝can_write かつ自店）
-- --------------------------------------------------------------------
ALTER TABLE monthly_bank_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_bank_balances_read_accessible" ON monthly_bank_balances;
CREATE POLICY "monthly_bank_balances_read_accessible" ON monthly_bank_balances
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "monthly_bank_balances_write" ON monthly_bank_balances;
CREATE POLICY "monthly_bank_balances_write" ON monthly_bank_balances
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- --------------------------------------------------------------------
-- 4. GRANT
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_bank_balances TO authenticated;
GRANT ALL ON monthly_bank_balances TO service_role;
