-- 023_add_country_usa.sql
--
-- 目的：
--   アメリカ出店検討に伴う国マスタ（countries）への「アメリカ」追加。
--
--   ※ tax_rate=0（0%）は【暫定値】。米国の売上税（Sales Tax）は州・郡・市で異なり、
--     全国一律の率が存在しないため、登録時点では 0% を置く。
--     出店地が決定した時点で、国マスタ画面（/masters/countries）から実際の率
--     （および必要なら課税ベース）に修正する方針。
--   ※ tax_base='net_sales' も暫定。出店時に現地税制へ合わせて画面から変更可能。
--
-- 登録内容（確定済み）：
--   id='us'（小文字） / name='アメリカ' / code='US'（大文字）
--   tax_rate=0（DBは小数・0%・暫定） / tax_base='net_sales'（暫定） / tax_label='Sales Tax'
--   flag='🇺🇸' / display_order=6（ベトナム vn=5 の次）
--
-- 制約の確認（適用前に実査済み）：
--   - countries の CHECK制約は tax_base のみ（net_sales / net_plus_service）。tax_rate に CHECK は無い。
--   - tax_rate は NOT NULL だが 0 は有効な非NULL値 → 0% は登録可能。
--   - tax_base='net_sales' は許可値に含まれる。
--
-- 影響範囲：
--   - countries に「アメリカ」1件を INSERT するのみ。
--   - 既存の国（タイ・インドネシア・日本・台湾・ベトナム）・店舗・他テーブルには一切触れない。
--   - 税計算ロジック（§8.1）には非接触（参照元データの追加のみ）。
--
-- 冪等性：ON CONFLICT (id) DO NOTHING により、既に us が存在する場合は二重挿入しない。

INSERT INTO public.countries
  (id, name, code, flag, tax_rate, tax_base, tax_label, display_order)
VALUES
  ('us', 'アメリカ', 'US', '🇺🇸', 0, 'net_sales', 'Sales Tax', 6)
ON CONFLICT (id) DO NOTHING;
