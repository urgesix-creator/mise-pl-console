-- ====================================================================
-- 039 売上の「サービス料込み/別」モード（本番適用済み）
--   - daily_sales.service_fee_included：行ごとのモード（既定false＝従来「別」）。
--     既存行は全て false（not null default false）＝過去は従来計算で完全固定。
--   - stores.sales_service_fee_input_mode：売上入力の既定モード（店舗単位で共有）。
--   既存の net_sales/service_fee/tax_amount/gross_sales には一切触れない（列追加のみ）。
--   countries・仕入関連には触れない。
-- ====================================================================

alter table daily_sales
  add column if not exists service_fee_included boolean not null default false;

alter table stores
  add column if not exists sales_service_fee_input_mode text not null default 'excluded';
alter table stores drop constraint if exists stores_sales_service_fee_input_mode_check;
alter table stores add constraint stores_sales_service_fee_input_mode_check
  check (sales_service_fee_input_mode in ('excluded','included'));
