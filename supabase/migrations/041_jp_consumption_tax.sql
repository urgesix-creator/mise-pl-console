-- ====================================================================
-- 041_jp_consumption_tax.sql
-- 日本の消費税（標準10% / 軽減8%）対応
--
-- 目的：
--   海外向けの税制（サービス料＋現地VAT・net_plus_service）を廃し、
--   日本の消費税に一本化する。売上の税区分（標準/軽減）を日次レコード単位で保持し、
--   軽減税率（テイクアウト）を使う店舗だけ税区分セレクタを出す。
--
-- 変更点：
--   A. daily_sales.tax_category（standard=10% / reduced=8%）を追加。既定 standard。
--   B. stores.has_takeout（軽減8%を使う＝税区分セレクタを表示）を追加。既定 false。
--   C. jp 国マスタを消費税型（net_sales / 10% / 消費税）に確定（冪等）。
--   D. デモ店（…aa）を has_takeout=true・service_fee_rate=0・仕入標準10% に設定。
--   E. create_store_with_copy RPC を更新し、新規店舗作成時に has_takeout を受け取れるようにする。
--
-- 冪等性：IF NOT EXISTS / UPDATE / CREATE OR REPLACE のみ。再実行安全。
-- ====================================================================

-- A. 売上の税区分（店舗の1日単位）。standard=10%, reduced=8%（テイクアウト）
ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS tax_category text NOT NULL DEFAULT 'standard'
  CHECK (tax_category IN ('standard', 'reduced'));

-- B. 店舗が軽減税率（テイクアウト）を使うか。true のとき税区分セレクタを表示
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS has_takeout boolean NOT NULL DEFAULT false;

-- C. jp 国マスタを消費税型に確定（既に整形済みでも冪等に上書き）
UPDATE countries
  SET tax_base = 'net_sales', tax_rate = 0.10, tax_label = '消費税'
  WHERE id = 'jp';

-- D. デモ店：軽減税率あり・サービス料0・仕入標準10%
UPDATE stores
  SET has_takeout = true,
      service_fee_rate = 0,
      purchase_tax_rate_default = 10
  WHERE id = '00000000-0000-0000-0000-0000000000aa';

-- E. create_store_with_copy を更新：stores INSERT に has_takeout を追加（029 の定義を踏襲）。
--    他のコピー仕様は一切変更しない（INSERT のみ・SECURITY DEFINER・原子性も同じ）。
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
  IF v_uid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = v_uid AND p.role = 'executive' AND p.is_active = true
    ) THEN
      RAISE EXCEPTION '権限がありません（executive 必須）';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('stores_store_no_seq'));
  SELECT COALESCE(MAX(store_no), 0) + 1 INTO v_new_store_no FROM stores;

  IF v_new_store_no > 999 THEN
    RAISE EXCEPTION '店舗番号が上限(999)に達しました';
  END IF;

  v_fy_start := COALESCE((payload->>'fiscal_year_start_month')::int, 1);

  INSERT INTO stores (
    store_no, name, country_id, currency_id, timezone,
    service_fee_rate, employee_rebate_rate, fiscal_year_start_month,
    is_weather_enabled, is_event_enabled, established_date, display_order, is_active,
    has_takeout
  ) VALUES (
    v_new_store_no,
    payload->>'name',
    payload->>'country_id',
    payload->>'currency_id',
    payload->>'timezone',
    COALESCE((payload->>'service_fee_rate')::numeric, 0),
    COALESCE((payload->>'employee_rebate_rate')::numeric, 0),
    v_fy_start,
    COALESCE((payload->>'is_weather_enabled')::boolean, true),
    COALESCE((payload->>'is_event_enabled')::boolean, false),
    NULLIF(payload->>'established_date', '')::date,
    COALESCE((payload->>'display_order')::int, 0),
    true,
    COALESCE((payload->>'has_takeout')::boolean, false)
  )
  RETURNING id INTO v_new_store_id;

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

  INSERT INTO suppliers (store_id, category_id, name, display_order, is_active, cost_type)
  SELECT v_new_store_id, nc.id, s.name, s.display_order, s.is_active, s.cost_type
  FROM suppliers s
  JOIN purchase_categories oc ON oc.id = s.category_id
  JOIN purchase_categories nc ON nc.store_id = v_new_store_id
                              AND nc.name = oc.name
  WHERE s.store_id = source_store_id AND s.is_active = true;
  GET DIAGNOSTICS v_sup_count = ROW_COUNT;

  INSERT INTO sales_departments (store_id, name, display_order, is_active)
  SELECT v_new_store_id, d.name, d.display_order, d.is_active
  FROM sales_departments d
  WHERE d.store_id = source_store_id AND d.is_active = true;
  GET DIAGNOSTICS v_dep_count = ROW_COUNT;

  INSERT INTO expense_formulas (
    store_id, account_name, category_tag, calc_type,
    rate1, rate2, threshold, fixed_amount, display_order
  )
  SELECT v_new_store_id, f.account_name, f.category_tag, f.calc_type,
         f.rate1, f.rate2, f.threshold, f.fixed_amount, f.display_order
  FROM expense_formulas f
  WHERE f.store_id = source_store_id;
  GET DIAGNOSTICS v_formula_count = ROW_COUNT;

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
