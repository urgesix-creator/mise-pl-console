# KOGAホールディングス海外飲食店 売上管理システム データモデル設計書 v1.6

| 項目 | 内容 |
|---|---|
| プロジェクト名 | KOGAホールディングス海外飲食店 売上管理システム |
| ドキュメント | データモデル設計書 |
| バージョン | v1.6（多言語対応：profiles.language カラム追加。要件定義 v2.3 6.5節と連動） |
| 作成日 | 2026年5月10日 |
| 作成者 | 比嘉俊一（KOGAホールディングス株式会社 専務取締役） |
| 関連文書 | 要件定義書 v2.3 |

---

## 1. 設計方針

### 1.1 採用DBMS

- **PostgreSQL on Supabase**
- バージョン：Supabaseが提供する最新安定版（PostgreSQL 15+）

### 1.2 設計原則

| 項目 | 採用方針 | 根拠 |
|---|---|---|
| 命名規則 | snake_case（英語） | PostgreSQL標準、Claude Code相性◎ |
| 主キー | UUID（gen_random_uuid()） | 分散環境対応、IDの推測不可 |
| 削除方針 | ソフトデリート（is_active boolean） | 過去データ参照のため |
| タイムスタンプ | UTC保存、表示時に変換 | タイ・インドネシア時差処理 |
| 自動タイムスタンプ列 | created_at, updated_at（自動生成） | 最終更新日時表示等の運用に使用 |
| 監査列 | **採用しない**（簡素化） | 監査要件なしのため created_by / updated_by を不採用 |
| 金額型 | DECIMAL(12,2) | 浮動小数点誤差防止 |
| 税率型 | DECIMAL(5,4) | 0.0700 = 7% を正確表現 |
| 通貨 | DECIMAL（型は通貨ごと不変、表示時に小数桁数調整） | JPY=0桁、THB=2桁、IDR=0桁 |
| 文字コード | UTF-8 | 日本語・タイ語・英語・インドネシア語混在に対応 |

### 1.3 マルチテナント方針

- 単一データベース・単一スキーマ
- 各テーブルに `store_id` を持たせ、Row Level Security（RLS）で店舗別アクセス制御
- 経営層・経理は全店アクセス、店長は自店のみ等の権限分離をDB層で強制

---

## 2. テーブル一覧（19テーブル）

### 2.1 マスタ系（9テーブル）

| # | テーブル名 | 用途 |
|---|---|---|
| 1 | countries | 国マスタ（税制） |
| 2 | currencies | 通貨マスタ |
| 3 | exchange_rates | 為替レート履歴（手動入力） |
| 4 | stores | 店舗マスタ |
| 5 | roles | ロール定義 |
| 6 | users | ユーザーマスタ |
| 7 | suppliers | 仕入先マスタ（店舗ごと） |
| 8 | purchase_categories | 仕入カテゴリマスタ（店舗ごと） |
| 9 | expense_accounts | 販管費科目マスタ（店舗ごと） |

### 2.2 取引系（5テーブル）

| # | テーブル名 | 用途 |
|---|---|---|
| 10 | daily_sales | 日次売上 |
| 11 | daily_purchases | 日次仕入（仕入先別明細） |
| 12 | daily_expenses | 日次販管費 |
| 13 | inventory_estimates | 概算棚卸し（履歴管理） |
| 14 | daily_targets | 日別売上目標（曜日変動対応） |

### 2.3 運用系（1テーブル）

| # | テーブル名 | 用途 |
|---|---|---|
| 15 | system_settings | システム設定（KV型） |

【簡素化方針】以下のテーブルは廃止：
- ~~import_logs~~（取込履歴・ロールバック機能を廃止）
- ~~export_logs~~（出力履歴を廃止）
- ~~access_logs~~（アクセス監査を廃止）
- ~~slack_notification_logs~~（Slack送信履歴を廃止）

---

## 3. ER図（リレーション概略）

