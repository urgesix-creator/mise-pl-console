-- ====================================================================
-- 042_standard_sga_accounts.sql
-- 販管費（SG&A）の「科目セット」を全店で統一する（入力＝金額は店舗×月ごとに別）
--
-- 背景・要件：
--   「販管費は科目のみ統一してほしい、入力は別」
--   = 販管費の行（科目名・区分 category_tag・並び順、および変動費の計算式科目）は
--     全店で同一にして多店舗PLを比較可能にする。月次の金額は従来どおり店舗×月ごとに別入力。
--     新規店は作成時に必ず同じ標準科目セットが入る（白紙・分岐しない）。
--
-- 採用方式（least-invasive・PL集計ロジックは一切変更しない）：
--   1) 単一の共有マスタ  standard_expense_accounts  を新設（唯一の科目定義源）。
--   2) 標準科目は「手入力科目」として monthly_expenses の枠（amount=0・アンカー月1か月）を
--      全店にシードする。PL 画面は monthly_expenses を科目名で集約して行を作るため、
--      枠が1か月ぶんでも科目は表示され、各月セルは従来どおり個別に上書き入力できる
--      （＝科目は統一・入力は別、を満たす）。
--      ※ expense_formulas（変動費・計算式科目）と monthly_expenses（手入力科目）は
--        PL で「販管費計＝手入力合計＋計算式合計」と単純加算されるため、同一 account_name を
--        両テーブルに置くと二重計上になる。よって標準の手入力科目は monthly_expenses のみに置く。
--   3) create_store_with_copy RPC を改訂：新規店は source の有無にかかわらず、必ず
--      standard_expense_accounts から標準科目をシードする（source からの科目コピーは廃止）。
--      仕入カテゴリ・仕入先・部門のコピー挙動は従来どおり維持。
--   4) 既存店（デモ店＋休止3店）へ標準科目枠をバックフィル（ON CONFLICT DO NOTHING＝
--      既存の金額行は壊さない）。デモ店の旧 expense_formulas 3件（固定額）は、対応する
--      標準手入力科目へ金額を引き継いだうえで削除し、全店で科目セットを完全一致させる。
--
-- 物理削除：デモ店の expense_formulas 3件のみ（CLAUDE.md の例外規定＝科目整理の物理削除に該当）。
-- 税計算(§8.1)・PL集計ロジック・他テーブルには触れない。
-- 冪等性：テーブルは IF NOT EXISTS、シードは ON CONFLICT DO NOTHING、RPC は CREATE OR REPLACE。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. 共有マスタ：標準販管費科目セット（唯一の科目定義源）
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standard_expense_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL UNIQUE,
  category_tag TEXT NOT NULL CHECK (category_tag IN ('labor', 'rent', 'depreciation', 'other')),
  -- 'manual'  = 手入力科目（monthly_expenses の枠として全店にシード）
  -- 'formula' = 変動費の計算式科目（expense_formulas としてシード。現状0件・将来用）
  input_type TEXT NOT NULL DEFAULT 'manual' CHECK (input_type IN ('manual', 'formula')),
  display_order INTEGER NOT NULL DEFAULT 0,
  -- 以下は input_type='formula' のときに expense_formulas へ転記する式パラメータ（manual は未使用）
  calc_type TEXT CHECK (calc_type IS NULL OR calc_type IN ('percent', 'tiered', 'fixed', 'fixed_plus_percent')),
  rate1 NUMERIC(8,5),
  rate2 NUMERIC(8,5),
  threshold NUMERIC(15,2),
  fixed_amount NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- formula のときは calc_type 必須・必要パラメータが揃うこと（expense_formulas と同等の担保）
  CONSTRAINT std_exp_formula_params CHECK (
    input_type = 'manual'
    OR (
      calc_type IS NOT NULL AND CASE calc_type
        WHEN 'percent'            THEN rate1 IS NOT NULL
        WHEN 'tiered'             THEN rate1 IS NOT NULL AND rate2 IS NOT NULL AND threshold IS NOT NULL
        WHEN 'fixed'              THEN fixed_amount IS NOT NULL
        WHEN 'fixed_plus_percent' THEN fixed_amount IS NOT NULL AND rate1 IS NOT NULL
        ELSE FALSE
      END
    )
  )
);

COMMENT ON TABLE standard_expense_accounts IS
  '販管費の標準科目セット（全店共通・唯一の科目定義源）。manual=手入力科目→monthly_expenses枠、formula=計算式科目→expense_formulas。金額（月次入力）は店舗ごとに別管理。';

