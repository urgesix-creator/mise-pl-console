-- ====================================================================
-- 028_suppliers_cost_type.sql
-- 仕入先に「原価区分（cost_type）」を追加する
--
-- 目的：
--   仕入先を「売上原価（cogs）」と「販管費（sga）」に分類できるようにする。
--   - cogs：従来どおり 売上原価・粗利・差益・月次PLの原価に算入。
--   - sga ：売上原価から除外（粗利・差益・PL原価に入れない）。
--           月次PLの販管費へは自動合算せず、仕入先別集計の参考値を見て手入力で反映する。
--
-- 設計：
--   - suppliers に cost_type TEXT NOT NULL DEFAULT 'cogs' CHECK (cogs/sga)。
--   - 既定 'cogs'＝既存の全仕入先は cogs となり、現状の PL・期間集計の数値は一切変わらない
--     （分類を 'sga' に変更した時点から原価計算に反映される）。
--   - 売上原価の集計は「店舗×cost_type」で仕入先を絞るため複合インデックスを付与。
--
-- 影響範囲：
--   - suppliers に列を1つ追加するのみ。既存データ・実績（daily_purchases 等）・税計算
--     （§8.1）には触れない。物理削除なし。
--
-- 冪等性：ADD COLUMN IF NOT EXISTS／CREATE INDEX IF NOT EXISTS。
-- ====================================================================

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS cost_type TEXT NOT NULL DEFAULT 'cogs'
  CHECK (cost_type IN ('cogs', 'sga'));

COMMENT ON COLUMN suppliers.cost_type IS '原価区分：cogs=売上原価（粗利・差益・月次PL原価に算入）／sga=販管費（売上原価から除外。月次PLの販管費へは仕入先別集計の参考値を見て手入力で反映）。既定 cogs。';

CREATE INDEX IF NOT EXISTS idx_suppliers_store_cost_type ON suppliers(store_id, cost_type);
