-- ====================================================================
-- KOGAホールディングス海外飲食店 売上管理システム
-- Initial Schema Migration v1.0
-- Reference: data_model_v1.5
-- ====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- COMMON FUNCTIONS
-- ====================================================================

-- updated_at自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 1. countries（国マスタ：レイヤー4）
-- ====================================================================
CREATE TABLE countries (
  id TEXT PRIMARY KEY,                                            -- 'th', 'id', 'jp', 'tw'
  name TEXT NOT NULL,                                             -- 'タイ', 'インドネシア'
  code TEXT NOT NULL UNIQUE,                                      -- 'TH', 'ID', 'JP', 'TW'
  flag TEXT,                                                      -- '🇹🇭'
  tax_rate NUMERIC(5,4) NOT NULL,                                 -- 0.0700
  tax_base TEXT NOT NULL CHECK (tax_base IN ('net_sales', 'net_plus_service')),
  tax_label TEXT NOT NULL,                                        -- 'VAT', 'PB1', '消費税'
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_countries_updated_at BEFORE UPDATE ON countries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE countries IS '国マスタ。税制（税率・課税ベース）を保持。';

-- ====================================================================
-- 2. currencies（通貨マスタ）
-- ====================================================================
CREATE TABLE currencies (
  id TEXT PRIMARY KEY,                                            -- 'thb', 'idr', 'jpy', 'usd'
  code TEXT NOT NULL UNIQUE,                                      -- 'THB', 'IDR', 'JPY', 'USD'
  symbol TEXT NOT NULL,                                           -- '฿', 'Rp', '¥', '$'
  name TEXT NOT NULL,                                             -- 'タイバーツ'
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_currencies_updated_at BEFORE UPDATE ON currencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE currencies IS '通貨マスタ。記号・名称を保持。';

-- ====================================================================
-- 3. profiles（ユーザープロフィール、auth.usersにリンク）
-- ====================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('executive', 'country_rep', 'store_manager', 'staff', 'accounting')),
  country_id TEXT REFERENCES countries(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  has_2fa BOOLEAN NOT NULL DEFAULT FALSE,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role) WHERE is_active = TRUE;
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE profiles IS 'ユーザープロフィール。auth.usersと1:1。退職者はis_active=FALSEで保持。';

-- ====================================================================
-- 4. stores（店舗マスタ）
-- ====================================================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country_id TEXT NOT NULL REFERENCES countries(id),
  currency_id TEXT NOT NULL REFERENCES currencies(id),
  timezone TEXT NOT NULL,                                         -- 'Asia/Bangkok'
  service_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10 CHECK (service_fee_rate >= 0 AND service_fee_rate <= 1),
  is_lunch_dinner_split BOOLEAN NOT NULL DEFAULT FALSE,
  is_weather_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_event_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  established_date DATE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_country ON stores(country_id) WHERE is_active = TRUE;
CREATE INDEX idx_stores_active ON stores(is_active);
CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stores IS '店舗マスタ。サービス料率・税制連動・入力画面オプションを保持。';

-- ====================================================================
-- 5. user_store_assignments（ユーザー×店舗のM:N）
-- ====================================================================
CREATE TABLE user_store_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, store_id)
);

CREATE INDEX idx_user_store_user ON user_store_assignments(user_id);
CREATE INDEX idx_user_store_store ON user_store_assignments(store_id);

COMMENT ON TABLE user_store_assignments IS 'ユーザー×店舗の所属関係。経営層・経理は空（全店アクセス）。';

-- ====================================================================
-- 6. exchange_rates（為替レート：通貨ペアごとに最新1値のみ）
-- ====================================================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency_id TEXT NOT NULL REFERENCES currencies(id),
  to_currency_id TEXT NOT NULL REFERENCES currencies(id),
  rate NUMERIC(15,8) NOT NULL CHECK (rate > 0),
  effective_date DATE NOT NULL,                                   -- 設定日（メタ情報、計算には未使用）
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_currency_id, to_currency_id),
  CHECK (from_currency_id != to_currency_id)
);

CREATE INDEX idx_exchange_rates_pair ON exchange_rates(from_currency_id, to_currency_id);
CREATE TRIGGER trg_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE exchange_rates IS '為替レート（月末レート方式）。1ペア1値、当月の全データに統一適用。';

-- ====================================================================
-- 7. purchase_categories（仕入カテゴリ：店舗別）
-- ====================================================================
CREATE TABLE purchase_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE INDEX idx_purchase_categories_store ON purchase_categories(store_id) WHERE is_active = TRUE;
CREATE TRIGGER trg_purchase_categories_updated_at BEFORE UPDATE ON purchase_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE purchase_categories IS '仕入カテゴリ（店舗別）。例：酒類、肉類、野菜等。';

-- ====================================================================
-- 8. suppliers（仕入先：店舗別、カテゴリ紐付け）
-- ====================================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES purchase_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE INDEX idx_suppliers_store ON suppliers(store_id) WHERE is_active = TRUE;
CREATE INDEX idx_suppliers_category ON suppliers(category_id);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE suppliers IS '仕入先（店舗別）。各仕入先は1カテゴリに紐付き。';

-- ====================================================================
-- 9. expense_accounts（販管費科目：店舗別、上位分類は文字列で保持）
-- ====================================================================
-- 上位分類は全店共通固定（コード上で定数管理）：
--   人件費 / 賃料 / 光熱費 / 広告宣伝費 / 減価償却費 / 支払手数料 / 消耗品費 / その他販管費
CREATE TABLE expense_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                                             -- 科目名（店舗別自由）
  level1 TEXT NOT NULL CHECK (level1 IN (
    '人件費', '賃料', '光熱費', '広告宣伝費',
    '減価償却費', '支払手数料', '消耗品費', 'その他販管費'
  )),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, name)
);

