# Sales Console システム仕様書 v1.0

**KOGAホールディングス 海外飲食店 売上管理システム（Sales Console）**

| 項目 | 内容 |
|---|---|
| 文書名 | システム仕様書（System Specification） |
| バージョン | v1.0 |
| 最終更新 | 2026-06 |
| 対象システム | Sales Console（タイ・インドネシア 飲食店 売上管理） |
| 開発体制 | 比嘉俊一（KOGAホールディングス 専務取締役・COO/CFO）＋ Claude Code |
| 関連文書 | 要件定義書 v2.9 / データモデル設計書 v1.11 / 画面設計書 v1.2 / 国際化設計 v1.0 / API仕様 api_v1.md |

> 本書は実装（コード・本番DB）を「正」として、システム全体の仕様を1冊に統合した参照文書です。
> 詳細な要件・データ定義・画面定義は上表の各設計書を正典とします。記載が実画面と食い違う場合は実装を優先します。

---

## 目次

1. システム概要
2. スコープ（対象範囲）
3. 利用者とロール・権限
4. 技術スタックとアーキテクチャ
5. 画面一覧（機能仕様）
6. データモデル（テーブル仕様）
7. 業務ルール（計算ロジック）
8. 外部連携・自動処理
9. セキュリティ
10. 運用・デプロイ
11. 非機能要件
12. 既知の制約・今後の課題
13. 改訂履歴

---

## 1. システム概要

タイ・インドネシアの飲食店3店舗の日次オペレーションを統合管理するWebアプリケーション。

**提供価値（3本柱）**

1. **現場入力** — 各店舗が日次の売上・仕入・販管費・概算棚卸を入力する。
2. **本部リアルタイム把握** — 経営層が全店の状況をダッシュボード・期間集計で即時に把握する。
3. **月次PL自動化** — 日次入力から月次の損益計算書を自動集計する。

通貨・税制が国ごとに異なるため、**現地通貨での入力 → 月末レートでの円換算**を前提に設計されている。

---

## 2. スコープ（対象範囲）

| 区分 | 内容 |
|---|---|
| 対象国 | タイ、インドネシア（将来：ベトナム・アメリカ・台湾等の通貨/国マスタは追加済み） |
| 対象店舗 | 飲食店3店舗（店舗マスタで増減可能・店舗番号は自動採番） |
| 対象業務 | 日次売上／日次仕入／日次販管費／概算棚卸／売上目標／月次PL／各種集計 |
| 利用端末 | PC（ブラウザ）＋スマートフォン（レスポンシブ対応） |
| 対象外 | POS連携・会計ソフト直接連携・給与計算（本システムの範囲外） |

---

## 3. 利用者とロール・権限

### 3.1 ロール（5種）

| ロール | 表示名 | 想定利用者 | データ範囲 |
|---|---|---|---|
| executive | 経営層 | 本部（専務等） | 全店・全機能 |
| country_rep | 各国代表 | 国の責任者 | 担当国の店舗 |
| store_manager | 店長 | 店舗責任者 | 割当店舗 |
| staff | 現場担当 | 現場スタッフ | 割当店舗の入力 |
| accounting | 経理 | 経理担当 | 全店データ閲覧・経理マスタ |

### 3.2 能力（capability）と権限設定

権限は固定ではなく、`role_permissions` テーブルで **ロール × 能力** を可変に設定できる（管理画面「権限設定」でその場で変更 → RLS・画面表示に即反映）。能力は10種。

| 能力 | 内容 | 既定の許可ロール |
|---|---|---|
| exec_master | 経営マスタ編集／権限設定（店舗・店舗グループ・国・通貨・権限設定） | 経営層 |
| accounting_master | 経理マスタ編集（為替レート・経費カテゴリ） | 経営層・経理 |
| store_master | 店舗マスタ編集（仕入先・仕入カテゴリ・部門） | 経営層・各国代表・店長 |
| targets | 売上目標 編集 | 経営層・各国代表・店長 |
| daily_input | 日次・月次入力（売上・仕入・棚卸・営業日数・月次PL販管費） | 経営層・各国代表・店長・現場担当 |
| all_store_access | 全店データ閲覧 | 経営層・経理 |
| user_management | ユーザー管理（招待・ロール付与・店舗割当・有効/無効） | 経営層 |
| api_keys | APIキー管理（発行・失効） | 経営層 |
| audit_log | 監査ログ閲覧 | 経営層 |
| system_settings | システム設定（Slack通知・為替自動取得等） | 経営層 |

**ロックアウト防止**：経営層の `exec_master` は無効化不可（DBトリガーで保護）。誰も設定変更できなくなる事故を防ぐ。

