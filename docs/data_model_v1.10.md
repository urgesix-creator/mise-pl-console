# KOGAホールディングス海外飲食店 売上管理システム データモデル設計書 v1.10

| 項目 | 内容 |
|---|---|
| プロジェクト名 | KOGAホールディングス海外飲食店 売上管理システム |
| ドキュメント | データモデル設計書 |
| バージョン | v1.10（日次売上のExcel往復フォーマットが **daily_sales と daily_department_sales を1枚に統合**する「統合フォーマット」になった旨を §4.10・§4.17 に注記。要件定義書 v2.7 §4.5.5.1 と整合。**テーブル列・制約・計算ロジックの変更なし**） |
| 作成日 | 2026年5月10日（v1.7改訂：2026年5月30日／v1.8改訂：2026年5月30日／v1.9改訂：2026年5月30日／v1.10改訂：2026年5月31日） |
| 作成者 | 比嘉俊一（KOGAホールディングス株式会社 専務取締役） |
| 関連文書 | 要件定義書 v2.7 |

---

> **【v1.7 改訂サマリー（v1.6 → v1.7）】**
>
> 売上計算の制度を以下のとおり変更した。**DBスキーマ（テーブル列・制約）は一切変更していない**。変更は計算ロジックと各カラムの「位置づけ（入力値か自動計算値か）」の再定義のみ。
>
> 1. **予算・売上入力ともネットセールス（税抜 = `net_sales`）基準**に統一。`net_sales` を売上の**主入力値**とする（旧 v1.6 は「入力 or 自動計算」と曖昧、かつ実運用は `gross_sales` を主入力としていた）。
> 2. **サービス料は `net_sales` に対して課す**（`service_fee = net_sales × service_fee_rate`）。※この式自体は v1.6 §8.1 と同一。
> 3. **`gross_sales`（総売上・税込）・ランチ売上・ディナー売上は税込の独立入力値**とし、`net_sales` と連動させない（旧 v1.6 の `gross_sales = net_sales + service_fee + tax_amount` という自動連動を**廃止**）。
> 4. **ランチ／ディナーの保持は `day_period` 行方式を維持**（`'all'/'lunch'/'dinner'`）。DB列の追加・変更なし。
> 5. **客単価 `avg_per_customer` = `gross_sales` ÷ `customer_count`**（分子は税込の `gross_sales`）。
> 6. **整合性チェックは「桁違い警告」のみ**に緩和（`gross_sales ÷ net_sales` が 2.0 超または 0.5 未満で警告、**保存は許容**）。旧 v1.6 の「税抜＋税＝税込」厳密チェックは廃止。
>
> 詳細は §4.10・§8.1・§8.1.1 を参照。

---

> **【v1.8 改訂サマリー（v1.7 → v1.8）】**
>
> **部門別売上（参考データ）機能**を追加した。**既存の経営データ（`daily_sales` ほか取引系）の定義・計算は一切変更していない**。本機能は経営計算から物理的に分離された「追加レイヤー」である。
>
> 1. **新テーブル2つを追加**：`sales_departments`（部門マスタ・店舗別／§4.16）、`daily_department_sales`（日次部門別売上／§4.17）。
> 2. **入力は税込売上（`gross_sales`）のみ**。税抜・サービス料・税額・客数は持たない。
> 3. **経営計算には一切反映しない**（損益・原価率・予算比・客単価は従来どおり `daily_sales` の1日合計 `net_sales` のみで算出）。部門別合計と1日合計の一致は**検証しない**。
> 4. **部門は店舗ごとに完全独立**（共通初期値なし。各店が自由に追加・改名・無効化）。削除は**ソフト削除（`is_active`）**。
> 5. **構成比＝部門内シェア（各部門の累計 ÷ 部門別累計合計、合計100%）／累計ベース**の集計ロジックを §8.8 に新設。無効化済み部門でも過去データは集計・構成比に含める。
> 6. **レコード方式は UPSERT 上書き**：UNIQUE `(store_id, business_date, department_id)`。入力は**任意**（空欄可・経営売上の保存をブロックしない）。
> 7. **通貨は店舗ローカル通貨（税込）のみ**（JPY換算なし＝月末レート方式の対象外）。
> 8. **`day_period` は現状維持**（案A）。経営データの入力粒度であり、部門別売上とは別レイヤーとして両立する（§4.10 注記参照）。
>
> 詳細は §2.4・§4.16・§4.17・§5・§8.8 を参照。

