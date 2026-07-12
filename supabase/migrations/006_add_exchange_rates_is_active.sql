-- ====================================================================
-- Migration 006: exchange_rates に is_active カラム追加
-- ====================================================================
-- 目的：
--   マイグレーション履歴と実DBの齟齬を是正する。
--
-- 経緯：
--   exchange_rates のソフト削除（無効化／再有効化）機能はアプリ側
--   （app/(app)/masters/exchange-rates/）および types/database.ts で
--   is_active 列を前提に実装済みだが、001_initial_schema.sql の
--   テーブル定義には is_active 列が含まれておらず、マイグレーション
--   ファイル上は列追加の記録が欠落していた。
--
-- 実DBの状態（重要）：
--   実DB（PostgREST OpenAPIスキーマで確認）には既に
--     is_active BOOLEAN NOT NULL DEFAULT true
--   が適用済みで、正常に稼働している。本ファイルは「実DBに既に存在する
--   状態」をマイグレーション履歴へ追記して整合させるためのものであり、
--   実DBへ新たな変更を加えるものではない。
--
--   そのため ADD COLUMN IF NOT EXISTS で冪等性を確保しており、
--   既に列が存在する実DBに対しては no-op（エラーなし）となる。
-- ====================================================================

ALTER TABLE exchange_rates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
