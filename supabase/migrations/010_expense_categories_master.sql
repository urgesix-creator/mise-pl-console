-- ====================================================================
-- 010_expense_categories_master.sql
-- 販管費「上位分類（level1）」の固定CHECK制約 → マスタ方式への移行
--
-- 目的：
--   expense_accounts.level1（TEXT＋CHECK制約で8区分固定）を、
--   独立マスタ expense_categories（全社共通・FK参照）に置き換える。
--   これにより上位分類の「増やす・減らす・改名」が運用で自由に行える。
--     - 改名：expense_categories 1行更新で全科目に反映
--     - 減らす：is_active=FALSE（使用中は ON DELETE RESTRICT で物理削除を保護）
--     - 増やす：マスタに行追加（UIはDBフェッチ化するため選択肢が自動で増える）
--
-- 確定した設計方針（比嘉専務承認済み）：
--   - スコープ：全社共通のみ（expense_categories は store_id を持たない）
--   - 参照方式：FK(id) 参照（expense_accounts.category_id UUID → expense_categories.id）
--
-- 移行方式：バックフィル型（既存データを捨てない）
--   本番DBには既に expense_accounts が 19 行存在する（daily_expenses は 0 行）。
--   既存行を保全したまま level1(日本語ラベル) で名前マッチして category_id を埋める。
--
-- 既存19行の level1 分布（移行時点の想定マッチ。全6値が標準8区分に1:1で含まれる）：
--   人件費       6行 → expense_categories.name='人件費'
--   光熱費       5行 → '光熱費'
--   賃料         3行 → '賃料'
--   広告宣伝費   3行 → '広告宣伝費'
--   支払手数料   1行 → '支払手数料'
--   その他販管費 1行 → 'その他販管費'
--   （減価償却費・消耗品費 は現状未使用だが、選択肢として標準8区分に投入する）
--
-- RLS は本番DBの実態（public スキーマのヘルパー関数）に合わせる：
--   - 読取：全認証ユーザー（countries / currencies と同じ全社共通マスタ扱い）
--   - 書込：経営層＋経理＝ current_user_role() IN ('executive','accounting')
--           （exchange_rates_write_admin と同パターン。全社共通の経理系マスタ）
--
-- 冪等性：本ファイルは再実行可能。
--   - テーブル/列/索引：IF NOT EXISTS、ポリシー：DROP IF EXISTS→CREATE。
--   - バックフィルと level1 列の削除は「level1 列が残っているか」を判定して条件実行。
--   - 不完全なバックフィル（NULL残）は RAISE EXCEPTION でロールバックして停止。
--
-- 003_seed_data.sql との整合（注意）：
--   003 は expense_accounts に level1 を直接 INSERT する。本マイグレーション適用後は
--   level1 列が存在しないため、003 を「そのまま」再実行すると失敗する。
--   マイグレーションは前進専用（003 は適用済み）であり再実行しない運用が前提。
--   将来 003 を作り直す場合は category_id 方式へ更新すること（別タスク）。
--
-- 適用後に必要な後続作業（本ファイルの範囲外・別途）：
--   - types/database.ts 再生成（ExpenseLevel1 union 削除・ExpenseCategory 追加）
--   - Server Action / UI を category_id ベースへ
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. expense_categories テーブル作成（全社共通マスタ。store_id は持たない）
--    name は UNIQUE：バックフィルの名前マッチと種データの冪等投入の前提。
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                                     -- 上位分類名（改名はこの1行を更新）
  display_order INTEGER NOT NULL DEFAULT 0,                      -- 表示順（アコーディオン順）
  is_active BOOLEAN NOT NULL DEFAULT TRUE,                       -- ソフト削除（使用中は物理削除をFKで保護）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expense_categories IS '販管費上位分類マスタ（全社共通）。expense_accounts.category_id から参照。改名・増減を運用で自由に行うためのマスタ。';

