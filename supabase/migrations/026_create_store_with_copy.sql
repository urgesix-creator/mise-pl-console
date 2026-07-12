-- ====================================================================
-- 026_create_store_with_copy.sql
-- 新規店舗の作成＋既存店からの設定コピーを「1トランザクション」で行う RPC
--
-- 目的：
--   店舗マスタの新規登録時に、
--     1) 店舗番号の自動採番（MAX+1）
--     2) stores への店舗本体 INSERT
--     3)（任意）コピー元店舗からの子マスタ複製
--   を単一トランザクションで実行する。途中で失敗したら全ロールバックし、
--   「店舗本体だけ作られて子の複製が中途半端」という状態を防ぐ。
--
-- シグネチャ：
--   create_store_with_copy(payload jsonb, source_store_id uuid DEFAULT NULL) RETURNS jsonb
--   - SECURITY DEFINER（RLS をまたいで原子的に複製する）。
--   - source_store_id が NULL の場合は採番＋店舗作成のみ（白紙登録）。
--
-- 権限ガード：
--   - 呼び出し元が認証ユーザー（auth.uid() IS NOT NULL）の場合は executive 必須。
--   - auth.uid() が NULL（service_role / 管理接続）の場合はサーバ側で信頼済みとして許可。
--   ※ 通常の業務経路では Server Action 側でも executive を検証してから呼ぶ（二重防御）。
--
-- コピー仕様（確定設計）：
--   対象は is_active = true のもののみ。順序とFK張り替え：
--     A. 仕入カテゴリ（purchase_categories）
--        - is_active=true を複製。
--        - 例外：有効な仕入先が参照する無効カテゴリは、FK整合のため is_active=false のまま複製。
--     B. 仕入先（suppliers）
--        - is_active=true を複製。category_id は「カテゴリ名の一致」で新カテゴリへ張り替え
--          （(store_id, name) が UNIQUE のため名前で一意対応可能）。
--     C. 部門（sales_departments）：is_active=true を複製。
--     D. 変動費計算式（expense_formulas）：is_active 列なし＝全件・全パラメータを複製。
--     E. 販管費科目の枠（monthly_expenses・案A 単一アンカー月）：
--        - コピー元の全期間の distinct account_name を対象に、各科目の最新行
--          （year_month 降順の先頭）から category_tag・display_order を取得し、
--        - amount=0 で「新店の現会計年度の期首月」1か月分だけ INSERT。
--        - アンカー月 = CURRENT_DATE と新店 fiscal_year_start_month から算出。
--   複製しない：店舗名・設立日・実績データ（daily_sales / daily_purchases /
--   daily_targets / monthly_business_days / 棚卸 / 販管費の金額）。
--
-- 物理削除なし（本関数は INSERT のみ）。
-- 税計算（§8.1）・月次PL計算ロジック・他機能には触れない。
--
-- 冪等性：CREATE OR REPLACE FUNCTION。再適用は定義の置き換えのみ（データ非変更）。
-- ====================================================================

