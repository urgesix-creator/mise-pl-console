-- ====================================================================
-- Row Level Security Policies v2.0（本番DB実態に整合・再構築）
-- 5ロールに対するアクセス制御
--
-- 【再構築の経緯（2026-05-30）】
--   本ファイルは「本番DBの実際のRLS定義」を正として再構築したもの。
--   旧版（v1.0）は auth スキーマにヘルパー関数を定義し auth.user_role() 等を
--   参照していたが、本番DBの実態は public スキーマ＋current_user_role() に
--   移行済みで乖離していた。本版で実態に一致させた（旧版は .bak に退避）。
--
--   主な実態（旧版との差分）：
--     - ヘルパー関数は public スキーマ。SECURITY DEFINER / SET search_path TO ''。
--     - ロール取得は current_user_role()（旧 auth.user_role()）。
--     - 所属国は current_user_country()（旧 auth.user_country()）。
--     - exchange_rates 書込は executive + accounting（ポリシー名 _write_admin）。
--     - expense_accounts は roles=public、store_id IS NULL（全社共通科目）分岐あり。
--
--   ※ 新規テーブルへのRLS自動有効化トリガ（ensure_rls / rls_auto_enable()）は
--     役割が異なるため別ファイル 008_event_trigger_ensure_rls.sql に分離。
--
--   冪等化：関数は CREATE OR REPLACE、ポリシーは DROP POLICY IF EXISTS 併用
--           （CREATE POLICY は IF NOT EXISTS 非対応のため）。
-- ====================================================================

-- ====================================================================
-- HELPER FUNCTIONS（public スキーマ。本番DB pg_get_functiondef 全文に一致）
-- ====================================================================

-- 現在のユーザーのロール取得
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND is_active = TRUE;
$function$;

-- 現在のユーザーの所属国取得
CREATE OR REPLACE FUNCTION public.current_user_country()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT country_id FROM public.profiles
  WHERE id = auth.uid() AND is_active = TRUE;
$function$;

-- 現在のユーザーが指定店舗にアクセス可能か
CREATE OR REPLACE FUNCTION public.can_access_store(p_store_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND (
        -- 経営層・経理は全店アクセス
        p.role IN ('executive', 'accounting')
        -- 各国代表は担当国の店舗
        OR (p.role = 'country_rep' AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = p_store_id AND s.country_id = p.country_id
        ))
        -- 店長・現場社員は割当店舗のみ
        OR EXISTS (
          SELECT 1 FROM public.user_store_assignments usa
          WHERE usa.user_id = p.id AND usa.store_id = p_store_id
        )
      )
  );
$function$;

-- 現在のユーザーが書き込み権限を持つか
CREATE OR REPLACE FUNCTION public.can_write()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.current_user_role() IN ('executive', 'country_rep', 'store_manager', 'staff');
$function$;

-- 現在のユーザーが管理者権限（経営層）か
CREATE OR REPLACE FUNCTION public.is_executive()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.current_user_role() = 'executive';
$function$;

-- ====================================================================
-- ENABLE RLS ON ALL TABLES（16テーブル。すべて rls_forced=false）
-- ====================================================================
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_departments ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- countries（全認証ユーザー読取、経営層書込）
-- ====================================================================
DROP POLICY IF EXISTS "countries_read_authenticated" ON countries;
CREATE POLICY "countries_read_authenticated" ON countries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "countries_write_executive" ON countries;
CREATE POLICY "countries_write_executive" ON countries
  FOR ALL TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- ====================================================================
-- currencies（全認証ユーザー読取、経営層書込）
-- ====================================================================
DROP POLICY IF EXISTS "currencies_read_authenticated" ON currencies;
CREATE POLICY "currencies_read_authenticated" ON currencies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "currencies_write_executive" ON currencies;
CREATE POLICY "currencies_write_executive" ON currencies
  FOR ALL TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- ====================================================================
-- profiles
-- ====================================================================
DROP POLICY IF EXISTS "profiles_read_self" ON profiles;
CREATE POLICY "profiles_read_self" ON profiles
  FOR SELECT TO authenticated USING ((id = auth.uid()));

DROP POLICY IF EXISTS "profiles_read_admin" ON profiles;
CREATE POLICY "profiles_read_admin" ON profiles
  FOR SELECT TO authenticated USING ((current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text])));

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));

DROP POLICY IF EXISTS "profiles_write_executive" ON profiles;
CREATE POLICY "profiles_write_executive" ON profiles
  FOR ALL TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- ====================================================================
-- stores
-- ====================================================================
DROP POLICY IF EXISTS "stores_read_accessible" ON stores;
CREATE POLICY "stores_read_accessible" ON stores
  FOR SELECT TO authenticated USING (can_access_store(id));

DROP POLICY IF EXISTS "stores_write_executive" ON stores;
CREATE POLICY "stores_write_executive" ON stores
  FOR ALL TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- ====================================================================
-- user_store_assignments
-- ====================================================================
DROP POLICY IF EXISTS "user_store_assignments_read_self" ON user_store_assignments;
CREATE POLICY "user_store_assignments_read_self" ON user_store_assignments
  FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "user_store_assignments_read_admin" ON user_store_assignments;
CREATE POLICY "user_store_assignments_read_admin" ON user_store_assignments
  FOR SELECT TO authenticated USING ((current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text])));

DROP POLICY IF EXISTS "user_store_assignments_write_executive" ON user_store_assignments;
CREATE POLICY "user_store_assignments_write_executive" ON user_store_assignments
  FOR ALL TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- ====================================================================
