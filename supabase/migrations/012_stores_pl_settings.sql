-- ====================================================================
-- 012_stores_pl_settings.sql
-- stores に月次PL用の店舗別設定を2つ追加
--
-- 目的：
--   月次PL（損益計算書）で店舗ごとに異なる2設定を保持する。
--   1) employee_rebate_rate（社員還付金率）：社員還付金 = 売上 × この率。
--      既存の service_fee_rate（サービス料率）と同じ作法・同じ型で追加。
--   2) fiscal_year_start_month（決算期の期首月）：12ヶ月横並びPLの起点（1〜12）。
--
-- 方式：
--   - ALTER TABLE ADD COLUMN のみ（既存カラム・データは変更しない・非破壊）。
--   - DEFAULT 付きで追加するため、既存3店舗には暫定デフォルト値が自動で入る
--     （後で店舗ごとに正しい値へ更新する前提）。
--   - 冪等：ADD COLUMN IF NOT EXISTS（再実行可）。
--
-- 既存 service_fee_rate の定義（本マイグレーション設計の根拠）：
--   NUMERIC(5,4) NOT NULL DEFAULT 0.10 CHECK (service_fee_rate >= 0 AND <= 1)
--   → 社員還付金率も同一の型・制約に揃える（デフォルトのみ後述の理由で 0）。
--
-- RLS / GRANT：
--   - stores は既存RLSポリシー（読取＝can_access_store、書込＝is_executive 等）が
--     行レベルで効いており、カラム追加では変化しない（ポリシー変更不要）。
--   - GRANT はテーブル単位（005_table_grants.sql）で、新カラムも自動的に対象。
--     列単位GRANTは使っていないため追加付与は不要。
--
-- 経営データ（daily_sales）・税計算・他テーブルには一切触れない。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. employee_rebate_rate（社員還付金率）
--    service_fee_rate と同じ型・範囲。デフォルトは暫定 0（＝還付なし）。
--    ※ service_fee_rate の DEFAULT は 0.10 だが、還付金率は店舗ごとに大きく異なり
--      未設定店舗に料率を誤って効かせないため、安全側の暫定値 0 とする（後で各店設定）。
-- --------------------------------------------------------------------
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS employee_rebate_rate NUMERIC(5,4) NOT NULL DEFAULT 0
    CHECK (employee_rebate_rate >= 0 AND employee_rebate_rate <= 1);

COMMENT ON COLUMN stores.employee_rebate_rate IS '社員還付金率（社員還付金 = 売上 × この率）。店舗別。service_fee_rate と同様 NUMERIC(5,4)・0〜1。暫定デフォルト 0（後で各店設定）。';

-- --------------------------------------------------------------------
-- 2. fiscal_year_start_month（決算期の期首月）
--    12ヶ月横並びPLの起点。1〜12 の整数（例：4=4月始まり、1=1月始まり/暦年）。
--    暫定デフォルトは 1（暦年始まり）。海外法人は暦年が一般的なため安全側の中立値。
--    ※ 実際の決算期は店舗ごとに比嘉専務が後で設定する前提。
-- --------------------------------------------------------------------
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month INTEGER NOT NULL DEFAULT 1
    CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

COMMENT ON COLUMN stores.fiscal_year_start_month IS '決算期の期首月（1〜12）。12ヶ月横並びPLの起点。例：4=4月始まり、1=暦年始まり。暫定デフォルト 1（後で各店設定）。';