```
┌──────────┐   ┌──────────┐   ┌──────────────┐
│countries │   │currencies│──→│exchange_rates│
└────┬─────┘   └─────┬────┘   └──────────────┘
     │               │           （1ペア1件）
     ↓               ↓
   ┌──────────────────────┐    ┌──────┐    ┌─────┐
   │       stores         │←──→│users │←──→│roles│
   └─┬─────┬─────┬────────┘    └──────┘    └─────┘
     │     │     │
     ↓     ↓     ↓
┌────────┐ ┌──────────┐ ┌────────┐
│suppliers│ │purchase_ │ │expense_│
│        │ │categories│ │accounts│
└───┬────┘ └────┬─────┘ └───┬────┘
    │           │            │
    ↓           ↓            ↓
┌──────────┐ ┌─────────┐ ┌──────────┐
│  daily_  │ │ daily_  │ │  daily_  │
│purchases │ │ sales   │ │ expenses │
└──────────┘ └─────────┘ └──────────┘

【独立テーブル】
- inventory_estimates (store_id参照、1店舗1件)
- daily_targets (store_id × 日付の単位)
- system_settings (キーバリュー)
```

---

## 4. テーブル詳細定義

### 4.1 countries（国マスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| country_code | VARCHAR(3) | NO | - | ISO 3166-1 alpha-2/3（TH, ID） |
| country_name_jp | VARCHAR(100) | NO | - | 日本語国名 |
| country_name_en | VARCHAR(100) | NO | - | 英語国名 |
| tax_name | VARCHAR(50) | NO | - | 税名（VAT, PB1等） |
| tax_rate | DECIMAL(5,4) | NO | - | 税率（0.0700 = 7%） |
| tax_base | VARCHAR(30) | NO | 'net_sales' | 課税ベース（'net_sales' or 'net_sales_plus_service'） |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at | TIMESTAMPTZ | NO | now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | now() | 更新日時 |

**初期データ：**

| country_code | country_name_jp | tax_name | tax_rate | tax_base |
|---|---|---|---|---|
| TH | タイ | VAT | 0.0700 | net_sales |
| ID | インドネシア | PB1 | 0.1000 | net_sales_plus_service |

### 4.2 currencies（通貨マスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| currency_code | VARCHAR(3) | NO | - | ISO 4217（THB, IDR, JPY） |
| currency_name | VARCHAR(50) | NO | - | 通貨名 |
| symbol | VARCHAR(10) | NO | - | 通貨記号（฿, Rp, ¥） |
| decimal_places | INTEGER | NO | 2 | 小数桁数（JPY=0, THB=2, IDR=0） |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**初期データ：** THB, IDR, JPY

### 4.3 exchange_rates（為替レート・最新値のみ保持）

通貨ペアごとに**現在の有効レート1件のみ**を保持する（履歴は保持しない、更新時は上書き）。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| from_currency_id | UUID | NO | - | FK to currencies（変換元） |
| to_currency_id | UUID | NO | - | FK to currencies（変換先、通常JPY） |
| rate | DECIMAL(12,6) | NO | - | レート（1単位あたり） |
| effective_date | DATE | NO | - | 設定日 |
| notes | TEXT | YES | - | 備考 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (from_currency_id, to_currency_id)

【簡素化方針】レート変更時は既存レコードを上書き更新。過去レートの履歴は保持しない。

### 4.4 stores（店舗マスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_name | VARCHAR(100) | NO | - | 店舗名 |
| country_id | UUID | NO | - | FK to countries |
| currency_id | UUID | NO | - | FK to currencies |
| service_fee_rate | DECIMAL(5,4) | NO | 0.1000 | サービス料率（10% = 0.1000） |
| is_lunch_dinner_split | BOOLEAN | NO | false | 昼夜区分ON/OFF |
| is_weather_input_enabled | BOOLEAN | NO | false | 天気入力ON/OFF |
| is_event_input_enabled | BOOLEAN | NO | false | イベント入力ON/OFF |
| timezone | VARCHAR(50) | NO | 'Asia/Bangkok' | IANAタイムゾーン |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