---

> **【v1.9 改訂サマリー（v1.8 → v1.9）】**
>
> 経営データの運用方針を明記。**テーブル列・制約・計算ロジック（§8.1 税計算等）は一切変更していない**。
>
> 1. **経営データ（`daily_sales`）は全店「1日1行（`day_period='all'`）」に統一する方針**を明記。ジャカルタも今後は昼夜分離（lunch/dinner）では入力せず1日合計で入力する（要件定義書 v2.6 §4.2.1）。
> 2. 時間帯・部門の細分は「部門別売上（参考データ）」（§4.16/§4.17）で扱い、**経営データ側では昼夜・部門を分けない**。
> 3. **`day_period` の `lunch`/`dinner` というDB構造（列・CHECK）は残すが、今後は使わない**（構造削除はしない＝リスク回避）。§4.10 の `day_period` 注記を新方針に合わせて補足。
> 4. **実DBカラム乖離の注記**：§4.10 の列表に記載のある `discount` / `influencer_discount` / `notes` / `avg_per_customer` は**実DBには存在しない**。Excel往復フォーマット等は**実DBカラム基準**で設計する旨を注記。
>
> 詳細は §4.10 を参照。

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

## 2. テーブル一覧（17テーブル）

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

### 2.4 参考データ系（2テーブル・v1.8追加）

経営データ（取引系）とは**物理的に分離**された参考レイヤー。損益・予算比に流入しない。

| # | テーブル名 | 用途 |
|---|---|---|
| 16 | sales_departments | 部門マスタ（店舗ごと・部門別売上用） |
| 17 | daily_department_sales | 日次部門別売上（税込のみ・参考データ） |

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
| tax_base | VARCHAR(30) | NO | 'net_sales' | 課税ベース（'net_sales' or 'net_plus_service'） |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at | TIMESTAMPTZ | NO | now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | now() | 更新日時 |

**初期データ：**

| country_code | country_name_jp | tax_name | tax_rate | tax_base |
|---|---|---|---|---|
| TH | タイ | VAT | 0.0700 | net_plus_service |
| ID | インドネシア | PB1 | 0.1000 | net_plus_service |

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
| day_period | VARCHAR(10) | NO | 'all' | 'all' / 'lunch' / 'dinner'（昼夜分離店は 'lunch' と 'dinner' の2行を保持。§8.1 参照） |
| gross_sales | DECIMAL(12,2) | NO | 0 | 総売上（税込）／**独立入力値**。`net_sales` から自動算出しない（v1.7改訂）。昼夜分離店ではこの値が当該 day_period の税込売上（＝ランチ売上／ディナー売上）。`net_sales` との関係は桁違い警告のみ（§8.1.1） |
| service_fee | DECIMAL(12,2) | NO | 0 | サービス料（**自動計算**：`net_sales × stores.service_fee_rate`） |
| tax_amount | DECIMAL(12,2) | NO | 0 | 税額（**自動計算**：課税ベースは国マスタ `tax_base` に従う。§8.1 参照） |
| net_sales | DECIMAL(12,2) | NO | 0 | 税抜売上／**主入力値**（v1.7改訂）。予算比・概算粗利など業績指標はすべて `net_sales` を基準とする |
| customer_count | INTEGER | NO | 0 | 客数 |
| avg_per_customer | DECIMAL(12,2) | YES | - | 客単価（**自動計算**：`gross_sales ÷ customer_count`。分子は税込の `gross_sales`。`customer_count = 0` の場合は NULL） |
| discount | DECIMAL(12,2) | NO | 0 | 割引（任意） |
| influencer_discount | DECIMAL(12,2) | NO | 0 | インフルエンサー値引（任意） |
| weather | VARCHAR(50) | YES | - | 天気（任意、店舗設定で表示） |
| event_note | TEXT | YES | - | イベント・特記事項（任意） |
| notes | TEXT | YES | - | 備考 |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (store_id, business_date, day_period)

**インデックス：** (store_id, business_date DESC)