-- 参照用 RLS/GRANT（認証ユーザーは読み取り可。書込は管理経路のみ想定）
ALTER TABLE standard_expense_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "standard_expense_accounts_read" ON standard_expense_accounts;
CREATE POLICY "standard_expense_accounts_read" ON standard_expense_accounts
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON standard_expense_accounts TO authenticated;
GRANT ALL ON standard_expense_accounts TO service_role;

-- --------------------------------------------------------------------
-- 2. 標準科目セットの投入（日本の飲食店・17科目）
--    区分：labor=人件費 / rent=家賃 / other=その他 / depreciation=減価償却
-- --------------------------------------------------------------------
INSERT INTO standard_expense_accounts (account_name, category_tag, input_type, display_order) VALUES
  ('社員給与',      'labor',        'manual',  1),
  ('アルバイト給与', 'labor',        'manual',  2),
  ('社会保険料',    'labor',        'manual',  3),
  ('採用費',        'labor',        'manual',  4),
  ('地代家賃',      'rent',         'manual',  5),
  ('電気代',        'other',        'manual',  6),
  ('ガス代',        'other',        'manual',  7),
  ('水道代',        'other',        'manual',  8),
  ('通信費',        'other',        'manual',  9),
  ('広告宣伝費',    'other',        'manual', 10),
  ('消耗品費',      'other',        'manual', 11),
  ('衛生費',        'other',        'manual', 12),
  ('修繕費',        'other',        'manual', 13),
  ('リース料',      'other',        'manual', 14),
  ('支払手数料',    'other',        'manual', 15),
  ('雑費',          'other',        'manual', 16),
  ('減価償却費',    'depreciation', 'manual', 17)
ON CONFLICT (account_name) DO NOTHING;

-- --------------------------------------------------------------------
-- 3. create_store_with_copy RPC を改訂
--    新規店は source の有無に関わらず必ず標準科目セットをシード（科目統一）。
--    仕入カテゴリ/仕入先/部門のコピーは従来どおり（source があるときのみ）。
--    店舗本体 INSERT は 041 の定義（has_takeout 含む）を踏襲。
-- --------------------------------------------------------------------
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
  -- 権限ガード（認証ユーザーなら executive 必須。service_role 等は許可）
  IF v_uid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = v_uid AND p.role = 'executive' AND p.is_active = true
    ) THEN
      RAISE EXCEPTION '権限がありません（executive 必須）';
    END IF;
  END IF;

  -- 採番
  PERFORM pg_advisory_xact_lock(hashtext('stores_store_no_seq'));
  SELECT COALESCE(MAX(store_no), 0) + 1 INTO v_new_store_no FROM stores;
  IF v_new_store_no > 999 THEN
    RAISE EXCEPTION '店舗番号が上限(999)に達しました';
  END IF;

  v_fy_start := COALESCE((payload->>'fiscal_year_start_month')::int, 1);

  -- 店舗本体 INSERT（041 と同じ。has_takeout 含む）
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

  -- アンカー月＝新店の現会計年度の期首月
  IF EXTRACT(MONTH FROM CURRENT_DATE)::int >= v_fy_start THEN
    v_anchor := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, v_fy_start, 1);
  ELSE
    v_anchor := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, v_fy_start, 1);
  END IF;

  -- ================================================================
  -- 標準販管費科目セットを必ずシード（source の有無に関わらず・全店で同一科目）
  -- ================================================================
  -- 手入力科目：monthly_expenses の枠（amount=0・アンカー月1か月）
  INSERT INTO monthly_expenses (store_id, year_month, account_name, category_tag, amount, display_order)
  SELECT v_new_store_id, v_anchor, sa.account_name, sa.category_tag, 0, sa.display_order
  FROM standard_expense_accounts sa
  WHERE sa.input_type = 'manual'
  ON CONFLICT (store_id, year_month, account_name) DO NOTHING;
  GET DIAGNOSTICS v_frame_count = ROW_COUNT;

  -- 計算式科目：expense_formulas（現状0件・将来 formula 追加時に自動適用）
  INSERT INTO expense_formulas (
    store_id, account_name, category_tag, calc_type,
    rate1, rate2, threshold, fixed_amount, display_order
  )
  SELECT v_new_store_id, sa.account_name, sa.category_tag, sa.calc_type,
         sa.rate1, sa.rate2, sa.threshold, sa.fixed_amount, sa.display_order
  FROM standard_expense_accounts sa
  WHERE sa.input_type = 'formula'
  ON CONFLICT (store_id, account_name) DO NOTHING;
  GET DIAGNOSTICS v_formula_count = ROW_COUNT;

  -- コピー元が無ければここで終了（白紙登録でも標準科目は上でシード済み）
  IF source_store_id IS NULL THEN
    RETURN jsonb_build_object(
      'store_id', v_new_store_id,
      'store_no', v_new_store_no,
      'anchor_month', v_anchor,
      'copied', jsonb_build_object(
        'purchase_categories', 0, 'suppliers', 0, 'sales_departments', 0,
        'expense_formulas', v_formula_count, 'monthly_expense_frames', v_frame_count
      )
    );
  END IF;

  -- A. 仕入カテゴリ（is_active=true ＋ 有効仕入先が参照する無効カテゴリ）
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

  -- B. 仕入先（is_active=true）。category_id をカテゴリ名一致で新カテゴリへ張り替え
  INSERT INTO suppliers (store_id, category_id, name, display_order, is_active, cost_type)
  SELECT v_new_store_id, nc.id, s.name, s.display_order, s.is_active, s.cost_type
  FROM suppliers s
  JOIN purchase_categories oc ON oc.id = s.category_id
  JOIN purchase_categories nc ON nc.store_id = v_new_store_id
                              AND nc.name = oc.name
  WHERE s.store_id = source_store_id AND s.is_active = true;
  GET DIAGNOSTICS v_sup_count = ROW_COUNT;

  -- C. 部門（is_active=true）
  INSERT INTO sales_departments (store_id, name, display_order, is_active)
  SELECT v_new_store_id, d.name, d.display_order, d.is_active
  FROM sales_departments d
  WHERE d.store_id = source_store_id AND d.is_active = true;
  GET DIAGNOSTICS v_dep_count = ROW_COUNT;

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
  '新規店舗の採番＋作成＋標準販管費科目セットのシード（全店で科目統一）＋（任意）source からの仕入カテゴリ/仕入先/部門コピーを1トランザクションで実行。販管費科目は standard_expense_accounts が唯一の定義源。SECURITY DEFINER。';