CREATE OR REPLACE FUNCTION create_store_with_copy(
  payload jsonb,
  source_store_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_store_id uuid;
  v_new_store_no smallint;
  v_fy_start int;
  v_anchor date;
  v_cat_count int := 0;
  v_sup_count int := 0;
  v_dep_count int := 0;
  v_formula_count int := 0;
  v_frame_count int := 0;
BEGIN
  -- --- 権限ガード（認証ユーザーなら executive 必須） ---
  IF v_uid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = v_uid AND p.role = 'executive' AND p.is_active = true
    ) THEN
      RAISE EXCEPTION '権限がありません（executive 必須）';
    END IF;
  END IF;

  -- --- 採番（同時登録の競合回避にトランザクションスコープの advisory lock）---
  PERFORM pg_advisory_xact_lock(hashtext('stores_store_no_seq'));
  SELECT COALESCE(MAX(store_no), 0) + 1 INTO v_new_store_no FROM stores;

  IF v_new_store_no > 999 THEN
    RAISE EXCEPTION '店舗番号が上限(999)に達しました';
  END IF;

  -- --- 店舗本体 INSERT ---
  v_fy_start := COALESCE((payload->>'fiscal_year_start_month')::int, 1);

  INSERT INTO stores (
    store_no, name, country_id, currency_id, timezone,
    service_fee_rate, employee_rebate_rate, fiscal_year_start_month,
    is_weather_enabled, is_event_enabled, established_date, display_order, is_active
  ) VALUES (
    v_new_store_no,
    payload->>'name',
    payload->>'country_id',
    payload->>'currency_id',
    payload->>'timezone',
    COALESCE((payload->>'service_fee_rate')::numeric, 0.10),
    COALESCE((payload->>'employee_rebate_rate')::numeric, 0),
    v_fy_start,
    COALESCE((payload->>'is_weather_enabled')::boolean, true),
    COALESCE((payload->>'is_event_enabled')::boolean, false),
    NULLIF(payload->>'established_date', '')::date,
    COALESCE((payload->>'display_order')::int, 0),
    true
  )
  RETURNING id INTO v_new_store_id;

  -- --- コピー元が無ければここで終了（白紙登録） ---
  IF source_store_id IS NULL THEN
    RETURN jsonb_build_object(
      'store_id', v_new_store_id,
      'store_no', v_new_store_no,
      'copied', jsonb_build_object(
        'purchase_categories', 0, 'suppliers', 0, 'sales_departments', 0,
        'expense_formulas', 0, 'monthly_expense_frames', 0
      )
    );
  END IF;

  -- ================================================================
  -- A. 仕入カテゴリ（is_active=true ＋ 有効仕入先が参照する無効カテゴリ）
  -- ================================================================
  INSERT INTO purchase_categories (store_id, name, display_order, is_active)
  SELECT v_new_store_id, pc.name, pc.display_order, pc.is_active
  FROM purchase_categories pc
  WHERE pc.store_id = source_store_id
    AND (
      pc.is_active = true
      OR pc.id IN (
        SELECT s.category_id FROM suppliers s
        WHERE s.store_id = source_store_id AND s.is_active = true
      )
    );
  GET DIAGNOSTICS v_cat_count = ROW_COUNT;

  -- ================================================================
  -- B. 仕入先（is_active=true）。category_id をカテゴリ名一致で新カテゴリへ張り替え
  -- ================================================================
  INSERT INTO suppliers (store_id, category_id, name, display_order, is_active)
  SELECT v_new_store_id, nc.id, s.name, s.display_order, s.is_active
  FROM suppliers s
  JOIN purchase_categories oc ON oc.id = s.category_id            -- 旧カテゴリ
  JOIN purchase_categories nc ON nc.store_id = v_new_store_id     -- 新カテゴリ（名前一致）
                              AND nc.name = oc.name
  WHERE s.store_id = source_store_id AND s.is_active = true;
  GET DIAGNOSTICS v_sup_count = ROW_COUNT;

  -- ================================================================
  -- C. 部門（is_active=true）
  -- ================================================================
  INSERT INTO sales_departments (store_id, name, display_order, is_active)
  SELECT v_new_store_id, d.name, d.display_order, d.is_active
  FROM sales_departments d
  WHERE d.store_id = source_store_id AND d.is_active = true;
  GET DIAGNOSTICS v_dep_count = ROW_COUNT;

  -- ================================================================
  -- D. 変動費計算式（全件・全パラメータ。is_active 列なし）
  -- ================================================================
  INSERT INTO expense_formulas (
    store_id, account_name, category_tag, calc_type,
    rate1, rate2, threshold, fixed_amount, display_order
  )
  SELECT v_new_store_id, f.account_name, f.category_tag, f.calc_type,
         f.rate1, f.rate2, f.threshold, f.fixed_amount, f.display_order
  FROM expense_formulas f
  WHERE f.store_id = source_store_id;
  GET DIAGNOSTICS v_formula_count = ROW_COUNT;

  -- ================================================================
  -- E. 販管費科目の枠（案A：単一アンカー月・amount=0）
  -- ================================================================
  -- アンカー月＝新店の現会計年度の期首月（CURRENT_DATE と fiscal_year_start_month から算出）
  IF EXTRACT(MONTH FROM CURRENT_DATE)::int >= v_fy_start THEN
    v_anchor := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, v_fy_start, 1);
  ELSE
    v_anchor := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, v_fy_start, 1);
  END IF;

  INSERT INTO monthly_expenses (store_id, year_month, account_name, category_tag, amount, display_order)
  SELECT v_new_store_id, v_anchor, x.account_name, x.category_tag, 0, x.display_order
  FROM (
    SELECT DISTINCT ON (me.account_name)
           me.account_name, me.category_tag, me.display_order
    FROM monthly_expenses me
    WHERE me.store_id = source_store_id
    ORDER BY me.account_name, me.year_month DESC
  ) x;
  GET DIAGNOSTICS v_frame_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'store_id', v_new_store_id,
    'store_no', v_new_store_no,
    'anchor_month', v_anchor,
    'copied', jsonb_build_object(
      'purchase_categories', v_cat_count,
      'suppliers', v_sup_count,
      'sales_departments', v_dep_count,
      'expense_formulas', v_formula_count,
      'monthly_expense_frames', v_frame_count
    )
  );
END;
$$;

COMMENT ON FUNCTION create_store_with_copy(jsonb, uuid) IS
  '新規店舗の採番＋作成＋（任意）既存店からの設定コピーを1トランザクションで実行。is_active=true のみ複製（FK整合のため有効仕入先が参照する無効カテゴリは例外で複製）。販管費は枠のみ amount=0・単一アンカー月。実績データは複製しない。SECURITY DEFINER。';

-- 実行権限（認証ユーザーから呼べるように。内部で executive を検証）
GRANT EXECUTE ON FUNCTION create_store_with_copy(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_store_with_copy(jsonb, uuid) TO service_role;