> **【v1.7 カラム位置づけの整理】**
> - **主入力値**：`net_sales`（税抜）。売上目標（`daily_targets.target_sales`）と同じ税抜基準で、予算比・粗利の集計に使用。
> - **独立入力値**：`gross_sales`（税込）。`net_sales` と自動連動しない（旧 v1.6 の `gross = net + service + tax` 連動は廃止）。昼夜分離店の「ランチ売上（税込）／ディナー売上（税込）」は、それぞれ `day_period = 'lunch' / 'dinner'` 行の `gross_sales` として独立入力する。
> - **自動計算値**：`service_fee`（= `net_sales × service_fee_rate`）、`tax_amount`（課税ベースに従う）、`avg_per_customer`（= `gross_sales ÷ customer_count`）。
> - **整合性**：`gross_sales` と `net_sales` の厳密一致は要求しない。桁違いのみ警告（§8.1.1）。

> **【v1.8 注記：`day_period` と部門別売上（参考データ）の関係】**
> - `day_period`（'all'/'lunch'/'dinner'）は **経営データ（`daily_sales`）の入力粒度**であり、`(store_id, business_date)` で集計すれば「1日合計」になる。新方針「経営は1日合計 `net_sales`」と矛盾しない。
> - v1.8 で追加する**部門別売上（`daily_department_sales`／§4.17）は、これとは独立した参考内訳軸**（税込・専用テーブル）。経営計算に流入しないため `day_period` と衝突しない。
> - **`day_period` は現状維持（案A）**。経営データの移行は行わない。lunch/dinner の概念は部門別売上とは別物として両立する。

> **【v1.9 方針変更：経営データは全店「1日1行（`day_period='all'`）」に統一】**
> - 経営データ（`daily_sales`）は**全店で 1日1行**（`day_period='all'`）で入力・保持する。**ジャカルタも今後は昼夜分離（lunch/dinner）では入力せず、1日合計で入力**する（要件定義書 v2.6 §4.2.1）。
> - 上記 v1.8 注記の「`day_period` は経営 net の入力粒度（all/lunch/dinner）」という位置づけは、本 v1.9 で**「全店 all 単位」に変更**する。時間帯・部門の細分は**部門別売上（§4.17）で扱い、経営データ側では昼夜・部門を分けない**。
> - **`day_period` の `lunch`/`dinner` という列・CHECK制約（`day_period IN ('all','lunch','dinner')`）は残す**が、**今後は使わない**（構造削除はしない＝既存データ・実装への影響回避のため）。UNIQUE `(store_id, business_date, day_period)` も不変。
> - Excel 往復フォーマット（要件 §4.5.5.1）もこの**全店 all 前提**で設計する。

> **【v1.9 注記：本表の列と実DBの乖離（重要）】**
> 本 §4.10 の列表は設計上の網羅列だが、**実DB（本番）の `daily_sales` には以下の列は存在しない**：`discount` / `influencer_discount` / `notes` / `avg_per_customer`。
> - 実DBの `daily_sales` 実カラムは：`id` / `store_id` / `business_date` / `day_period` / `gross_sales` / `net_sales` / `service_fee` / `tax_amount` / `customer_count` / `weather` / `event_note` / `created_at` / `updated_at`（金額列はいずれも `NUMERIC(15,2)`、各 `>= 0` の CHECK あり）。
> - `avg_per_customer`（客単価）は**列ではなく表示時に算出**する（`gross_sales ÷ customer_count`）。
> - **Excel 往復フォーマット（要件 §4.5.5.1）・各種エクスポート/インポートは、本注記の「実DBカラム」を基準に設計する**。本表の旧列（discount 等）は実装対象外。

> **【v1.10 注記：Excel往復フォーマットは daily_sales＋daily_department_sales の統合（重要）】**
> 日次売上のExcel往復フォーマット（要件 §4.5.5.1・実装済みの「統合フォーマット」）は、**`daily_sales`（経営データ）と `daily_department_sales`（部門別売上 §4.17）を 1枚のシートに横統合**して出力する（**店舗ごと1ファイル**・日付ごと1行・有効部門を display_order 順に横展開＋合計行）。
> - 経営データ列は本 §4.10 の実DBカラム（`store_id`/`business_date`/`day_period`/`net_sales`/`gross_sales`/`service_fee`/`tax_amount`/`customer_count`/`weather`/`event_note`）に準拠。**客単価・部門計は列ではなく参考表示の算出値**。
> - **経営データと部門別は連動しない**（各実値を表示）。`day_period` は **全店 `all` 前提**。`weather` はExcel上は日本語ラベル表示（DBは英字コード・出力時変換）。
> - 取込時のマッチングは、経営データ＝`(store_id, business_date, day_period)`、部門別＝`(store_id, business_date, department_id)`（いずれもUPSERT上書き）。**`service_fee`/`tax_amount`/客単価/部門計は取込せずサーバ側で再計算/再集計**。
> - 色付けのため出力は **ExcelJS** を使用（部門別の集計CSV/ExcelエクスポートはSheetJSのまま別系統）。**DBスキーマの変更は伴わない。**

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
| target_sales | DECIMAL(12,2) | NO | - | 当日の売上目標（**税抜＝`net_sales` 基準**。実績側 `daily_sales.net_sales` と同一基準で予算比を算出） |
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

