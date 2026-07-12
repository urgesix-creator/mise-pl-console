-- ====================================================================
-- Seed Data v1.0
-- 国・通貨・店舗・システム設定の初期データ
-- ====================================================================

-- ====================================================================
-- 1. countries（国マスタ）
-- ====================================================================
INSERT INTO countries (id, name, code, flag, tax_rate, tax_base, tax_label, display_order)
VALUES
  ('th', 'タイ', 'TH', '🇹🇭', 0.0700, 'net_plus_service', 'VAT', 1),
  ('id', 'インドネシア', 'ID', '🇮🇩', 0.1000, 'net_plus_service', 'PB1', 2),
  ('jp', '日本', 'JP', '🇯🇵', 0.1000, 'net_sales', '消費税', 3),
  ('tw', '台湾', 'TW', '🇹🇼', 0.0500, 'net_sales', '営業税', 4)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 2. currencies（通貨マスタ）
-- ====================================================================
INSERT INTO currencies (id, code, symbol, name, display_order)
VALUES
  ('jpy', 'JPY', '¥', '日本円', 1),
  ('thb', 'THB', '฿', 'タイバーツ', 2),
  ('idr', 'IDR', 'Rp', 'インドネシアルピア', 3),
  ('usd', 'USD', '$', '米ドル', 4),
  ('vnd', 'VND', '₫', 'ベトナムドン', 5)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. stores（店舗マスタ）
-- ※ 店舗の正式名称は比嘉専務の確認後に修正予定
-- ====================================================================
INSERT INTO stores (
  id, name, country_id, currency_id, timezone,
  service_fee_rate, is_lunch_dinner_split, is_weather_enabled, is_event_enabled,
  is_active, established_date, display_order
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'あお季タイ',
    'th', 'thb', 'Asia/Bangkok',
    0.10, FALSE, TRUE, FALSE,
    TRUE, '2018-04-01', 1
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'AOKI ロバタ',
    'th', 'thb', 'Asia/Bangkok',
    0.10, FALSE, TRUE, FALSE,
    TRUE, '2024-09-01', 2
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '博多天神ジャカルタ',
    'id', 'idr', 'Asia/Jakarta',
    0.10, TRUE, FALSE, TRUE,
    TRUE, '2020-06-01', 3
  )
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 4. exchange_rates（為替レート初期値）
-- ====================================================================
INSERT INTO exchange_rates (
  from_currency_id, to_currency_id, rate, effective_date, notes
)
VALUES
  ('thb', 'jpy', 4.4000, '2026-05-01', '月初に三菱UFJ TTMで設定'),
  ('idr', 'jpy', 0.0098, '2026-05-01', '月初に三菱UFJ TTMで設定'),
  ('usd', 'jpy', 152.30, '2026-04-15', '海外送金用参考レート')
ON CONFLICT (from_currency_id, to_currency_id) DO NOTHING;

-- ====================================================================
-- 5. system_settings（システム設定初期値）
-- ====================================================================
INSERT INTO system_settings (key, value, description) VALUES
  -- 日報配信
  ('daily_report.enabled', 'true', '日報の自動配信ON/OFF'),
  ('daily_report.send_time', '"09:00"', '日報配信時刻（JST）'),
  ('daily_report.slack_channel', '"#sales-management"', '配信先Slackチャンネル'),
  ('daily_report.include_weather', 'true', '日報に天気を含める'),
  ('daily_report.include_events', 'true', '日報にイベント情報を含める'),

  -- アラート閾値
  ('alerts.enabled', 'true', 'アラート通知ON/OFF'),
  ('alerts.sales_achievement_threshold_pct', '95', '売上達成率閾値（%）。95%未満でアラート'),
  ('alerts.customer_variance_pct', '30', '客単価変動閾値（%）'),
  ('alerts.input_timeout_hours', '24', '入力遅延閾値（時間）'),

  -- リマインダー
  ('reminders.daily_input_reminder', 'true', '日次入力リマインダーON/OFF'),
  ('reminders.daily_input_reminder_time', '"21:00"', 'リマインダー時刻（店舗ローカル）'),
  ('reminders.inventory_reminder_enabled', 'true', '月末棚卸リマインダー'),
  ('reminders.inventory_reminder_day', '1', '月末リマインダー実行日（月末からの日数）'),

  -- 認証
  ('auth.require_2fa_for_executive', 'true', '経営層に2FA必須'),
  ('auth.require_2fa_for_country_rep', 'true', '各国代表に2FA必須'),
  ('auth.session_timeout_minutes', '480', 'セッションタイムアウト（分）'),
  ('auth.remember_device_days', '30', '信頼端末の有効期限（日）'),
  ('auth.password_min_length', '12', 'パスワード最小文字数'),

  -- Slack
  ('slack.enabled', 'true', 'Slack連携ON/OFF'),
  ('slack.webhook_url', '""', 'Webhook URL（経営層のみ閲覧可、本番設定要）'),

  -- 表示
  ('display.system_name', '"Sales Console"', 'システム名'),
  ('display.default_jpy_conversion', 'true', 'JPY換算をデフォルト表示'),
  ('display.fiscal_year_start_month', '4', '会計年度開始月')
ON CONFLICT (key) DO NOTHING;

