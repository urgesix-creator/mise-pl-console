-- ====================================================================
-- 020_delete_legacy_lunch_dinner_sales.sql
-- 全店 day_period='all' 運用への移行に伴い、残存していた古い lunch/dinner の
-- 売上データ（博多天神ジャカルタ・2026-05-30・2件）を物理削除する。
--
-- 背景：
--   昼夜分離（stores.is_lunch_dinner_split）を廃止し、全店 all 運用にする準備の最初の一歩。
--   現在 is_lunch_dinner_split は全店 false で、売上入力は all のみ。月次PL（lib/pl）は
--   day_period='all' のみを集計するため、この2件は既に表示・集計に使われていない。
--
-- 【重要・経営データの物理削除・復元不可】
--   - daily_sales（売上データ）の DELETE。これまでの DELETE 例外（monthly_expenses /
--     expense_formulas）とは別カテゴリの操作。事前に SELECT で対象2件を特定・確認済み。
--   - 削除対象は次の2行（id 指定）だけ。安全のため day_period IN ('lunch','dinner') を併用し、
--     万一 id が all 行を指していても削除しないよう二重ガードする。
--       a56e569a-a7ed-41f8-a6f4-856895a63ddd … dinner（net 100,000）
--       46851f03-5efa-4e28-bebc-99c5746eb5a8 … lunch （net 10,000 / gross 12,100 / 客4）
--   - day_period='all' の5件は対象外（絶対に消さない）。同日同店に all 行は無いことを確認済み。
--
-- 触らないもの：他テーブル・stores・day_period='all' の売上・月次PL・税計算 等すべて。
--   stores.is_lunch_dinner_split カラム自体はこのマイグレーションでは削除しない（後続ステップ）。
-- ====================================================================

DELETE FROM daily_sales
WHERE id IN (
  'a56e569a-a7ed-41f8-a6f4-856895a63ddd',  -- dinner
  '46851f03-5efa-4e28-bebc-99c5746eb5a8'   -- lunch
)
  AND day_period IN ('lunch', 'dinner');   -- 二重ガード（all は絶対に消さない）