### 4.5 roles（ロールマスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| role_code | VARCHAR(30) | NO | - | ロールコード |
| role_name | VARCHAR(100) | NO | - | ロール名 |
| description | TEXT | YES | - | 説明 |
| created_at | TIMESTAMPTZ | NO | now() | 作成日時 |

**初期データ：**

| role_code | role_name |
|---|---|
| executive | 経営層（社長・専務） |
| country_rep | 各国法人代表 |
| store_manager | 店舗店長・マネージャー |
| staff | 現場社員 |
| accounting | 経理・税理士 |

### 4.6 users（ユーザーマスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | - | Supabase Authのuser.idと同期 |
| email | VARCHAR(255) | NO | - | メールアドレス（Supabase Auth管理） |
| display_name | VARCHAR(100) | NO | - | 表示名 |
| role_id | UUID | NO | - | FK to roles |
| assigned_store_id | UUID | YES | - | FK to stores（店長・現場社員用） |
| assigned_country_id | UUID | YES | - | FK to countries（各国代表用） |
| is_active | BOOLEAN | NO | true | 有効フラグ（退職時false） |
| last_login_at | TIMESTAMPTZ | YES | - | 最終ログイン日時 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

【注意】Supabase Auth の `auth.users` テーブルと連携。`users.id = auth.users.id` の関係。

### 4.7 suppliers（仕入先マスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores（店舗ごと） |
| supplier_name | VARCHAR(200) | NO | - | 仕入先名 |
| purchase_category_id | UUID | YES | - | FK to purchase_categories |
| display_order | INTEGER | NO | 0 | 表示順 |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**インデックス：** (store_id, is_active, display_order)

### 4.8 purchase_categories（仕入カテゴリマスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| category_name | VARCHAR(100) | NO | - | カテゴリ名 |
| parent_category_id | UUID | YES | - | FK to purchase_categories（階層構造） |
| display_order | INTEGER | NO | 0 | 表示順 |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

### 4.9 expense_accounts（販管費科目マスタ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| account_name | VARCHAR(100) | NO | - | 科目名（例：給与、家賃、電気代） |
| level1_category | VARCHAR(50) | NO | - | 上位分類（給与系/賃料系/光熱費系等） |
| level2_category | VARCHAR(50) | YES | - | 中位分類 |
| display_order | INTEGER | NO | 0 | 表示順 |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

### 4.10 daily_sales（日次売上）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| business_date | DATE | NO | - | 営業日（店舗ローカル時間ベース） |
| day_period | VARCHAR(10) | NO | 'all' | 'all' / 'lunch' / 'dinner' |
| gross_sales | DECIMAL(12,2) | NO | 0 | 総売上（税込） |
| service_fee | DECIMAL(12,2) | NO | 0 | サービス料（自動計算） |
| tax_amount | DECIMAL(12,2) | NO | 0 | 税額 |
| net_sales | DECIMAL(12,2) | NO | 0 | 税抜売上 |
| customer_count | INTEGER | NO | 0 | 客数 |
| avg_per_customer | DECIMAL(12,2) | YES | - | 客単価（自動計算） |
| discount | DECIMAL(12,2) | NO | 0 | 割引（任意） |
| influencer_discount | DECIMAL(12,2) | NO | 0 | インフルエンサー値引（任意） |
| weather | VARCHAR(50) | YES | - | 天気（任意、店舗設定で表示） |
| event_note | TEXT | YES | - | イベント・特記事項（任意） |
| notes | TEXT | YES | - | 備考 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (store_id, business_date, day_period)

**インデックス：** (store_id, business_date DESC)

### 4.11 daily_purchases（日次仕入）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| business_date | DATE | NO | - | 営業日 |
| supplier_id | UUID | NO | - | FK to suppliers |
| amount | DECIMAL(12,2) | NO | - | 仕入金額 |
| notes | TEXT | YES | - | 備考 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**インデックス：** (store_id, business_date DESC), (supplier_id, business_date DESC)