-- exchange_rates（書込は経営層＋経理。ポリシー名は _write_admin）
-- ====================================================================
DROP POLICY IF EXISTS "exchange_rates_read_authenticated" ON exchange_rates;
CREATE POLICY "exchange_rates_read_authenticated" ON exchange_rates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "exchange_rates_write_admin" ON exchange_rates;
CREATE POLICY "exchange_rates_write_admin" ON exchange_rates
  FOR ALL TO authenticated USING (
    (current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text]))
  ) WITH CHECK (
    (current_user_role() = ANY (ARRAY['executive'::text, 'accounting'::text]))
  );

-- ====================================================================
-- purchase_categories（店舗別マスタ。書込は店長以上）
-- ====================================================================
DROP POLICY IF EXISTS "purchase_categories_read_accessible" ON purchase_categories;
CREATE POLICY "purchase_categories_read_accessible" ON purchase_categories
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "purchase_categories_write" ON purchase_categories;
CREATE POLICY "purchase_categories_write" ON purchase_categories
  FOR ALL TO authenticated USING (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  ) WITH CHECK (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  );

-- ====================================================================
-- suppliers（店舗別マスタ。書込は店長以上）
-- ====================================================================
DROP POLICY IF EXISTS "suppliers_read_accessible" ON suppliers;
CREATE POLICY "suppliers_read_accessible" ON suppliers
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "suppliers_write" ON suppliers;
CREATE POLICY "suppliers_write" ON suppliers
  FOR ALL TO authenticated USING (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  ) WITH CHECK (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  );

-- ====================================================================
-- expense_accounts（roles=public。store_id IS NULL の全社共通科目分岐あり）
--   ※ 本番DB実定義どおり roles を public とする（他テーブルは authenticated）。
-- ====================================================================
DROP POLICY IF EXISTS "expense_accounts_read_accessible" ON expense_accounts;
CREATE POLICY "expense_accounts_read_accessible" ON expense_accounts
  FOR SELECT TO public USING (
    ((store_id IS NULL) OR can_access_store(store_id))
  );

DROP POLICY IF EXISTS "expense_accounts_write" ON expense_accounts;
CREATE POLICY "expense_accounts_write" ON expense_accounts
  FOR ALL TO public USING (
    (((store_id IS NULL) AND (current_user_role() = 'executive'::text)) OR ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id)))
  ) WITH CHECK (
    (((store_id IS NULL) AND (current_user_role() = 'executive'::text)) OR ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id)))
  );

-- ====================================================================
-- daily_sales（最重要：日次入力データ。書込は can_write()＝現場社員含む）
-- ====================================================================
DROP POLICY IF EXISTS "daily_sales_read_accessible" ON daily_sales;
CREATE POLICY "daily_sales_read_accessible" ON daily_sales
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "daily_sales_write" ON daily_sales;
CREATE POLICY "daily_sales_write" ON daily_sales
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- ====================================================================
-- daily_purchases（書込は can_write()）
-- ====================================================================
DROP POLICY IF EXISTS "daily_purchases_read_accessible" ON daily_purchases;
CREATE POLICY "daily_purchases_read_accessible" ON daily_purchases
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "daily_purchases_write" ON daily_purchases;
CREATE POLICY "daily_purchases_write" ON daily_purchases
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- ====================================================================
-- daily_expenses（書込は can_write()）
-- ====================================================================
DROP POLICY IF EXISTS "daily_expenses_read_accessible" ON daily_expenses;
CREATE POLICY "daily_expenses_read_accessible" ON daily_expenses
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "daily_expenses_write" ON daily_expenses;
CREATE POLICY "daily_expenses_write" ON daily_expenses
  FOR ALL TO authenticated USING (
    (can_write() AND can_access_store(store_id))
  ) WITH CHECK (
    (can_write() AND can_access_store(store_id))
  );

-- ====================================================================
-- daily_targets（目標は店長以上が変更可能）
-- ====================================================================
DROP POLICY IF EXISTS "daily_targets_read_accessible" ON daily_targets;
CREATE POLICY "daily_targets_read_accessible" ON daily_targets
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "daily_targets_write" ON daily_targets;
CREATE POLICY "daily_targets_write" ON daily_targets
  FOR ALL TO authenticated USING (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  ) WITH CHECK (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  );

-- ====================================================================
-- inventory_estimates（書込は can_write()）
-- ====================================================================
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

-- ====================================================================
-- system_settings（読取は全認証ユーザー、書込は経営層のみ）
-- ====================================================================
DROP POLICY IF EXISTS "system_settings_read_authenticated" ON system_settings;
CREATE POLICY "system_settings_read_authenticated" ON system_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "system_settings_write_executive" ON system_settings;
CREATE POLICY "system_settings_write_executive" ON system_settings
  FOR ALL TO authenticated USING (is_executive()) WITH CHECK (is_executive());

-- ====================================================================
-- sales_departments（部門マスタ・参考データ用。書込は店長以上。007で追加）
-- ====================================================================
DROP POLICY IF EXISTS "sales_departments_read_accessible" ON sales_departments;
CREATE POLICY "sales_departments_read_accessible" ON sales_departments
  FOR SELECT TO authenticated USING (can_access_store(store_id));

DROP POLICY IF EXISTS "sales_departments_write" ON sales_departments;
CREATE POLICY "sales_departments_write" ON sales_departments
  FOR ALL TO authenticated USING (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  ) WITH CHECK (
    ((current_user_role() = ANY (ARRAY['executive'::text, 'country_rep'::text, 'store_manager'::text])) AND can_access_store(store_id))
  );
