-- ====================================================================
-- 025_stores_store_no.sql
-- 店舗マスタに「店舗番号（store_no）」を追加する
--
-- 目的：
--   店舗に 3 桁の店舗番号（001〜）を持たせる。新規登録時に自動採番（MAX+1）、
--   採番後は変更不可（UI で編集欄を出さない）。store_id（UUID）は従来どおり不変。
--   表示は UI 側で String(store_no).padStart(3,'0') により「001」形式にする
--   （DB は整数のまま保持し、数値ソート・MAX+1 採番を容易にする）。
--
-- 設計：
--   - store_no SMALLINT・UNIQUE・NOT NULL・CHECK (1〜999)。
--   - display_order とは独立した概念（番号＝採番後固定、表示順＝後から並べ替え可能）。
--   - 既存3店は display_order 昇順に 1,2,3 を backfill。
--
-- 安全な NOT NULL 付与手順（既存行があるため段階適用）：
--   1) nullable で ADD COLUMN
--   2) display_order 昇順で 1..N を backfill
--   3) UNIQUE 制約 → NOT NULL → CHECK の順で制約付与
--
-- 影響範囲：
--   - stores に store_no 列を追加し、既存行へ番号を付与するのみ。
--   - 他テーブル・実績データ（daily_sales 等）・税計算（§8.1）には一切触れない。
--   - 物理削除なし。
--
-- 冪等性：ADD COLUMN IF NOT EXISTS。backfill は store_no IS NULL の行のみ対象。
--   制約は存在チェック付きで付与（二重適用時もエラーにしない）。
-- ====================================================================

-- 1. 列追加（一旦 nullable）
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_no SMALLINT;

COMMENT ON COLUMN stores.store_no IS '店舗番号（1〜999・UNIQUE）。新規登録時に自動採番（MAX+1）、以降変更不可。UI は padStart(3,"0") で「001」表示。store_id(UUID) とは別・display_order とも独立。';

-- 2. 既存行の backfill（display_order 昇順に 1..N）
--    すでに番号が入っている行は対象外（冪等）。
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY display_order, created_at, id) AS rn
  FROM stores
  WHERE store_no IS NULL
)
UPDATE stores s
SET store_no = numbered.rn
FROM numbered
WHERE s.id = numbered.id;

-- 3. UNIQUE 制約（未付与時のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_store_no_unique'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_store_no_unique UNIQUE (store_no);
  END IF;
END $$;

-- 4. NOT NULL
ALTER TABLE stores ALTER COLUMN store_no SET NOT NULL;

-- 5. 範囲 CHECK（1〜999・未付与時のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_store_no_range'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_store_no_range CHECK (store_no BETWEEN 1 AND 999);
  END IF;
END $$;