-- ====================================================================
-- 6. purchase_categories（仕入カテゴリ初期値：あお季タイ）
-- ※ 他店舗・他カテゴリは比嘉専務の確認後に追加
-- ====================================================================
INSERT INTO purchase_categories (store_id, name, display_order, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', '酒類', 1, TRUE),
  ('11111111-1111-1111-1111-111111111111', '肉類', 2, TRUE),
  ('11111111-1111-1111-1111-111111111111', '鶏肉', 3, TRUE),
  ('11111111-1111-1111-1111-111111111111', '野菜', 4, TRUE),
  ('11111111-1111-1111-1111-111111111111', '食品', 5, TRUE),
  ('11111111-1111-1111-1111-111111111111', '魚・食品', 6, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'うどん', 7, TRUE),
  ('11111111-1111-1111-1111-111111111111', '氷', 8, TRUE),
  ('11111111-1111-1111-1111-111111111111', '炭・藁', 9, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'おしぼり', 10, TRUE)
ON CONFLICT (store_id, name) DO NOTHING;

-- AOKIロバタ
INSERT INTO purchase_categories (store_id, name, display_order, is_active) VALUES
  ('22222222-2222-2222-2222-222222222222', '酒類', 1, TRUE),
  ('22222222-2222-2222-2222-222222222222', '肉類', 2, TRUE),
  ('22222222-2222-2222-2222-222222222222', '炭', 3, TRUE)
ON CONFLICT (store_id, name) DO NOTHING;

-- 博多天神ジャカルタ
INSERT INTO purchase_categories (store_id, name, display_order, is_active) VALUES
  ('33333333-3333-3333-3333-333333333333', 'FOOD', 1, TRUE),
  ('33333333-3333-3333-3333-333333333333', 'Drink', 2, TRUE),
  ('33333333-3333-3333-3333-333333333333', '包装容器', 3, TRUE),
  ('33333333-3333-3333-3333-333333333333', '消耗品', 4, TRUE),
  ('33333333-3333-3333-3333-333333333333', '販促品', 5, TRUE)
ON CONFLICT (store_id, name) DO NOTHING;

-- ====================================================================
-- 7. expense_accounts（販管費科目初期値）
-- ※ 共通的な科目のみ。詳細は店舗別に追加
-- ====================================================================

-- あお季タイ
INSERT INTO expense_accounts (store_id, name, level1, display_order, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', '給与', '人件費', 1, TRUE),
  ('11111111-1111-1111-1111-111111111111', '社会保険拠出金', '人件費', 2, TRUE),
  ('11111111-1111-1111-1111-111111111111', '事務所賃借料', '賃料', 3, TRUE),
  ('11111111-1111-1111-1111-111111111111', '店舗賃借料', '賃料', 4, TRUE),
  ('11111111-1111-1111-1111-111111111111', '電気代', '光熱費', 5, TRUE),
  ('11111111-1111-1111-1111-111111111111', '水道料', '光熱費', 6, TRUE),
  ('11111111-1111-1111-1111-111111111111', 'ガス代', '光熱費', 7, TRUE),
  ('11111111-1111-1111-1111-111111111111', '通信費', 'その他販管費', 8, TRUE),
  ('11111111-1111-1111-1111-111111111111', '広告宣伝費', '広告宣伝費', 9, TRUE),
  ('11111111-1111-1111-1111-111111111111', '会計サービス料', '支払手数料', 10, TRUE)
ON CONFLICT (store_id, name) DO NOTHING;

-- 博多天神ジャカルタ
INSERT INTO expense_accounts (store_id, name, level1, display_order, is_active) VALUES
  ('33333333-3333-3333-3333-333333333333', '給与（管理職）', '人件費', 1, TRUE),
  ('33333333-3333-3333-3333-333333333333', '給与（現場）', '人件費', 2, TRUE),
  ('33333333-3333-3333-3333-333333333333', 'BPJS拠出金', '人件費', 3, TRUE),
  ('33333333-3333-3333-3333-333333333333', '店舗賃借料', '賃料', 4, TRUE),
  ('33333333-3333-3333-3333-333333333333', 'PLN電気代', '光熱費', 5, TRUE),
  ('33333333-3333-3333-3333-333333333333', 'PDAM水道料', '光熱費', 6, TRUE),
  ('33333333-3333-3333-3333-333333333333', 'GoFood広告', '広告宣伝費', 7, TRUE),
  ('33333333-3333-3333-3333-333333333333', 'GrabFood広告', '広告宣伝費', 8, TRUE)
ON CONFLICT (store_id, name) DO NOTHING;

-- ====================================================================
-- 完了通知
-- ====================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Seed data loaded successfully';
  RAISE NOTICE '   - 4 countries (TH, ID, JP, TW)';
  RAISE NOTICE '   - 5 currencies (JPY, THB, IDR, USD, VND)';
  RAISE NOTICE '   - 3 stores (with placeholder UUIDs - update if needed)';
  RAISE NOTICE '   - 3 exchange rates';
  RAISE NOTICE '   - 23+ system settings';
  RAISE NOTICE '   - Sample purchase categories and expense accounts';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Next steps:';
  RAISE NOTICE '   1. Verify store names with 比嘉専務';
  RAISE NOTICE '   2. Add suppliers data (per store)';
  RAISE NOTICE '   3. Set Slack webhook URL in system_settings';
  RAISE NOTICE '   4. Create initial users via Supabase Auth dashboard';
END $$;
