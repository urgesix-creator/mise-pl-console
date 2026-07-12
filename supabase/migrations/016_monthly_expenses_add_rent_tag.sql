-- ====================================================================
-- 016_monthly_expenses_add_rent_tag.sql
-- monthly_expenses.category_tag の許可値を 3種 → 4種に拡張（'rent' 追加）
--
-- 目的：
--   FL/FLR の正しい定義（FLR = 食材費＋人件費＋家賃）に対応するため、区分タグに
--   「家賃（rent）」を追加する。
--     変更前：CHECK IN ('labor','depreciation','other')
--     変更後：CHECK IN ('labor','rent','depreciation','other')
--       labor=人件費 / rent=家賃 / depreciation=減価償却 / other=その他
--
-- 安全性：
--   - 015 で作成済み・本番データ 0 件（適用前確認済み）。許可値を増やすだけの緩和なので
--     既存データとの不整合は生じない。
--   - 変更は category_tag の CHECK 制約のみ。他のカラム・UNIQUEキー・RLS・GRANT は触らない。
--   - 既存制約名 monthly_expenses_category_tag_check を DROP（IF EXISTS）→ 新CHECKを ADD。
--   - 冪等：DROP CONSTRAINT IF EXISTS で再実行可。
--
-- 経営データ（daily_sales）・税計算（§8.1）・他テーブルには触れない。
-- ====================================================================

ALTER TABLE monthly_expenses
  DROP CONSTRAINT IF EXISTS monthly_expenses_category_tag_check;

ALTER TABLE monthly_expenses
  ADD CONSTRAINT monthly_expenses_category_tag_check
  CHECK (category_tag IN ('labor', 'rent', 'depreciation', 'other'));

COMMENT ON COLUMN monthly_expenses.category_tag IS '区分タグ：labor=人件費 / rent=家賃 / depreciation=減価償却 / other=その他。指標(FL/FLR/EBITDA)自動集計用。';