### 4.16 sales_departments（部門マスタ・店舗別／v1.8追加）

部門別売上（参考データ）の部門定義。店舗ごとに完全独立で管理する（共通初期値なし）。仕入カテゴリマスタ（`purchase_categories`）と同型。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores（ON DELETE CASCADE） |
| department_name | VARCHAR(100) | NO | - | 部門名（例：朝食／昼食／夕食／デリバリー）。店舗ごと自由に追加・改名 |
| display_order | INTEGER | NO | 0 | 表示順 |
| is_active | BOOLEAN | NO | true | 有効フラグ（削除は**ソフト削除**＝is_active=false。物理削除しない） |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (store_id, department_name) — 同一店舗内で部門名は重複不可。

**インデックス：** (store_id) WHERE is_active = true。

**外部キー：** store_id → stores(id) ON DELETE CASCADE（店舗削除時に部門定義も消去）。

**備考：**
- 共通初期値（seed）は持たない。各店が運用開始時にゼロから登録する。
- 無効化（is_active=false）しても、過去の `daily_department_sales` 行は保持され、集計・構成比には引き続き含まれる（§8.8）。

### 4.17 daily_department_sales（日次部門別売上／v1.8追加）

部門別の**税込売上のみ**を保持する参考データ。**経営計算（損益・原価率・予算比）には一切使用しない**。日次仕入（`daily_purchases`）と同型のUPSERT上書き方式。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | 主キー |
| store_id | UUID | NO | - | FK to stores |
| business_date | DATE | NO | - | 営業日（店舗ローカル時間ベース） |
| department_id | UUID | NO | - | FK to sales_departments（ON DELETE RESTRICT） |
| gross_sales | DECIMAL(12,2) | NO | - | 部門の**税込売上**（参考値）。店舗ローカル通貨。JPY換算しない |
| notes | TEXT | YES | - | 備考（任意） |
| created_at, updated_at | TIMESTAMPTZ | NO | now() | 標準タイムスタンプ |

**ユニーク制約：** UNIQUE (store_id, business_date, department_id) — 1日の同一部門は1件。UPSERT（INSERT or UPDATE）で上書き（§8.7 と同方式）。

**インデックス：** (store_id, business_date DESC), (department_id, business_date DESC)。

**外部キー：**
- store_id → stores(id)
- department_id → sales_departments(id) ON DELETE RESTRICT（売上データを持つ部門の物理削除を防止。削除は親側 is_active で対応）

**設計上の重要点：**
- **税込売上のみ**を保持し、`net_sales`／`service_fee`／`tax_amount`／`customer_count`／`day_period` は持たない（参考データのため）。
- 入力は**任意**（空欄可）。経営売上（`daily_sales`）の保存をブロックしない。独立した保存経路で扱う。
- 部門別合計と `daily_sales` の1日合計の一致は**検証しない**（CHECK・警告なし）。

> **【v1.10 注記：日次売上のExcel統合フォーマットでの扱い】**
> 本テーブルは、日次売上のExcel往復フォーマット（要件 §4.5.5.1・実装済みの「統合フォーマット」）で **`daily_sales` と同一シートに横統合**して出力される。**有効部門（`sales_departments.is_active=true`）を `display_order` 順に列展開**し、各セルにその日・その部門の `gross_sales` を表示、末尾に「部門計（参考の合計）」列を出す。**`daily_sales`（経営データ）とは連動しない実値**。取込時は本テーブルへ `(store_id, business_date, department_id)` でUPSERT上書き（部門計は再集計）。出力は色付けのため ExcelJS を使用（§4.10 の注記参照）。

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

### 5.1.1 参考データ系（v1.8追加）のRLS方針

