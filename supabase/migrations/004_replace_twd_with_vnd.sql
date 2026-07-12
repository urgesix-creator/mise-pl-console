-- ====================================================================
-- 004_replace_twd_with_vnd.sql
-- TWD（台湾ドル）を VND（ベトナムドン）に置き換える
-- 適用日: 2026-05-14
-- 前提: TWD を参照する stores / exchange_rates レコードが無いこと
--       参照がある場合はマイグレーション全体が中止される（安全装置）
-- ====================================================================

BEGIN;

-- 参照件数を事前にチェック。参照があれば例外で中止
DO $$
DECLARE
  v_store_count INTEGER;
  v_rate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_store_count FROM stores WHERE currency_id = 'twd';

  SELECT COUNT(*) INTO v_rate_count FROM exchange_rates
    WHERE from_currency_id = 'twd' OR to_currency_id = 'twd';

  IF v_store_count > 0 OR v_rate_count > 0 THEN
    RAISE EXCEPTION
      'TWD を参照中のレコードがあります（stores: %, exchange_rates: %）。先に UI 経由で参照を解消してから再実行してください。',
      v_store_count, v_rate_count;
  END IF;
END $$;

-- TWD を削除して VND を追加
DELETE FROM currencies WHERE id = 'twd';

INSERT INTO currencies (id, code, symbol, name, display_order)
VALUES ('vnd', 'VND', '₫', 'ベトナムドン', 5)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- 確認用クエリ（実行後にコメントを外して結果を確認可能）
-- SELECT id, code, symbol, name, display_order FROM currencies ORDER BY display_order;
