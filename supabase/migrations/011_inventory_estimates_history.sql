-- ====================================================================
-- 011_inventory_estimates_history.sql
-- 概算棚卸（在庫）を「店舗×日付の履歴」テーブルへ再設計
--
-- 目的：
--   旧 inventory_estimates は PK=store_id の「1店舗1件（最新値のみ・履歴なし）」だった。
--   月次PLの売上原価（期首在庫＋仕入−期末在庫）に使うため、
--   (store_id, business_date) をキーとする履歴（スナップショット）テーブルへ再設計する。
--
-- 確定方針：
--   - 保持するのは「店舗・日付・在庫合計額」のみ（概算・品目別内訳なし）。
--   - 「した日だけ記録・しない日は記録なし」。スパースに行が増える。
--   - 「しない日は直近を引き継ぐ」「期首在庫＝前月末以前の最新」はデータに持たせず、
--     PL計算時に「対象日以前の最新スナップショット」を引くクエリで解決する（本移行では保存構造のみ）。
--   - 書込権限は売上・仕入と同じ（can_write()＝WRITE_ROLES：executive/country_rep/store_manager/staff）。
--
-- 安全性：
--   - 旧 inventory_estimates は本番DBで 0 件・FK被参照なし・依存ビューなし（適用前に確認済み）。
--   - 念のため冒頭ガードで「データがあれば中止」（誤適用での消失防止）。
--   - 経営データ（daily_sales）・他テーブルには一切触れない。
--
-- 冪等性：
--   - 空テーブルなら再実行可（ガード通過→DROP→再CREATE）。データ投入後の再実行はガードで停止（保護）。
--   - RLS は DROP POLICY IF EXISTS → CREATE POLICY で冪等化（CREATE POLICY に IF NOT EXISTS は無いため）。
-- ====================================================================

-- --------------------------------------------------------------------
-- 0. 安全ガード：既存 inventory_estimates にデータがあれば中止（データ消失防止）
-- --------------------------------------------------------------------
DO $$
DECLARE
  cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_estimates'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.inventory_estimates' INTO cnt;
    IF cnt > 0 THEN
      RAISE EXCEPTION
        'inventory_estimates に % 件のデータが存在するため再構築を中止しました（データ消失防止）。移行が必要な場合はバックフィル手順を別途用意してください。',
        cnt;
    END IF;
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 1. 旧テーブルを破棄（0件確認済み・FK被参照/依存ビューなし）
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS inventory_estimates;

-- --------------------------------------------------------------------
-- 2. 履歴テーブルとして再作成（(store_id, business_date) を一意キーに）
--    金額は他の日次テーブル（daily_sales/daily_purchases）に合わせ NUMERIC(15,2)+CHECK。
-- --------------------------------------------------------------------
CREATE TABLE inventory_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,                                    -- 棚卸し基準日（店舗ローカル日付）
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),              -- 在庫合計額（概算・品目別内訳なし）
  notes TEXT,                                                     -- 任意メモ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_date)                               -- 1店舗1日1スナップショット（UPSERT上書きキー）
);

COMMENT ON TABLE inventory_estimates IS '概算棚卸（在庫）スナップショット。店舗×日付×在庫合計額。した日だけ記録（スパース）。月次PL原価の期首/期末在庫として、対象日以前の最新値をクエリで引く。';

-- --------------------------------------------------------------------
-- 3. インデックス（「対象日以前の最新スナップショット」取得を高速化）
-- --------------------------------------------------------------------
CREATE INDEX idx_inventory_estimates_store_date
  ON inventory_estimates(store_id, business_date DESC);

-- --------------------------------------------------------------------
-- 4. updated_at 自動更新トリガ（既存の共通関数を流用）
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_inventory_estimates_updated_at ON inventory_estimates;
CREATE TRIGGER trg_inventory_estimates_updated_at
  BEFORE UPDATE ON inventory_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 5. RLS（daily_sales / daily_purchases と同一パターン。public スキーマのヘルパー関数）
--    読取：can_access_store(store_id)（自店のみ・経営層は全店）
--    書込：can_write() AND can_access_store(store_id)（売上・仕入と同権限。staff も可）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP POLICY IF EXISTS で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE inventory_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_estimates_read_accessible" ON inventory_estimates;
CREATE POLICY "inventory_estimates_read_accessible" ON inventory_estimates
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "inventory_estimates_write" ON inventory_estimates;
CREATE POLICY "inventory_estimates_write" ON inventory_estimates
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- --------------------------------------------------------------------
-- 6. GRANT（raw SQL 作成テーブルは明示付与しないと "permission denied"／silent failure になる）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_estimates TO authenticated;
GRANT ALL ON inventory_estimates TO service_role;
