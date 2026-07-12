-- 022_add_country_vietnam.sql
--
-- 目的：
--   ベトナム出店予定に伴う国マスタ（countries）への「ベトナム」追加。
--   税率10%（標準VAT）・課税ベース net_plus_service（税抜売上＋サービス料に課税＝タイと同方式）は
--   登録時点の値であり、国マスタ画面（/masters/countries）からいつでも変更可能。
--
-- 登録内容（確定済み）：
--   id='vn'（小文字） / name='ベトナム' / code='VN'（大文字）
--   tax_rate=0.10（DBは小数・10%） / tax_base='net_plus_service' / tax_label='VAT'
--   flag='🇻🇳' / display_order=5（既存4か国 th=1, id=2, jp=3, tw=4 の続き）
--
-- 影響範囲：
--   - countries に「ベトナム」1件を INSERT するのみ。
--   - 既存の国（タイ・インドネシア・日本・台湾）・店舗・他テーブルには一切触れない。
--   - 税計算ロジック（§8.1）には非接触（参照元データの追加のみ）。
--
-- 冪等性：ON CONFLICT (id) DO NOTHING により、既に vn が存在する場合は二重挿入しない。

INSERT INTO public.countries
  (id, name, code, flag, tax_rate, tax_base, tax_label, display_order)
VALUES
  ('vn', 'ベトナム', 'VN', '🇻🇳', 0.10, 'net_plus_service', 'VAT', 5)
ON CONFLICT (id) DO NOTHING;
