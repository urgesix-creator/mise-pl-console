-- ====================================================================
-- 014_daily_sales_is_closed.sql
-- daily_sales に「店休日フラグ」is_closed を追加（非破壊・ALTER ADD COLUMN）
--
-- 目的：
--   店休日という概念を導入する。店休日＝売上0（net_sales/gross_sales/客数すべて0）＋ is_closed=TRUE。
--   経過営業日数（PL予測の分母）は is_closed=FALSE の日数で数えるための判別列。
--
-- 設計：
--   - is_closed BOOLEAN NOT NULL DEFAULT FALSE。既存6件は自動で FALSE（＝非店休日）になる。
--   - 売上0でも「営業した日（is_closed=FALSE）」と「店休日（is_closed=TRUE）」を区別できるようにする。
--   - 税計算（§8.1 calculateSales）には一切関与しない（フラグは税計算と独立。
--     店休日は net_sales=0 で保存されるため税も0になる＝計算式は不変）。
--   - UNIQUEキー (store_id, business_date, day_period) は不変（店休日も1日1レコード）。
--
-- 安全性：
--   - ALTER ADD COLUMN IF NOT EXISTS（冪等・非破壊）。既存カラム・データ・制約は変更しない。
--   - 適用前確認済み：daily_sales は 6件、is_closed 列は未存在、net_sales=0 の行は0件。
--   - RLS：daily_sales の既存ポリシー（読取 can_access_store / 書込 can_write() AND
--     can_access_store）は行レベルのためカラム追加に非依存＝変更不要。
--   - GRANT：005_table_grants.sql のテーブル単位GRANT（authenticated/service_role）が
--     新カラムも自動的に対象＝列単位GRANT未使用のため追加付与不要。
--
-- 経営の根幹テーブルのため、税計算・既存カラム・行データには触れない（フラグ列追加のみ）。
-- ====================================================================

ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN daily_sales.is_closed IS '店休日フラグ。TRUE=店休日（売上0で保存）。経過営業日数は is_closed=FALSE の日数で数える。税計算には非関与。';