**ユニーク制約：** UNIQUE (store_id, business_date, supplier_id) — 1日の同一仕入先は1件。Excel取込時のUPSERT（INSERT or UPDATE）で使用。

### 4.12 daily_expenses（日次販管費）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| business_date | DATE | NO | - | 営業日 |
| expense_account_id | UUID | NO | - | FK to expense_accounts |
| amount | DECIMAL(12,2) | NO | - | 金額 |
| notes | TEXT | YES | - | 備考 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**インデックス：** (store_id, business_date DESC), (expense_account_id, business_date DESC)

**ユニーク制約：** UNIQUE (store_id, business_date, expense_account_id) — 1日の同一科目は1件。Excel取込時のUPSERT（INSERT or UPDATE）で使用。

### 4.13 inventory_estimates（概算棚卸し・最新値のみ保持）

店舗ごとに**現在の概算棚卸金額1件のみ**を保持する（履歴は保持しない、更新時は上書き）。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| amount | DECIMAL(12,2) | NO | - | 概算棚卸金額（現在値） |
| last_updated_date | DATE | NO | - | 最終更新日（業務日付） |
| notes | TEXT | YES | - | 備考 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (store_id)

【簡素化方針】更新時は既存レコードを上書き更新。過去の値は保持しない。月次PL計算には使用せず、表示のみの参考値として扱う。

### 4.14 daily_targets（日別売上目標）

曜日変動を反映した日別の売上目標を保持。月次目標は本テーブルの合計値として導出される（別途月次テーブルは持たない）。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| target_date | DATE | NO | - | 対象日 |
| target_sales | DECIMAL(12,2) | NO | - | 当日の売上目標（税抜） |
| notes | TEXT | YES | - | 備考（特別営業日・休業日等） |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (store_id, target_date)

**インデックス：** (store_id, target_date)

**入力UX想定：**

- 月初に1ヶ月分まとめて入力（カレンダーグリッドUI）
- 曜日が画面上で常に視認可能
- 1日ごとに金額を入力（数値が0の日は休業日として扱う）
- Phase2で「平日一括／土日一括／前月コピー／曜日別パターン適用」等の効率化機能を追加

### 4.15 system_settings（システム設定）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| key | VARCHAR(100) | NO | - | 主キー（設定キー） |
| value | JSONB | NO | - | 設定値 |
| description | TEXT | YES | - | 設定説明 |
| updated_at | TIMESTAMPTZ | NO | now() | 更新日時 |

**初期キー例：**

| key | value | 説明 |
|---|---|---|
| inventory_reminder_enabled | true | 概算棚卸リマインダー必須運用ON/OFF |
| daily_report_send_time | "09:00" | 日報送信時刻（店舗ローカル時間） |
| slack_executive_channel_id | "C0123456789" | 経営会議グループチャンネルID |
| sales_alert_threshold_pct | 0.80 | 売上アラート閾値（目標比80%） |

---

## 5. RLS（Row Level Security）ポリシー概要

各テーブルにロールベースのアクセスポリシーを設定し、DB層で権限制御を強制する。

### 5.1 ロール別アクセス権限マトリクス

| テーブル区分 | executive（経営層） | country_rep（各国代表） | store_manager（店長） | staff（現場社員） | accounting（経理・税理士） |
|---|---|---|---|---|---|
| マスタ系（共通） | RW | R | R | R | R |
| マスタ系（店舗別） | RW | 自国R | 自店RW | 自店R | 全店R |
| 取引系 | RW | 自国R | 自店RW | 自店CR（C=作成のみ） | 全店R |
| システム設定 | RW | × | × | × | × |

R=Read, W=Write, C=Create only, RW=Read+Write

### 5.2 実装方針

- Supabaseの `auth.uid()` 関数で現在ユーザーIDを取得
- usersテーブルから `role_id` と `assigned_store_id` / `assigned_country_id` を引き、ポリシーで条件分岐
- ポリシー実装の詳細は実装フェーズで具体化

