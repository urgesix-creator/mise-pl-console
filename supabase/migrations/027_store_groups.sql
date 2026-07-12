-- ====================================================================
-- 027_store_groups.sql
-- 店舗グループ（多対多）を新設する
--
-- 目的：
--   期間集計ページ等で「複数店舗をまとめて集計・絞り込み」できるよう、
--   店舗グループ（store_groups）と所属（store_group_members）を持たせる。
--   1店舗は複数グループに所属可（多対多）。
--
-- 設計（既存マスタの流儀に合わせる）：
--   - store_groups：id/name/display_order/is_active/created_at/updated_at。
--   - store_group_members：group_id × store_id の所属（is_active）。UNIQUE(group_id, store_id)。
--   - 所属の解除も論理削除（is_active=false）。再所属は UPSERT
--     （ON CONFLICT (group_id, store_id) DO UPDATE SET is_active=true）。
--   - 物理 DELETE は使わない（DELETE ポリシーを作らない／GRANT も DELETE を付与しない）。
--
-- RLS（三層権限・既存マスタと同構成）：
--   - SELECT：認証済み全ロール（期間集計の絞り込みに必要）。
--   - INSERT / UPDATE：executive のみ（is_executive()）。
--   - DELETE：ポリシーを作らない＝RLS で常に拒否（論理削除のみ）。
--
-- 影響範囲：
--   - 新規2テーブルの追加のみ。既存テーブル・データ・実績・税計算（§8.1）には触れない。
--   - 設定コピー（create_store_with_copy）にも触れない（グループ所属はコピー対象外）。
--
-- 冪等性：テーブル/索引は IF NOT EXISTS。ポリシーは DROP POLICY IF EXISTS → CREATE。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. store_groups（グループ本体）
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE store_groups IS '店舗グループ（多対多のまとめ単位）。期間集計の絞り込み・合計に使用。削除は論理削除（is_active=false）。';

CREATE INDEX IF NOT EXISTS idx_store_groups_active ON store_groups(is_active);

DROP TRIGGER IF EXISTS trg_store_groups_updated_at ON store_groups;
CREATE TRIGGER trg_store_groups_updated_at
  BEFORE UPDATE ON store_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 2. store_group_members（所属：group × store の多対多）
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES store_groups(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, store_id)
);

COMMENT ON TABLE store_group_members IS '店舗グループ所属（group_id × store_id）。解除は論理削除（is_active=false）、再所属は UPSERT（ON CONFLICT (group_id, store_id) DO UPDATE is_active=true）。';

CREATE INDEX IF NOT EXISTS idx_store_group_members_group ON store_group_members(group_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_store_group_members_store ON store_group_members(store_id) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_store_group_members_updated_at ON store_group_members;
CREATE TRIGGER trg_store_group_members_updated_at
  BEFORE UPDATE ON store_group_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 3. RLS（SELECT＝全認証ロール／INSERT・UPDATE＝executive のみ／DELETE 無し）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP→CREATE で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE store_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_groups_read_authenticated" ON store_groups;
CREATE POLICY "store_groups_read_authenticated" ON store_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_groups_insert_executive" ON store_groups;
CREATE POLICY "store_groups_insert_executive" ON store_groups
  FOR INSERT TO authenticated WITH CHECK (is_executive());

DROP POLICY IF EXISTS "store_groups_update_executive" ON store_groups;
CREATE POLICY "store_groups_update_executive" ON store_groups
  FOR UPDATE TO authenticated USING (is_executive()) WITH CHECK (is_executive());

ALTER TABLE store_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_group_members_read_authenticated" ON store_group_members;
CREATE POLICY "store_group_members_read_authenticated" ON store_group_members
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_group_members_insert_executive" ON store_group_members;
CREATE POLICY "store_group_members_insert_executive" ON store_group_members
  FOR INSERT TO authenticated WITH CHECK (is_executive());

DROP POLICY IF EXISTS "store_group_members_update_executive" ON store_group_members;
CREATE POLICY "store_group_members_update_executive" ON store_group_members
  FOR UPDATE TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- --------------------------------------------------------------------
-- 4. GRANT（raw SQL 作成テーブルは明示付与。DELETE は付与しない＝物理削除なし）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON store_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON store_group_members TO authenticated;
GRANT ALL ON store_groups TO service_role;
GRANT ALL ON store_group_members TO service_role;