新テーブル2つは既存の権限カテゴリにそのまま準拠する（新しいヘルパー関数は不要）。

| テーブル | 区分 | 読取 | 書込 |
|---|---|---|---|
| sales_departments（部門マスタ） | マスタ系（店舗別）に準拠 | 自店R（`can_access_store(store_id)`）／経営層・経理は全店R | **店長以上**（executive / country_rep / store_manager）が自店W |
| daily_department_sales（日次部門別売上） | 取引系に準拠 | 自店R／経営層・経理は全店R | **売上を入力できる人（`daily_sales` と同一権限）**が自店W（現場社員 staff も入力可） |

- 経営層（executive）は全店RW。各国代表（country_rep）は自国R。経理（accounting）は全店R。
- 抽出/閲覧範囲：**自店のみ／経営層は全店**（§5.1 マトリクスの店舗別マスタ・取引系と同じ）。

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

【v1.7 注記】本改訂は計算ロジック・カラム位置づけの再定義であり、**テーブル列・制約・型の変更を伴わない**ため、新規マイグレーションSQLは不要。変更の影響範囲はアプリケーション層（売上計算・入力UI・バリデーション）に限定される。

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

**【v1.7：制度変更】** 売上は **`net_sales`（税抜）を主入力値**とする。`gross_sales`（税込）は独立入力値であり、`net_sales` から自動算出しない。

```
─────────────────────────────────────────────────────────
【入力値】
  net_sales（税抜売上）   ← 主入力。予算・業績指標の基準
  gross_sales（総売上・税込） ← 独立入力。net_sales と連動しない
  customer_count（客数）   ← 入力

【自動計算値（net_sales を基準に算出）】
  サービス料（service_fee）
    = net_sales × stores.service_fee_rate

  税額（tax_amount）
    = (net_sales + service_fee) × countries.tax_rate      （タイ：tax_base = 'net_plus_service'、税率7%）
    = (net_sales + service_fee) × countries.tax_rate      （インドネシア：tax_base = 'net_plus_service'、税率10%）
    ※両国とも課税ベースは同一（net_sales + service_fee）。税率のみ異なる（タイ7%・インドネシア10%）。

  客単価（avg_per_customer）
    = gross_sales ÷ customer_count                        （分子は税込の gross_sales。customer_count = 0 なら NULL）
─────────────────────────────────────────────────────────
```

**昼夜分離店（`stores.is_lunch_dinner_split = true`）の扱い：**

- `day_period` 行方式を維持し、`'lunch'` 行・`'dinner'` 行の2レコードで保持する（DB列は変更しない）。
- 各行の `gross_sales` が、それぞれ税込の**ランチ売上／ディナー売上**（独立入力）。
- 各行の `net_sales`（税抜）が業績指標の主入力。予算比・粗利の集計時は `day_period IN ('lunch', 'dinner')` を合算する。
- 昼夜区分のない店舗は `day_period = 'all'` の1行のみを使用する。

**旧 v1.6 からの変更点：**

- ❌ 廃止：`gross_sales = net_sales + service_fee + tax_amount`（自動連動）
- ❌ 廃止：「`net_sales` は入力 or 自動計算」という曖昧な位置づけ → **`net_sales` を主入力に確定**
- ✅ 維持：`service_fee = net_sales × service_fee_rate`（v1.6 と同一）
- 🔄 変更：`avg_per_customer` の分子を `gross_sales`（税込）と明記（v1.6 も `gross_sales / customer_count` だが、`gross_sales` の意味が「自動算出値」→「独立入力値」に変わったため再定義）

### 8.1.1 売上入力の整合性チェック（桁違い警告のみ）

**【v1.7：新規】** `gross_sales` と `net_sales` は独立入力のため、両者の厳密な一致（旧「税抜＋税＝税込」）は**検証しない**。入力ミス（桁の打ち間違い）の検出のみを目的に、以下の緩い警告を行う。

```
比率 r = gross_sales ÷ net_sales        （net_sales > 0 の場合のみ算出）

  r > 2.0   → 警告表示（桁違いの可能性：税込が税抜の2倍超）
  r < 0.5   → 警告表示（桁違いの可能性：税込が税抜の半分未満）
  0.5 ≤ r ≤ 2.0 → 警告なし
```

