-- ====================================================================
-- Migration v1.6: profiles に language カラム追加
-- 多言語対応（要件定義 v2.3 6.5節）
-- ====================================================================

-- 1. language カラム追加（CHECK制約付き、デフォルト'ja'）
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ja'
    CHECK (language IN ('ja', 'en', 'th', 'id'));

COMMENT ON COLUMN profiles.language IS
  'UI言語設定。ja=日本語、en=英語、th=タイ語、id=インドネシア語。Phase 2で中国語繁体字(zh-tw)等を追加可能。';

-- 2. インデックスは不要（カラムの値域が4種類のみ、検索キーにもならない）

-- 3. 既存ユーザーのデフォルト値確認
-- ※ DEFAULT 'ja' により自動的に設定されるが、念のため明示的に確認
UPDATE profiles SET language = 'ja' WHERE language IS NULL;

-- ====================================================================
-- 4. 新規招待時の言語デフォルト：店舗の国に応じて自動推定するヘルパー関数
-- ====================================================================
CREATE OR REPLACE FUNCTION suggest_language_by_country(p_country_id TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE p_country_id
    WHEN 'jp' THEN 'ja'
    WHEN 'th' THEN 'th'
    WHEN 'id' THEN 'id'
    WHEN 'tw' THEN 'en'  -- 台湾は英語をデフォルトに（中国語繁体字対応はPhase 2）
    ELSE 'ja'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION suggest_language_by_country IS
  '所属国から推奨UI言語を返す。新規ユーザー招待時のデフォルト値として使用。';

-- ====================================================================
-- 完了通知
-- ====================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 004 applied successfully';
  RAISE NOTICE '   - profiles.language column added (default: ja)';
  RAISE NOTICE '   - CHECK constraint: ja|en|th|id';
  RAISE NOTICE '   - suggest_language_by_country() function created';
  RAISE NOTICE '   - Existing users defaulted to ja';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Run frontend deployment with next-intl integration';
END $$;