**RLSヘルパー関数**：`has_capability(cap)` / `is_executive()`(=exec_master) / `can_write()`(=daily_input) / `can_access_store(store_id)` / `current_user_role()`。

---

## 4. 技術スタックとアーキテクチャ

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 14.2（App Router）＋ TypeScript 5.5 ／ React 18.3 |
| UI | Tailwind CSS ＋ shadcn/ui ／ アイコン lucide-react ／ チャート recharts |
| バックエンド | Supabase（PostgreSQL ＋ Auth ＋ Storage ＋ Row Level Security） |
| Supabase SDK | @supabase/ssr 0.10 ／ @supabase/supabase-js 2.45 |
| 入力検証 | zod 3.23 |
| Excel処理 | exceljs 4.4 ／ xlsx 0.18 |
| 日付処理 | date-fns 3.6 |
| デプロイ | Vercel（フロント）＋ Supabase（バックエンド・Tokyoリージョン） |

**アーキテクチャ方針**

- 既定は Server Components。クライアント操作が必要な箇所のみ `'use client'`。
- フォーム処理は Server Actions を優先。
- 状態は URL（searchParams）を活用し `useState` を最小化。
- すべてのDBアクセスは Supabase クライアント経由で **RLS が自動適用**される。
- 2種のクライアント：`createClient()`（セッション/RLS適用）と `createAdminClient()`（service role・RLSバイパス／サーバ専用）。

---

## 5. 画面一覧（機能仕様）

### 5.1 認証（認証不要）

| 画面 | パス | 機能 |
|---|---|---|
| ログイン | /login | メール＋パスワード認証 |
| パスワード再設定 | /reset-password | 再設定メール送信 |
| パスワード変更 | /change-password | リセットリンク経由の変更 |

### 5.2 業務（認証必須）

| 画面 | パス | 機能 |
|---|---|---|
| ダッシュボード | /dashboard | 当月の店舗別サマリ（売上・予算比・粗利率・前年比・当日入力状況）、お知らせ、マニュアル導線 |
| 日次売上入力 | /daily-input/sales | 店舗×営業日の売上入力（税抜が主入力・税額/サービス料自動計算） |
| 日次仕入入力 | /daily-input/purchases | カテゴリ別チェックリスト方式の仕入入力 |
| 売上目標 | /targets | 店舗×日別の売上予算（カレンダー入力） |
| 月次PL（損益） | /pl | 店舗×月の損益計算書（売上・原価・粗利・販管費・営業利益） |
| 期間集計 | /period-summary | 期間指定の全店/グループ横断集計（円換算合計） |
| 仕入先別 仕入集計 | /purchase-summary | 期間内の仕入先別集計 |
| データ閲覧 | /data | 入力済み日次データの一覧確認 |
| プロフィール | /profile | 自分の情報・パスワード変更 |

### 5.3 マスタ管理

店舗マスタ／店舗グループ／国マスタ／仕入カテゴリ／仕入先／部門マスタ／為替レート（`/masters/*`）。

### 5.4 管理（システム設定 配下）

「システム設定」を入口（ハブ）とし、保有する管理権限に応じて各機能へ導線を表示。

| 画面 | パス | 必要能力 |
|---|---|---|
| システム設定 | /admin/settings | system_settings 等いずれかの管理権限 |
| 権限設定 | /admin/permissions | exec_master |
| ユーザー管理 | /admin/users | user_management |
| 監査ログ | /admin/audit | audit_log |
| APIキー | /admin/api-keys | api_keys |

### 5.5 マニュアル

設定マニュアル（/manuals/setup）／運用マニュアル（/manuals/operations）。各ページ右上から PDF 出力（印刷→PDF保存）可能。

---

## 6. データモデル（テーブル仕様）

本番DBの全23テーブル（public スキーマ）。すべて RLS 有効。

### 6.1 マスタ系

| テーブル | 用途 |
|---|---|
| countries | 国マスタ。税制（税率・課税ベース）を保持 |
| currencies | 通貨マスタ（記号・名称） |
| exchange_rates | 為替レート（月末レート方式・1ペア1値・当月全データに統一適用） |
| stores | 店舗マスタ（サービス料率・税制連動・店舗番号・入力画面オプション） |
| store_groups | 店舗グループ（集計のまとめ単位・論理削除） |
| store_group_members | 店舗グループ所属（group_id × store_id） |
| profiles | ユーザープロフィール（auth.users と1:1・退職者は is_active=false） |
| user_store_assignments | ユーザー×店舗の所属（経営層・経理は空＝全店） |
| purchase_categories | 仕入カテゴリ（店舗別） |
| suppliers | 仕入先（店舗別・1カテゴリ紐付き・原価区分） |
| sales_departments | 部門マスタ（店舗別・参考データ用） |
| role_permissions | ロール×能力の許可設定（has_capability が参照） |

