-- ====================================================================
-- 029_copy_supplier_cost_type.sql
-- create_store_with_copy（026）を更新：仕入先の複製時に cost_type も引き継ぐ
--
-- 目的：
--   028 で suppliers.cost_type を追加したため、設定コピー（新規店舗を既存店から複製）で
--   仕入先を複製する際に cost_type（売上原価/販管費の区分）も引き継ぐようにする。
--   他のコピー仕様（026）は一切変更しない。INSERT のみ・SECURITY DEFINER・原子性も同じ。
--
-- 変更点：B. 仕入先 INSERT に cost_type 列を追加（SELECT 側に s.cost_type）。
--
-- 冪等性：CREATE OR REPLACE FUNCTION（定義の置き換えのみ・データ非変更）。
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

  -- B. 仕入先（is_active=true）。category_id をカテゴリ名一致で張り替え。cost_type も引き継ぐ。
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
