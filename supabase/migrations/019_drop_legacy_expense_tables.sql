-- ====================================================================
-- 019_drop_legacy_expense_tables.sql
-- 不要になった「日次経費入力」「販管費科目マスタ」関連の3テーブルを完全削除（DROP）
--
-- 背景：
--   月次PLで販管費を「手入力科目（monthly_expenses・自由text）」＋「変動費の計算式
--   （expense_formulas）」で扱えるようになり、旧来の科目マスタ・日次経費は不要になった。
--   ナビ導線（S1）・画面/コード（S2）・型（S3）を削除済み。本マイグレーションでテーブルを削除する。
--
-- 【重要・復元不可】
--   - DROP するのは次の3テーブルのみ：daily_expenses / expense_accounts / expense_categories。
--   - データも消える（適用直前の件数：daily_expenses=0 / expense_accounts=19 / expense_categories=8）。
--     バックアップは取らない方針（確定済み・復元不可で可）。
--
-- FK依存（適用直前に確認済み・外部からの参照はゼロ＝自己チェーンのみ）：
--   daily_expenses → expense_accounts, stores
--   expense_accounts → expense_categories, stores
--   （stores はこれら3テーブルから参照されるだけ＝逆方向の依存なし。stores は削除しない・無影響）
--
-- DROP順序（FK制約を守るため 子 → 親 → 祖 の順）：
--   1) daily_expenses   （子：expense_accounts を参照）
--   2) expense_accounts （親：expense_categories を参照）
--   3) expense_categories（祖）
--   逆順だと FK 制約エラーになる。IF EXISTS で冪等化。
--
-- RLSポリシー・トリガー・インデックス・各テーブルのFK制約は、テーブルを DROP すれば
-- 一緒に自動削除される（個別の DROP POLICY 等は不要）。
--
-- 【触らないもの】monthly_expenses / expense_formulas / stores / daily_sales / daily_purchases /
--   daily_targets / inventory_estimates / monthly_business_days / その他すべてのテーブル。
--   経営データ（daily_sales）・税計算（§8.1）には一切触れない。
-- ====================================================================

-- 1) 子：daily_expenses（expense_accounts・stores を参照）
DROP TABLE IF EXISTS daily_expenses;

-- 2) 親：expense_accounts（expense_categories・stores を参照）
DROP TABLE IF EXISTS expense_accounts;

-- 3) 祖：expense_categories
DROP TABLE IF EXISTS expense_categories;