---

## 6. インデックス戦略

### 6.1 主要インデックス

| テーブル | インデックス | 用途 |
|---|---|---|
| daily_sales | (store_id, business_date DESC) | 日報・週報・PL生成時の高速集計 |
| daily_purchases | (store_id, business_date DESC) | 同上 |
| daily_purchases | (supplier_id, business_date DESC) | 仕入先別明細出力 |
| daily_expenses | (store_id, business_date DESC) | 同上 |
| inventory_estimates | (store_id) UNIQUE | 1店舗1件の制約 |
| exchange_rates | (from_currency_id, to_currency_id) UNIQUE | 1ペア1件の制約 |

### 6.2 全文検索インデックス

- 仕入先名・備考のあいまい検索が必要になった場合、Phase2で `pg_trgm` 拡張を導入

---

## 7. マイグレーション戦略

### 7.1 環境分離

| 環境 | 用途 | データ |
|---|---|---|
| local | 開発・単体テスト | ダミーデータ |
| staging | 統合テスト・店長デモ | テストデータ |
| production | 本番運用 | 実データ |

### 7.2 マイグレーションファイル管理

- Supabase CLIの `migrations/` ディレクトリで管理
- バージョン番号付きSQLファイル（例：`20260510120000_initial_schema.sql`）

### 7.3 初期データ投入

実装着手前に以下を準備：

1. countries（タイ・インドネシア）
2. currencies（THB・IDR・JPY）
3. roles（5ロール）
4. stores（タイ法人2店舗・ジャカルタ1店舗、店舗名は実装着手前に確定）
5. 各店舗の suppliers / purchase_categories / expense_accounts（既存Excelから抽出）
6. users（経営層・店長・経理等のメールアドレス、実装着手前に確定）

---

## 8. 計算ロジック仕様

### 8.1 売上計算（daily_sales）

```
税抜売上（net_sales）：入力 or 自動計算
税額（tax_amount） = net_sales × countries.tax_rate（タイの場合）
                  または (net_sales + service_fee) × countries.tax_rate（インドネシアの場合）
サービス料（service_fee） = net_sales × stores.service_fee_rate
総売上（gross_sales） = net_sales + service_fee + tax_amount
客単価（avg_per_customer） = gross_sales / customer_count
```

### 8.2 月次PL売上原価計算（簡素化）

```
当月仕入合計 = SUM(daily_purchases.amount) WHERE store_id = X
              AND business_date BETWEEN 月初日 AND 月末日
売上原価 = 当月仕入合計
```

【簡素化方針】棚卸変動を考慮しない。在庫変動が大きい月は実態とPL値が乖離するため、月次PLは「概算PL」と位置付ける。正式な売上総利益は会計ソフト側で棚卸調整して算出する想定。概算棚卸（inventory_estimates）は資産把握用の参考値として表示のみに使用する。

### 8.3 JPY換算（月末レート運用）

**ロジック：**

```
ある取引のJPY換算額 = 取引額（原通貨） × exchange_rates.rate
```

**重要な運用ルール：**

`exchange_rates` は通貨ペアごとに最新の1件のみを保持しており、**当月内の全ての取引は同一レートで換算される**。月途中でレートを更新した場合、過去取引も遡って新レートで再計算される。

**実装上の意味：**

- `exchange_rates.rate` は「当月の月末レート（または現時点での暫定値）」と解釈
- `exchange_rates.effective_date` は更新日のメタ情報であり、計算には使用しない
- 月次PL生成・ダッシュボードJPY表示・データ閲覧JPY参考表示で同一ロジックを適用

**ユースケース：**

```
シナリオA：月初に登録したまま月末
5/1 登録：1 THB = 4.70 円
5/31 月次PL生成：4.70円換算で集計

シナリオB：月末に更新（推奨運用）
5/1 登録：1 THB = 4.70 円
5/15 ダッシュボード表示：4.70円換算（暫定）
5/31 月末更新：1 THB = 5.00 円
5/31 月次PL生成：5.00円換算で集計（5/1〜31の全取引が遡って再計算）
```

