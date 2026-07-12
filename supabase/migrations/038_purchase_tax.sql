-- ====================================================================
-- 038 仕入の税対応：仕入先税率/非課税・店舗の入力モード/標準仕入税率・
--     daily_purchases の net/tax/gross 追加。（本番適用済み）
--   過去PL不変：既存 amount（税抜=net）を net_amount へ写像（tax=0, gross=net）。
--   売上の税計算(§8.1)・countries には一切触れない（仕入税は別管理）。
-- ====================================================================

-- 1) suppliers：税率(%) と 非課税フラグ
alter table suppliers
  add column if not exists tax_rate numeric(6,3) not null default 0,
  add column if not exists is_tax_exempt boolean not null default false;

-- 2) stores：仕入の入力モード（税抜/税込・店舗単位で共有）／店舗標準の仕入税率(%)
alter table stores
  add column if not exists purchase_tax_input_mode text not null default 'excluded',
  add column if not exists purchase_tax_rate_default numeric(6,3) not null default 0;
alter table stores drop constraint if exists stores_purchase_tax_input_mode_check;
alter table stores add constraint stores_purchase_tax_input_mode_check
  check (purchase_tax_input_mode in ('excluded','included'));

-- 店舗標準の仕入税率：インドネシア=11 / タイ=7 / その他=0（売上のPB1/VAT＝countries とは別管理）
update stores set purchase_tax_rate_default =
  case country_id when 'id' then 11 when 'th' then 7 else 0 end;

-- 既存仕入先へ「所属店舗の標準仕入税率・非課税OFF」を backfill
update suppliers su set tax_rate = st.purchase_tax_rate_default
from stores st where su.store_id = st.id;

-- 3) daily_purchases：net/tax/gross を追加し、既存 amount を net へ写像（過去PL不変）
alter table daily_purchases
  add column if not exists net_amount numeric not null default 0,
  add column if not exists tax_amount numeric not null default 0,
  add column if not exists gross_amount numeric not null default 0;
update daily_purchases set net_amount = amount, tax_amount = 0, gross_amount = amount;
