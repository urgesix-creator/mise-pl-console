-- ====================================================================
-- 036_daily_sales_holiday.sql
-- 日次売上に「祝日フラグ＋祝日名」を追加（#9 A案・簡易）
--
-- 目的：
--   祝日を従来のイベントメモではなく専用フィールドで扱えるようにする。
--   - is_holiday：祝日かどうか（手入力・店休 is_closed とは独立）。
--   - holiday_name：祝日名（任意・自由text）。インドネシア等の宗教祝日に対応。
--
-- 影響：
--   - daily_sales に列を2つ追加するのみ。既定（false / NULL）のため既存行・実績・
--     税計算（§8.1）・PL・期間集計には一切影響しない（これらは当列を参照しない）。物理削除なし。
--
-- 冪等性：ADD COLUMN IF NOT EXISTS。
-- ====================================================================

ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holiday_name TEXT;

COMMENT ON COLUMN daily_sales.is_holiday IS '祝日フラグ（手入力）。店休 is_closed とは独立。集計・税計算には不使用。';
COMMENT ON COLUMN daily_sales.holiday_name IS '祝日名（任意・自由text）。インドネシア等の宗教絡みの祝日に対応。';