CREATE INDEX idx_expense_accounts_store ON expense_accounts(store_id) WHERE is_active = TRUE;
CREATE INDEX idx_expense_accounts_level1 ON expense_accounts(level1);
CREATE TRIGGER trg_expense_accounts_updated_at BEFORE UPDATE ON expense_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE expense_accounts IS '販管費科目（店舗別）。上位分類は全店共通固定の8区分。';

-- ====================================================================
-- 10. daily_sales（日次売上）
-- ====================================================================
CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  business_date DATE NOT NULL,
  day_period TEXT NOT NULL DEFAULT 'all' CHECK (day_period IN ('all', 'lunch', 'dinner')),
  gross_sales NUMERIC(15,2) NOT NULL CHECK (gross_sales >= 0),    -- 税込売上
  net_sales NUMERIC(15,2) NOT NULL CHECK (net_sales >= 0),        -- 税抜売上
  service_fee NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  customer_count INTEGER NOT NULL CHECK (customer_count >= 0),
  weather TEXT,                                                    -- 天気（オプション）
  event_note TEXT,                                                 -- 特記事項（オプション）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_date, day_period)
);

CREATE INDEX idx_daily_sales_store_date ON daily_sales(store_id, business_date);
CREATE INDEX idx_daily_sales_date ON daily_sales(business_date);
CREATE TRIGGER trg_daily_sales_updated_at BEFORE UPDATE ON daily_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE daily_sales IS '日次売上。昼夜分離店はlunch/dinnerで2レコード。UNIQUE制約でUPSERT対応。';

-- ====================================================================
-- 11. daily_purchases（日次仕入）
-- ====================================================================
CREATE TABLE daily_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  business_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_date, supplier_id)
);

CREATE INDEX idx_daily_purchases_store_date ON daily_purchases(store_id, business_date);
CREATE INDEX idx_daily_purchases_supplier ON daily_purchases(supplier_id);
CREATE TRIGGER trg_daily_purchases_updated_at BEFORE UPDATE ON daily_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE daily_purchases IS '日次仕入。1日1仕入先1レコード（同日重複は加算ではなく上書き）。';

-- ====================================================================
-- 12. daily_expenses（日次販管費）
-- ====================================================================
CREATE TABLE daily_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  expense_account_id UUID NOT NULL REFERENCES expense_accounts(id),
  business_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_date, expense_account_id)
);

CREATE INDEX idx_daily_expenses_store_date ON daily_expenses(store_id, business_date);
CREATE INDEX idx_daily_expenses_account ON daily_expenses(expense_account_id);
CREATE TRIGGER trg_daily_expenses_updated_at BEFORE UPDATE ON daily_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE daily_expenses IS '日次販管費。1日1科目1レコード。';

-- ====================================================================
-- 13. daily_targets（日別売上目標）
-- ====================================================================
CREATE TABLE daily_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  target_date DATE NOT NULL,
  target_sales NUMERIC(15,2) NOT NULL CHECK (target_sales >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, target_date)
);

CREATE INDEX idx_daily_targets_store_date ON daily_targets(store_id, target_date);
CREATE TRIGGER trg_daily_targets_updated_at BEFORE UPDATE ON daily_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE daily_targets IS '日別売上目標。月単位でカレンダー入力。曜日変動を反映。';

-- ====================================================================
-- 14. inventory_estimates（概算棚卸：店舗ごとに最新1件のみ）
-- ====================================================================
CREATE TABLE inventory_estimates (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  estimated_date DATE NOT NULL,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inventory_estimates_updated_at BEFORE UPDATE ON inventory_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE inventory_estimates IS '概算棚卸。店舗ごとに最新1件のみ保持（履歴なし）。月次PL用。';

-- ====================================================================
-- 15. system_settings（システム設定：KV型）
-- ====================================================================
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE system_settings IS 'システム設定（KV型）。経営層のみ変更可能。';

-- ====================================================================
-- VIEWS（共通参照ビュー）
-- ====================================================================

-- 売上サマリビュー（達成率込み）
CREATE OR REPLACE VIEW v_daily_sales_with_target AS
SELECT
  s.id AS sale_id,
  s.store_id,
  s.business_date,
  s.day_period,
  s.gross_sales,
  s.net_sales,
  s.customer_count,
  CASE WHEN s.customer_count > 0 THEN s.gross_sales / s.customer_count ELSE 0 END AS avg_per_customer,
  COALESCE(t.target_sales, 0) AS target_sales,
  CASE
    WHEN COALESCE(t.target_sales, 0) > 0 THEN ROUND((s.gross_sales / t.target_sales * 100)::NUMERIC, 1)
    ELSE NULL
  END AS achievement_pct,
  st.name AS store_name,
  st.currency_id
FROM daily_sales s
JOIN stores st ON st.id = s.store_id
LEFT JOIN daily_targets t ON t.store_id = s.store_id AND t.target_date = s.business_date;

COMMENT ON VIEW v_daily_sales_with_target IS '売上＋目標＋達成率の統合ビュー';

-- ====================================================================
-- 完了通知
-- ====================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Initial schema created successfully';
  RAISE NOTICE '   - 15 tables created';
  RAISE NOTICE '   - All UNIQUE constraints for UPSERT';
  RAISE NOTICE '   - All FK with appropriate cascading';
  RAISE NOTICE '   - All updated_at triggers active';
  RAISE NOTICE '   - 1 view created';
  RAISE NOTICE 'Next: Run 002_rls_policies.sql';
END $$;