- 警告は**保存をブロックしない**（保存は常に許容）。入力者への注意喚起のみ。
- `net_sales = 0` または未入力の場合は比率を算出せず、警告も出さない。
- 昼夜分離店では `day_period` 行ごと（`'lunch'` / `'dinner'`）に判定する。
- 旧 v1.6 までの「税抜＋税＝税込」の厳密整合性チェックは**廃止**。

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

日報配信時、各店舗ごとに「月初〜前日まで」の予算比を計算する。予算・実績ともに **`net_sales`（税抜）基準**で統一されている。

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

> **【注記：要件定義書 v2.8 §4.5.6 と整合】** 日次売上の統合フォーマット**往復インポートを実装済み**。`daily_sales`／`daily_department_sales` への取込は本節の UPSERT・マッチングキー（`daily_sales`: `(store_id, business_date, day_period='all')`／`daily_department_sales`: `(store_id, business_date, department_id)`）に従い、**ファイルに無い行は変更しない（DELETE しない）**。取込時、`service_fee`/`tax_amount` は取込値を使わず **§8.1 の計算で再計算した値を保存**、**客単価（avg_per_customer）は列が無いため保存せず表示のみ**。プレビュー→確認→実書き込みの2段・サーバ側再検証/再計算・2テーブル非原子（再取込で回復）は要件 v2.8 §4.5.6 を参照。**本実装に伴うDBスキーマ変更はない。§8.1 の計算式は不変。**

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

### 8.8 部門別売上の構成比（部門内シェア・累計／v1.8追加）

部門別売上（`daily_department_sales`）の**参考指標**。経営計算とは独立し、`daily_sales` を参照しない。

**定義：**

- **構成比（部門内シェア）= 各部門の累計税込売上 ÷ 同一店舗・同一期間の全部門累計税込売上**。
- 分母は「部門別売上の累計合計」であり、`daily_sales` の1日合計ではない。したがって**全部門のシェア合計は必ず 100%** になる。
- **累計ベース**。期間既定は「当月初〜直近」（UIで手動変更可）。
- 無効化済み（is_active=false）の部門でも、過去データを持つ場合は集計・構成比に**含める**。
- **表示対象は「対象期間に売上データがある部門のみ」**（INNER JOIN方式で確定）。売上のない部門は構成比に表示しない（0%行は出さない）。

**SQL実装イメージ（店舗＋期間で集計）：**

```sql
SELECT
  d.id                  AS department_id,
  d.department_name,
  SUM(dds.gross_sales)  AS cumulative_gross,          -- 部門の累計税込売上
  ROUND(
    SUM(dds.gross_sales) * 100.0
      / NULLIF(SUM(SUM(dds.gross_sales)) OVER (), 0)   -- 全部門の累計総計（分母）
  , 1)                  AS share_pct                   -- 部門内シェア（%）
FROM sales_departments d
JOIN daily_department_sales dds
  ON dds.department_id = d.id
WHERE d.store_id = :store_id
  AND dds.business_date BETWEEN :from_date AND :to_date  -- 累計範囲（既定：当月初〜直近）
GROUP BY d.id, d.department_name, d.display_order
ORDER BY d.display_order;
```

**ポイント：**

- `SUM(SUM(dds.gross_sales)) OVER ()`：GROUP BY 後の各部門合計を、さらにウィンドウ全体で合計した「全部門の累計総計」。これを分母にすることで `share_pct` の総和が 100% になる。
- `NULLIF(..., 0)`：対象期間にデータが0件のときのゼロ除算を回避（結果は NULL ＝ UI では「—」表示）。
- **【確定】データのない部門は表示しない（INNER JOIN方式で確定）**：上記のとおり `JOIN`（INNER）を採用し、**対象期間に売上データがある部門のみ**を構成比に表示する。データのない部門を 0% 行として出すこと（`LEFT JOIN`）は行わない。
- 無効化済み部門も `daily_department_sales` 行が残る限り集計対象（is_active で除外しない）。
- 経営データ（`daily_sales`／`net_sales`）には一切アクセスしない純粋な参考クエリ。

---

## 9. 残課題