-- updated_at 自動更新トリガ（既存の共通関数を流用）
DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------
-- 2. 標準8区分を投入（現状の LEVEL1_VALUES の並び順を踏襲）
--    ON CONFLICT(name) DO NOTHING で冪等化（再実行時に display_order を上書きしない）。
-- --------------------------------------------------------------------
INSERT INTO expense_categories (name, display_order) VALUES
  ('人件費',       1),
  ('賃料',         2),
  ('光熱費',       3),
  ('広告宣伝費',   4),
  ('減価償却費',   5),
  ('支払手数料',   6),
  ('消耗品費',     7),
  ('その他販管費', 8)
ON CONFLICT (name) DO NOTHING;

-- --------------------------------------------------------------------
-- 3. expense_accounts に category_id 列を追加（最初は NULL許容）
-- --------------------------------------------------------------------
ALTER TABLE expense_accounts ADD COLUMN IF NOT EXISTS category_id UUID;

-- --------------------------------------------------------------------
-- 4-5. バックフィル ＋ 完全性検証（level1 列が残っている場合のみ実行）
--    level1(日本語ラベル) = expense_categories.name で名前マッチして category_id を埋める。
--    NULL が残ったら（標準8区分に無い level1 値が存在したら）例外で停止しロールバック。
-- --------------------------------------------------------------------
DO $$
DECLARE
  has_level1 BOOLEAN;
  unmatched  INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'expense_accounts'
      AND column_name  = 'level1'
  ) INTO has_level1;

  IF has_level1 THEN
    -- バックフィル（未設定行のみ）
    UPDATE expense_accounts ea
    SET category_id = ec.id
    FROM expense_categories ec
    WHERE ea.category_id IS NULL
      AND ea.level1 = ec.name;

    -- 完全性検証：1行でも category_id が NULL なら停止
    SELECT count(*) INTO unmatched
    FROM expense_accounts
    WHERE category_id IS NULL;

    IF unmatched > 0 THEN
      RAISE EXCEPTION
        'expense_categories backfill incomplete: % row(s) in expense_accounts have NULL category_id (level1 did not match any expense_categories.name). Migration aborted and rolled back.',
        unmatched;
    END IF;
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 6. category_id を NOT NULL 化・FK付与（ON DELETE RESTRICT）・索引作成
--    ここに到達した時点で NULL は無い（上の検証を通過 or level1 既に削除済み）。
-- --------------------------------------------------------------------
ALTER TABLE expense_accounts ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE expense_accounts DROP CONSTRAINT IF EXISTS expense_accounts_category_id_fkey;
ALTER TABLE expense_accounts
  ADD CONSTRAINT expense_accounts_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_expense_accounts_category
  ON expense_accounts(category_id);

-- --------------------------------------------------------------------
-- 7. 旧 level1 の CHECK制約・索引・列を削除
-- --------------------------------------------------------------------
ALTER TABLE expense_accounts DROP CONSTRAINT IF EXISTS expense_accounts_level1_check;
DROP INDEX IF EXISTS idx_expense_accounts_level1;
ALTER TABLE expense_accounts DROP COLUMN IF EXISTS level1;

COMMENT ON TABLE expense_accounts IS '販管費科目（店舗別）。上位分類は expense_categories マスタを category_id で参照（旧 level1 固定区分から移行）。';

-- --------------------------------------------------------------------
-- 8. RLS（全社共通の経理系マスタ。exchange_rates と同パターン）
--    読取：全認証ユーザー／書込：経営層＋経理（executive または accounting）
--    CREATE POLICY は IF NOT EXISTS 非対応のため DROP POLICY IF EXISTS で冪等化。
-- --------------------------------------------------------------------
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_read_authenticated" ON expense_categories;
CREATE POLICY "expense_categories_read_authenticated" ON expense_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_categories_write_executive" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_write_admin" ON expense_categories;
CREATE POLICY "expense_categories_write_admin" ON expense_categories
  FOR ALL TO authenticated USING (
    (current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text]))
  ) WITH CHECK (
    (current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text]))
  );

-- --------------------------------------------------------------------
-- 9. GRANT（raw SQL 作成テーブルは明示付与。実アクセス制御は RLS）
-- --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON expense_categories TO authenticated;
GRANT ALL ON expense_categories TO service_role;