### 6.2 取引系

| テーブル | 用途 |
|---|---|
| daily_sales | 日次売上（昼夜分離店は lunch/dinner で2行・UNIQUE で UPSERT） |
| daily_purchases | 日次仕入（1日1仕入先1行・同日重複は上書き） |
| daily_targets | 日別売上目標（月単位カレンダー入力・曜日変動反映） |
| daily_department_sales | 日次部門別売上（参考データ・税込のみ・経営計算には不使用） |
| inventory_estimates | 概算棚卸スナップショット（店舗×日付・スパース記録） |
| monthly_business_days | 月次営業日数（店舗×月・手入力・月次予測に使用） |
| monthly_expenses | 月次販管費（店舗×月×科目・自由名・区分タグ labor/depreciation/other） |
| expense_formulas | 変動費の計算式科目（店舗×科目・全月共通・金額は保存せず都度計算） |

### 6.3 運用・連携系

| テーブル | 用途 |
|---|---|
| system_settings | システム設定（KV型） |
| audit_logs | 監査ログ（機微な管理操作の追記専用履歴・閲覧は exec_master） |
| api_keys | REST API キー（平文非保存・sha256ハッシュ・scope read/read_write・失効=is_active=false） |

### 6.4 設計の4レイヤー方針

経営データ（取引系）と参考データ（部門別売上等）を**物理的に分離**。参考データは損益・予算比に流入しない。

---

## 7. 業務ルール（計算ロジック）

正典：データモデル設計書 v1.11 §8（計算ロジック仕様）。

### 7.1 売上の税計算（net 主入力）

- **税抜売上（net_sales）が主入力**。予算・業績指標の基準。
- **サービス料** ＝ 税抜売上 × 店舗のサービス料率（`stores.service_fee_rate`・店舗ごと）。
- **税額** ＝ 課税ベース × 国の税率（`countries.tax_rate`・国ごと）。
  - 課税ベース（`countries.tax_base`）：タイ・インドネシアとも `net_plus_service`（税抜＋サービス料）。
  - 税率：タイ 7%（VAT）／インドネシア 10%（PB1）。
- **税込売上（gross_sales）・ランチ／ディナー売上は独立入力**（税抜から自動算出しない）。
- **客単価** ＝ 税込売上 ÷ 客数。
- 整合性は「桁違い警告」のみ（税込/税抜比が極端なら警告。保存はブロックしない）。

**検算例（タイ・サービス料10%・VAT7%）**：税抜100,000 → サービス料10,000 →（100,000＋10,000）×7%＝税額7,700。

### 7.2 為替（月末レート方式）

- `exchange_rates` は通貨ペアごとに1値のみ保持。**当月の全データを現在のレートで換算**。
- レート更新時は**過去データも遡って再計算**（effective_date は計算に使わずメタ情報）。
- 月次自動取得：毎月1日（JST 9:00）に前月末レートを無料API（ECB）から取得。ECB非対応通貨（VND・TWD等）はスキップ → 手動入力で補完。

### 7.3 達成率の色分け（全システム共通）

| 達成率 | 色 | 区分 |
|---|---|---|
| 100%以上 | 緑（emerald） | success |
| 95%以上 100%未満 | 黒（slate-900） | neutral |
| 95%未満 | 朱（rose） | warning |

### 7.4 データ取り扱い原則

- **上書き方式（UPSERT）**：Excel取込・再入力はマッチする既存行を上書き、なければ追加。
  - UNIQUE：daily_sales(store_id,business_date,day_period) ／ daily_purchases(store_id,business_date,supplier_id) ／ daily_expenses(store_id,business_date,expense_account_id) ／ daily_targets(store_id,target_date)。
- **無効化（ソフト削除）**：退職者・廃止店舗・廃止科目は削除せず `is_active=false`。
  - **例外（物理削除許可）**：`monthly_expenses`（手入力販管費科目）と `expense_formulas`（計算式科目）のみ、誤追加整理のため DELETE 可。他は禁止。

### 7.5 月次予測

売上/原価の月次予測 ＝ 累計 ÷ 経過営業日数 × 当月営業日数（`monthly_business_days` を使用）。

### 7.6 変動費の計算式（expense_formulas）

4タイプ：`percent`（売上比）／`tiered`（段階）／`fixed`（定額）／`fixed_plus_percent`（定額＋売上比）。net_sales から都度計算（金額は保存しない）。

---

## 8. 外部連携・自動処理

### 8.1 Slack 日報

