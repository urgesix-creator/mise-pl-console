-- ====================================================================
-- 017_monthly_expenses_display_order.sql
-- monthly_expenses に display_order（表示順序）カラムを追加
--
-- 目的：
--   月次PLの販管費科目（account_name）を上下矢印で並び替え、順序を保存・再現するため。
--   順序の単位は「店舗×科目（account_name）」で1つ・全月共通。
--   同一店舗・同一 account_name の各月（12ヶ月）の行は同じ display_order を持つ。
--
-- 設計：
--   - display_order INTEGER NOT NULL DEFAULT 0（非破壊・冪等）。
--   - 既存行は DEFAULT 0 が入る（適用前確認：display_order 未存在・既存5行）。
--     ※並び替えUI/Actionは後続ステップ。順序未設定の間は display_order(0) → account_name 順で表示。
--   - 他のカラム・UNIQUEキー(store_id, year_month, account_name)・CHECK・RLS・GRANT は変更しない。
--
-- 経営データ（daily_sales）・税計算（§8.1）・他テーブルには触れない。
-- ====================================================================

ALTER TABLE monthly_expenses
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN monthly_expenses.display_order IS '表示順序（店舗×科目で1つ・全月共通）。同一店舗・同一 account_name の各月行は同じ値を持つ。並び替え（上下矢印）で更新。';