GRANT EXECUTE ON FUNCTION create_store_with_copy(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_store_with_copy(jsonb, uuid) TO service_role;

-- --------------------------------------------------------------------
-- 4. 既存店へ標準科目枠をバックフィル（休止店も含め全店を同一科目に）
--    ON CONFLICT DO NOTHING＝既存の金額行（あれば）は一切壊さない。
--    アンカー月＝各店の現会計年度の期首月。
-- --------------------------------------------------------------------
INSERT INTO monthly_expenses (store_id, year_month, account_name, category_tag, amount, display_order)
SELECT
  s.id,
  CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE)::int >= s.fiscal_year_start_month
       THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,     s.fiscal_year_start_month, 1)
       ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, s.fiscal_year_start_month, 1)
  END AS anchor,
  sa.account_name, sa.category_tag, 0, sa.display_order
FROM stores s
CROSS JOIN standard_expense_accounts sa
WHERE sa.input_type = 'manual'
ON CONFLICT (store_id, year_month, account_name) DO NOTHING;

-- --------------------------------------------------------------------
-- 5. デモ店（…aa）の旧 expense_formulas（固定額）を標準手入力科目へ引き継ぎ、旧式は削除
--    給与(800000/labor)→社員給与、店舗家賃(300000/rent)→地代家賃、電気代(80000/other)→電気代。
--    引き継ぎ先はアンカー月の枠（上でシード済み・amount=0 のもののみ更新＝多重適用防止）。
-- --------------------------------------------------------------------
UPDATE monthly_expenses me
SET amount = v.amt, updated_at = NOW()
FROM (VALUES
  ('社員給与', 800000::numeric),
  ('地代家賃', 300000::numeric),
  ('電気代',    80000::numeric)
) AS v(name, amt)
WHERE me.store_id = '00000000-0000-0000-0000-0000000000aa'
  AND me.account_name = v.name
  AND me.year_month = make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1)  -- デモ店は fiscal_year_start_month=1
  AND me.amount = 0;

-- 旧式（給与/店舗家賃/電気代 の計算式科目）を物理削除し、全店で科目セットを完全一致させる。
DELETE FROM expense_formulas
WHERE store_id = '00000000-0000-0000-0000-0000000000aa'
  AND account_name IN ('給与', '店舗家賃', '電気代');