【簡素化方針】月内のレート変動は反映しない。月末確定のJPY換算が正となる運用。

### 8.4 日報用の予算比計算

日報配信時、各店舗ごとに「月初〜前日まで」の予算比を計算する。

```
当該店舗の月初から前日までの日別目標を合計：
累計予算 = SUM(daily_targets.target_sales) WHERE store_id = X 
          AND target_date BETWEEN 月初日 AND 前日

累計売上 = SUM(daily_sales.net_sales) WHERE store_id = X 
          AND business_date BETWEEN 月初日 AND 前日
          AND day_period IN ('all', 'lunch', 'dinner') （昼夜分離店は合算）

予算比（％） = ROUND(累計売上 ÷ 累計予算 × 100)
```

**月次目標の導出：**

```
月次目標 = SUM(daily_targets.target_sales) WHERE store_id = X 
          AND target_date BETWEEN 月初日 AND 月末日
```

別途月次テーブルを持たず、日別目標の合計で月次目標を表示する。

【注意】予算が一日でも未登録の店舗は予算比を「未設定」と表示。Phase2で「曜日別パターン自動配分」「平日一括設定」「前月コピー」等の効率化UIを追加。

### 8.5 日報用の概算粗利計算

```
当日売上（税抜） = daily_sales.net_sales (該当日)
当日仕入額 = SUM(daily_purchases.amount) WHERE store_id = X 
            AND business_date = 該当日

当日概算粗利 = 当日売上（税抜） - 当日仕入額
累計概算粗利 = SUM(当日概算粗利) for all days from 月初 to 前日
```

【重要】これは日報用の「概算値」であり、月次PLの正式な売上総利益とは別計算：

| 項目 | 計算式 | 用途 |
|---|---|---|
| 日報用 概算粗利 | 売上 − 仕入 | リアルタイム把握 |
| 月次PL 売上総利益（簡略版） | 売上 − 仕入合計 | 月次PL内表示用 |

【簡素化方針】MVPでは棚卸調整を行わない。両者ともほぼ同じ計算（売上−仕入）となり、日報の累計値と月次PLの値はほぼ一致する。

### 8.6 日別累計データの取得（日報生成用）

日報配信時、各店舗ごとに月初〜前日までの全日について以下を1行ずつ生成：

```
SELECT 
  business_date,
  net_sales AS 当日売上,
  SUM(net_sales) OVER (ORDER BY business_date) AS 累計売上,
  -- 累計予算は別途計算（月次予算 ÷ 月の日数 × 経過日数）
  -- 予算比は累計売上 ÷ 累計予算
  -- 当日仕入は別クエリ or LATERAL JOIN
  -- 当日概算粗利 = 当日売上 - 当日仕入
  -- 累計概算粗利 = SUM(当日概算粗利) OVER (ORDER BY business_date)
FROM daily_sales
WHERE store_id = X
  AND business_date BETWEEN 月初日 AND 前日
  AND day_period = 'all'  -- または昼夜合算ロジック
ORDER BY business_date;
```

ウィンドウ関数 `SUM() OVER (ORDER BY business_date)` で累計を効率的に計算できる。

### 8.7 Excel取込のUPSERT（常に上書き）ロジック

Excel取込は「常に上書き」方式に統一されている。各テーブルの一意性制約に基づきUPSERT（INSERT or UPDATE）で実装する。

**マッチング条件と動作：**

| テーブル | UNIQUE制約 | 動作 |
|---|---|---|
| daily_sales | (store_id, business_date, day_period) | キー一致なら上書き、無ければ新規挿入 |
| daily_purchases | (store_id, business_date, supplier_id) | 同上 |
| daily_expenses | (store_id, business_date, expense_account_id) | 同上 |
| daily_targets | (store_id, target_date) | 同上 |

**PostgreSQL実装例（daily_targets）：**

