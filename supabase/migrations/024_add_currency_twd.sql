-- 024_add_currency_twd.sql
--
-- 目的：
--   台湾ドル（TWD）を通貨マスタ（currencies）に追加する。
--   store-form-dialog.tsx の COUNTRY_DEFAULTS は台湾(tw)→通貨id 'twd' を指しているが、
--   currencies に 'twd' が存在しなかったため、台湾を選んでも通貨が自動補完されなかった。
--   本追加により id='twd' が実在し、tw→twd の自動補完が成立する。
--
-- 登録内容（既存形式に準拠）：
--   id='twd'（小文字・COUNTRY_DEFAULTS の参照と一致）
--   code='TWD'（大文字・ISO 4217） / symbol='NT$' / name='台湾ドル'
--   display_order=6（既存 jpy=1, thb=2, idr=3, usd=4, vnd=5 の続き）
--
-- 影響範囲：
--   - currencies に「台湾ドル」1件を INSERT するのみ。
--   - 既存の通貨（円・タイバーツ・ルピア・米ドル・ベトナムドン）・国・店舗・他テーブルには一切触れない。
--   - 税計算ロジック（§8.1）には非接触。
--   - 為替レート（twd→jpy）は本マイグレーションでは登録しない（台湾を実運用する際に別途）。
--
-- 冪等性：ON CONFLICT (id) DO NOTHING により、既に twd が存在する場合は二重挿入しない。

INSERT INTO public.currencies
  (id, code, symbol, name, display_order)
VALUES
  ('twd', 'TWD', 'NT$', '台湾ドル', 6)
ON CONFLICT (id) DO NOTHING;