毎朝 JST 9:00（Vercel Cron `0 0 * * *` → `/api/reports/daily`）、前日の店舗別売上サマリを Slack Incoming Webhook へ配信。Webhook URL はシステム設定（または環境変数）で設定。

### 8.2 為替レート自動取得

毎月1日 JST 9:00（Vercel Cron `0 0 1 * *` → `/api/exchange-rates/sync`）、前月末の対JPYレートを取得・反映（§7.2）。

### 8.3 REST API（v1）

外部AI/ツール連携用。APIキー（Bearer）認証。エンドポイント：`/api/v1/stores`・`/api/v1/period-summary`・`/api/v1/daily-sales`・`/api/v1/daily-purchases`。詳細は `docs/api_v1.md`、補助として MCP サーバ（`mcp/`）を提供。

### 8.4 cron の認証

`CRON_SECRET` を設定している場合は `Authorization: Bearer <CRON_SECRET>` を要求（未設定でも動作）。

---

## 9. セキュリティ

- **認証**：Supabase Auth（メール＋パスワード、TOTP有効化可）。`middleware.ts` で未認証を /login へ誘導（API ルートはハンドラ内で認証）。
- **認可**：全テーブルに RLS。`has_capability` ベースで能力単位に制御。書き込みは強い能力を要求。
- **監査ログ**：機微な管理操作（設定変更・権限変更・ユーザー操作・為替自動同期等）を `audit_logs` に追記専用で記録。閲覧は exec_master。
- **APIキー**：平文を保存せず sha256 ハッシュのみ。発行時のみ平文表示。失効は `is_active=false`。書き込みスコープ付与は要注意。
- **自己ロックアウト防止**：自分のロール変更・自分の無効化を禁止。経営層の exec_master 無効化をトリガーで禁止。
- **秘密情報**：`SUPABASE_SERVICE_ROLE_KEY` 等は `NEXT_PUBLIC_` を付けずサーバ専用。`.env.local` はバージョン管理外。

---

## 10. 運用・デプロイ

### 10.1 デプロイ構成

- フロント：Vercel（GitHub 連携による push 自動デプロイを採用予定）。
- バックエンド：Supabase（Tokyo リージョン）。マイグレーションは `supabase/migrations/*.sql` を順次適用。
- 定時処理：`vercel.json` の crons（現在有効：日報・為替自動取得の2本／いずれも1日1回・無料プラン適合）。

### 10.2 環境変数

| 変数 | 用途 | 機微 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase プロジェクトURL | 公開可 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 匿名キー（ブラウザ用） | 公開可 |
| SUPABASE_SERVICE_ROLE_KEY | サービスロール（サーバ用） | **機微** |
| NEXT_PUBLIC_SITE_URL | メールリンク先（再設定・招待） | 公開可 |
| SLACK_WEBHOOK_URL | Slack 日報配信先（任意・DB保存も可） | 機微 |
| CRON_SECRET | cron 保護（任意・推奨） | 機微 |

### 10.3 タイムゾーン

業績日付は店舗ローカル日付（`business_date DATE`）で保存。集計・cron は JST（UTC+9）基準で算出。

---

## 11. 非機能要件

- **レスポンシブ**：主要画面（ダッシュボード・期間集計・日次入力・月次PL等）は PC で表、スマホでカード表示に切替。PC表示は従来どおり維持。
- **国際化**：多言語対応の設計基盤あり（`docs/I18N_ARCHITECTURE_v1.0.md`）。
- **可読性**：見出し＝SF Pro Display／数字＝JetBrains Mono（桁揃え）／日本語フォールバック。
- **パフォーマンス**：Server Components 中心。集計は期間集計ロジックを共通化して再利用。

---

## 12. 既知の制約・今後の課題

- **未実装（設計のみ）の自動処理3種**：日次入力リマインダー（`/api/reminders/daily-input`）、棚卸リマインダー（`/api/reminders/inventory`）、アラート（`/api/alerts/check`）。現状 cron からは外している。
- **本番デプロイ**：GitHub-Vercel 連携の設定を本番運用開始時に実施（手順は別途案内）。hourly 等の高頻度 cron は無料プランの制約に留意。
- **実データ検証**：本番データ投入後に税計算・PL・円換算の数値突合を実施予定。
- 詳細な残課題は要件定義書 v2.9 §9 を参照。

---

## 13. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-06 | 初版。実装（本番DB23テーブル・実コード）と最新設計書（要件 v2.9／データモデル v1.11／画面 v1.2）を統合したシステム仕様書を新規作成。 |

---

*© KOGA Holdings — 海外飲食店 売上管理システム（Sales Console）。本書は仕様変更に追従して更新されます。*