```sql
INSERT INTO daily_targets (store_id, target_date, target_sales, notes)
VALUES (...)
ON CONFLICT (store_id, target_date)
DO UPDATE SET 
  target_sales = EXCLUDED.target_sales,
  notes = EXCLUDED.notes,
  updated_at = NOW();
```

**部分更新の保証：**

- 取込ファイルに含まれないレコードは変更されない（DELETE は実行しない）
- これにより、特定期間・特定店舗のみを修正取込することが可能
- 全件削除して入れ直したい場合は、別途UI操作で削除→再取込

**取込種別の判定：**

ファイルのシート名・ヘッダー行から自動判定：

| シート名/ヘッダー | 取込種別 | 対象テーブル |
|---|---|---|
| 「売上」「仕入」「販管費」を含む | 日次データ取込 | daily_sales / daily_purchases / daily_expenses |
| 「売上目標」「予算」を含む | 日別売上目標取込 | daily_targets |

---

## 9. 残課題

| # | 項目 | 解消フェーズ |
|---|---|---|
| 1 | RLSポリシーのSQL実装詳細 | フェーズ5（画面設計）または実装着手時 |
| 2 | インデックス追加（実運用後のクエリパフォーマンス次第） | 本番運用後 |
| 3 | バックアップ戦略（Supabase標準＋追加対策の要否） | 実装着手前 |
| 4 | system_settingsの初期値全リスト | 実装着手前 |

---

## 10. 改訂履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|---|---|---|---|
| 2026-05-10 | v1.0 | 初版作成（19テーブル定義、RLS方針、計算ロジック規定） | 比嘉俊一 |
| 2026-05-10 | v1.1 | 日報用の予算比計算（線形配分）・概算粗利計算（売上−仕入）・日別累計データ取得（ウィンドウ関数）のロジックを8.4〜8.6に追加。 | 比嘉俊一 |
| 2026-05-10 | v1.2 | 売上目標を月次→日別管理に変更：monthly_targets テーブルを daily_targets に置換（同一カラム構造）。daily_sales から target_sales カラムを削除（daily_targets 参照に統一）。8.4 予算比計算ロジックを線形配分から日別合計方式に変更。月次目標は daily_targets の SUM で導出。 | 比嘉俊一 |
| 2026-05-10 | v1.3 | 監査・履歴機能を全廃して大幅簡素化（19テーブル→15テーブル）：(1) access_logs / import_logs / export_logs / slack_notification_logs を削除、(2) inventory_estimates を履歴→1店舗1件の単一値構造、(3) exchange_rates を履歴→1ペア1件の単一値構造、(4) 全テーブルから created_by / updated_by 列を削除（created_at / updated_at は残置）、(5) 月次PL売上原価を「当月仕入合計」の簡略計算に変更、(6) RLSマトリクスから監査・履歴関連行を削除。 | 比嘉俊一 |
| 2026-05-10 | v1.4 | Excel取込「常に上書き」方式に対応：(1) daily_purchases に UNIQUE (store_id, business_date, supplier_id) を追加、(2) daily_expenses に UNIQUE (store_id, business_date, expense_account_id) を追加、(3) 8.7節「Excel取込のUPSERTロジック」を新設（PostgreSQL ON CONFLICT 構文の実装例含む）、(4) 取込種別の自動判定ロジックを規定。 | 比嘉俊一 |
| 2026-05-10 | v1.5 | 為替レートの運用ルールを「月末レート」として明文化：8.3節「JPY換算」を全面改訂。当月の全取引が同一レートで換算される旨、月途中更新時の遡及再計算ロジック、effective_dateはメタ情報扱いとなることを規定。ユースケース2例を追加。 | 比嘉俊一 |
| 2026-05-10 | v1.6 | 多言語対応のため `profiles.language` カラム追加（CHECK制約：'ja'/'en'/'th'/'id'、デフォルト'ja'）。要件定義 v2.3 6.5節と連動。マイグレーション 004_add_user_language.sql で既存テーブルに後方互換で追加。 | 比嘉俊一 |

---

**以上**