| # | 項目 | 解消フェーズ |
|---|---|---|
| 1 | RLSポリシーのSQL実装詳細 | フェーズ5（画面設計）または実装着手時 |
| 2 | インデックス追加（実運用後のクエリパフォーマンス次第） | 本番運用後 |
| 3 | バックアップ戦略（Supabase標準＋追加対策の要否） | 実装着手前 |
| 4 | system_settingsの初期値全リスト | 実装着手前 |
| 5 | v1.7制度変更の他文書反映（requirements_v2.3 §4.2.1/§5.1/§4.4、screen_design_v1.0 §6.3、CLAUDE.md の税計算サンプル） | 本改訂と連動して実施 |

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
| 2026-05-30 | v1.7 | **売上計算の制度変更**：(1) `net_sales`（税抜）を売上の**主入力値**に確定（予算・売上入力とも税抜基準）、(2) `gross_sales`（税込）を**独立入力値**に再定義し `gross = net + service + tax` の自動連動を**廃止**、(3) `service_fee = net_sales × service_fee_rate`（net基準）を明記（式自体はv1.6と同一）、(4) ランチ／ディナー売上は `day_period` 行方式を維持しつつ各行の `gross_sales` を税込で独立入力（DB列変更なし）、(5) `avg_per_customer = gross_sales ÷ customer_count`（分子は税込）と明記、(6) §8.1.1 を新設し整合性チェックを「桁違い警告のみ」（`gross ÷ net` が 2.0超 / 0.5未満で警告、保存は許容）に緩和。**テーブル列・制約の変更なし**。§4.10・§8.1・§8.1.1・§4.14 を改訂。 | 比嘉俊一 |
| 2026-05-30 | v1.8 | **部門別売上（参考データ）機能を追加**（既存の経営データ定義・計算は不変、追加レイヤー）：(1) §2.4・§4.16 に `sales_departments`（部門マスタ・店舗別／UNIQUE (store_id, department_name)／FK ON DELETE CASCADE／ソフト削除）を新設、(2) §4.17 に `daily_department_sales`（日次部門別売上・**税込のみ**／UNIQUE (store_id, business_date, department_id) で UPSERT 上書き／FK department_id ON DELETE RESTRICT／入力任意）を新設、(3) §5.1.1 に両テーブルのRLS方針（マスタは店長以上W・日次は `daily_sales` と同一権限W・閲覧は自店/経営層全店）を追加、(4) §8.8 に**構成比＝部門内シェア（各部門累計 ÷ 部門別累計合計、合計100%・累計ベース）**の集計SQLを新設、(5) §4.10 に `day_period`（現状維持・案A）と部門別売上の関係注記を追加。**経営計算（損益・予算比）には一切流入しない。テーブル一覧 15→17。** | 比嘉俊一 |
| 2026-05-30 | v1.9 | **経営データの運用方針を明記（テーブル列・制約・計算ロジックの変更なし）**：(1) §4.10 に**経営データを全店「1日1行（`day_period='all'`）」に統一する方針変更**を注記（ジャカルタも昼夜分離せず1日合計で入力。時間帯・部門の細分は部門別売上 §4.17 で扱う。`day_period` の lunch/dinner 列・CHECK・UNIQUE は残すが今後不使用＝**構造削除しない**。v1.8 の「day_period は入力粒度」位置づけを「全店 all 単位」に変更）、(2) §4.10 に**実DBカラム乖離の注記**を追加（本表の `discount`/`influencer_discount`/`notes`/`avg_per_customer` は実DB非存在。実カラムは id/store_id/business_date/day_period/gross_sales/net_sales/service_fee/tax_amount/customer_count/weather/event_note/created_at/updated_at。Excel往復フォーマット等は実DBカラム基準で設計）。要件定義書 v2.6 と整合。**§8.1 税計算の記述は不変。** | 比嘉俊一 |
| 2026-05-31 | v1.10 | **Excel往復フォーマットが daily_sales＋daily_department_sales の「統合フォーマット」になった旨を注記（テーブル列・制約・計算ロジックの変更なし）**：(1) §4.10 に注記を追加＝日次売上のExcel往復フォーマット（要件 §4.5.5.1）は **`daily_sales`（経営データ）と `daily_department_sales`（部門別 §4.17）を1枚に横統合**（店舗ごと1ファイル・有効部門を display_order 順に横展開＋合計行・客単価/部門計は算出値・経営と部門は非連動・`day_period` は全店 all・天気は出力時に日本語ラベル変換・色付けは ExcelJS・取込時の `service_fee`/`tax_amount`/客単価/部門計は再計算/再集計）、(2) 関連文書を要件定義書 v2.7 に更新。**DBスキーマ変更なし。§8.1 税計算の記述は不変。** | 比嘉俊一 |

---

**以上**
