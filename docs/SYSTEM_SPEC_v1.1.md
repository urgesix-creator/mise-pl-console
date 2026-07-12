# Sales Console システム仕様書 v1.1

**KOGAホールディングス 海外飲食店 売上管理システム（Sales Console）**

| 項目 | 内容 |
|---|---|
| 文書名 | システム仕様書（System Specification） |
| バージョン | v1.1 |
| 最終更新 | 2026-06 |
| 対象システム | Sales Console（タイ・インドネシア 飲食店 売上管理） |
| 開発体制 | 比嘉俊一（KOGAホールディングス 専務取締役・COO/CFO）＋ Claude Code |
| 関連文書 | 要件定義書 v2.9 / データモデル設計書 v1.11 / 画面設計書 v1.2 / 国際化設計 v1.0 / API仕様 api_v1.md |

> 本書は実装（コード・本番DB）を「正」として、システム全体の仕様を1冊に統合した参照文書です。
> 詳細な要件・データ定義・画面定義は上表の各設計書を正典とします。記載が実画面と食い違う場合は実装を優先します。
> **v1.1 では、本番公開（Vercel Pro・GitHub自動デプロイ）、Next.js 16系への更新、初期設定／日別売上画面の追加、祝日フィールド・ユーザー削除・販管費の全月一括入力など、現行実装を反映しました（詳細は §13 改訂履歴）。**

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
2. **本部リアルタイム把握** — 経営層が全店の状況をダッシュボード・期間集計・日別売上で即時に把握する。
3. **月次PL自動化** — 日次入力から月次の損益計算書を自動集計する。

通貨・税制が国ごとに異なるため、**現地通貨での入力 → 月末レートでの円換算**を前提に設計されている。

**稼働状況**：本番公開済み（`https://sales-console-rho.vercel.app`）。`main` への push で約1〜2分で自動デプロイされる。

---

## 2. スコープ（対象範囲）

| 区分 | 内容 |
|---|---|
| 対象国 | タイ、インドネシア（将来：ベトナム・アメリカ・台湾等の通貨/国マスタは追加済み） |
| 対象店舗 | 飲食店3店舗（店舗マスタで増減可能・店舗番号は自動採番） |
| 対象業務 | 日次売上／日次仕入／日次販管費／概算棚卸／売上目標／月次PL／各種集計／日別売上 |
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

権限は固定ではなく、`role_permissions` テーブルで **ロール × 能力** を可変に設定できる（管理画面「権限設定」でその場で変更 → RLS・画面表示に即反映）。能力は **11種**。

| 能力 | 内容 | 既定の許可ロール |
|---|---|---|
| exec_master | 経営マスタ編集／権限設定（店舗・店舗グループ・国・通貨・権限設定） | 経営層 |
| accounting_master | 経理マスタ編集（為替レート・経費カテゴリ） | 経営層・経理 |
| store_master | 店舗マスタ編集（仕入先・仕入カテゴリ・部門） | 経営層・各国代表・店長 |
| targets | 売上目標 編集 | 経営層・各国代表・店長 |
| daily_input | 日次・月次入力（売上・仕入・棚卸・営業日数・月次PL販管費） | 経営層・各国代表・店長・現場担当 |
| all_store_access | 全店データ閲覧 | 経営層・経理 |
| user_management | ユーザー管理（招待・ロール付与・店舗割当・有効/無効・削除） | 経営層 |
| api_keys | APIキー管理（発行・失効） | 経営層 |
| audit_log | 監査ログ閲覧 | 経営層 |
| system_settings | システム設定（Slack通知・為替自動取得等） | 経営層 |
| **manage_initial_setup** | **初期設定（Excel一括投入ハブ）** | 経営層 |

**ロックアウト防止**：経営層の `exec_master` は無効化不可（DBトリガーで保護）。誰も設定変更できなくなる事故を防ぐ。

**RLSヘルパー関数**：`has_capability(cap)` / `is_executive()`(=exec_master) / `can_write()`(=daily_input) / `can_access_store(store_id)` / `current_user_role()`。

---

## 4. 技術スタックとアーキテクチャ

| 層 | 技術 |
|---|---|
| フロントエンド | **Next.js 16.2（App Router）** ＋ TypeScript 5.5 ／ React 18.3 |
| UI | Tailwind CSS ＋ shadcn/ui ／ アイコン lucide-react ／ チャート recharts |
| バックエンド | Supabase（PostgreSQL ＋ Auth ＋ Storage ＋ Row Level Security） |
| Supabase SDK | @supabase/ssr 0.10 ／ @supabase/supabase-js 2.45 |
| 入力検証 | zod 3.23 |
| Excel処理 | **exceljs 4.4**（旧 xlsx/SheetJS は脆弱性対応のため撤去済み） |
| 日付処理 | date-fns 3.6 |
| デプロイ | Vercel（フロント・Pro）＋ Supabase（バックエンド・Tokyoリージョン） |

**アーキテクチャ方針**

- 既定は Server Components。クライアント操作が必要な箇所のみ `'use client'`。
- フォーム処理は Server Actions を優先。
- 状態は URL（searchParams）を活用し `useState` を最小化。選択店舗は Cookie で全画面保持。
- すべてのDBアクセスは Supabase クライアント経由で **RLS が自動適用**される。
- 2種のクライアント：`createClient()`（セッション/RLS適用・async）と `createAdminClient()`（service role・RLSバイパス／サーバ専用）。
- Next.js 15+ の仕様に対応：`cookies()` は await、ページの `searchParams` は Promise（await）。

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
| 日次売上入力 | /daily-input/sales | 店舗×営業日の売上入力（税抜が主入力・税額/サービス料自動計算・客単価は税込/税抜を併記・天候/イベント/祝日） |
| 日次仕入入力 | /daily-input/purchases | カテゴリ別チェックリスト方式の仕入入力 |
| 売上目標 | /targets | 店舗×日別の売上予算（カレンダー入力） |
| 月次PL（損益） | /pl | 店舗×月の損益計算書（売上・原価・粗利・販管費・営業利益）。販管費は科目追加／計算式科目／全月一括入力 |
| 期間集計 | /period-summary | 期間指定の全店/グループ横断集計（円換算合計） |
| **日別売上** | **/daily-summary** | **店舗×月の日別一覧（税抜/税込/客数/客単価）＋推移グラフ（売上=棒・客数=折れ線）** |
| 仕入先別 仕入集計 | /purchase-summary | 期間内の仕入先別集計 |
| データ閲覧 | /data | 入力済み日次データ（部門別売上等）の確認 |
| プロフィール | /profile | 自分の情報・パスワード変更 |

選択店舗は Cookie（`selected_store`）で保持され、画面を移動しても維持される（アクセス可能店舗の範囲内）。

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
| **初期設定（Excel一括投入ハブ）** | **/admin/initial-setup** | **manage_initial_setup** |

「初期設定」は、仕入先・仕入カテゴリ／売上予算／過去の売上の Excel 一括投入を集約。各対象で「テンプレDL → 記入 → アップロード取込（プレビュー＋行番号エラー）」を行える（追加/更新のみ・削除なし）。

### 5.5 マニュアル

設定マニュアル（/manuals/setup）／運用マニュアル（/manuals/operations）。各ページ右上から PDF 出力（印刷→PDF保存）可能。ダッシュボード下部にも導線。

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
| user_store_assignments | ユーザー×店舗の所属（経営層・経理は空＝全店・profiles削除で CASCADE） |
| purchase_categories | 仕入カテゴリ（店舗別） |
| suppliers | 仕入先（店舗別・1カテゴリ紐付き・原価区分 cost_type=cogs/sga） |
| sales_departments | 部門マスタ（店舗別・参考データ用） |
| role_permissions | ロール×能力の許可設定（has_capability が参照） |

### 6.2 取引系

| テーブル | 用途 |
|---|---|
| daily_sales | 日次売上（全店 day_period='all' 運用・UNIQUE で UPSERT・is_closed 店休／**is_holiday 祝日＋holiday_name 祝日名**） |
| daily_purchases | 日次仕入（1日1仕入先1行・同日重複は上書き） |
| daily_targets | 日別売上目標（月単位カレンダー入力・曜日変動反映） |
| daily_department_sales | 日次部門別売上（参考データ・税込のみ・経営計算には不使用） |
| inventory_estimates | 概算棚卸スナップショット（店舗×日付・スパース記録） |
| monthly_business_days | 月次営業日数（店舗×月・手入力・月次予測に使用） |
| monthly_expenses | 月次販管費（店舗×月×科目・自由名・区分タグ labor/rent/depreciation/other・全月一括入力対応） |
| expense_formulas | 変動費の計算式科目（店舗×科目・全月共通・金額は保存せず都度計算） |

### 6.3 運用・連携系

| テーブル | 用途 |
|---|---|
| system_settings | システム設定（KV型） |
| audit_logs | 監査ログ（機微な管理操作の追記専用履歴・閲覧は audit_log 能力） |
| api_keys | REST API キー（平文非保存・sha256ハッシュ・scope read/read_write・失効=is_active=false） |

### 6.4 設計の4レイヤー方針

経営データ（取引系）と参考データ（部門別売上等）を**物理的に分離**。参考データは損益・予算比に流入しない。`is_holiday`/`holiday_name`（祝日）は集計・税計算には不使用の付帯属性。

---

## 7. 業務ルール（計算ロジック）

正典：データモデル設計書 v1.11 §8（計算ロジック仕様）。

### 7.1 売上の税計算（net 主入力）

- **税抜売上（net_sales）が主入力**。予算・業績指標の基準。
- **サービス料** ＝ 税抜売上 × 店舗のサービス料率（`stores.service_fee_rate`・店舗ごと）。
- **税額** ＝ 課税ベース × 国の税率（`countries.tax_rate`・国ごと）。
  - 課税ベース（`countries.tax_base`）：タイ・インドネシアとも `net_plus_service`（税抜＋サービス料）。
  - 税率：タイ 7%（VAT）／インドネシア 10%（PB1）。
- **税込売上（gross_sales）は独立入力**（税抜から自動算出しない）。
- **客単価**：税込（gross÷客数）と税抜（net÷客数）の両方を表示（保存はしない・参考）。
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
  - **例外（物理削除許可）**：
    1. `monthly_expenses`（手入力販管費科目）・`expense_formulas`（計算式科目）の誤追加整理。
    2. **ユーザー（profiles＋認証アカウント）の完全削除**（ユーザー管理画面・誤招待や不要アカウントの整理用・自分は削除不可・監査ログ記録・2026-06-12 承認）。
  - 上記以外は物理削除禁止（無効化 or UPSERT 上書きのみ）。

### 7.5 月次予測

売上/原価の月次予測 ＝ 累計 ÷ 経過営業日数 × 当月営業日数（`monthly_business_days` を使用）。

### 7.6 変動費の計算式（expense_formulas）

4タイプ：`percent`（売上比）／`tiered`（段階）／`fixed`（定額）／`fixed_plus_percent`（定額＋売上比）。net_sales から都度計算（金額は保存しない）。

### 7.7 販管費の全月一括入力（手入力科目）

固定費（給与・家賃等）を当年度の全月へ同額で一括 UPSERT（`monthly_expenses`）。入力後も各月セルを個別に上書き編集でき、途中月の変動に対応する。PL 計算は従来どおり月別値を読むため不変。

---

## 8. 外部連携・自動処理

### 8.1 Slack 日報

毎朝 JST 9:00（Vercel Cron `0 0 * * *` → `/api/reports/daily`）、前日の店舗別売上サマリを Slack Incoming Webhook へ配信。Webhook URL はシステム設定（または環境変数）で設定。

### 8.2 為替レート自動取得

毎月1日 JST 9:00（Vercel Cron `0 0 1 * *` → `/api/exchange-rates/sync`）、前月末の対JPYレートを取得・反映（§7.2）。

### 8.3 REST API（v1）

外部AI/ツール連携用。APIキー（Bearer）認証。エンドポイント：`/api/v1/stores`・`/api/v1/period-summary`・`/api/v1/daily-sales`（GET/POST）・`/api/v1/daily-purchases`。書き込みは read_write スコープ必須、税額はサーバ側で再計算、API経由の書き込みは監査ログに記録。詳細は `docs/api_v1.md`、補助として MCP サーバ（`mcp/`）を提供。

### 8.4 cron の認証

`CRON_SECRET` を設定している場合は `Authorization: Bearer <CRON_SECRET>` を要求（未設定でも動作）。

---

## 9. セキュリティ

- **認証**：Supabase Auth（メール＋パスワード、TOTP有効化可）。`middleware.ts` で未認証を /login へ誘導（API ルートはハンドラ内で認証）。
- **認可**：全テーブルに RLS。`has_capability` ベースで能力単位に制御。書き込みは強い能力を要求。
- **監査ログ**：機微な管理操作（設定変更・権限変更・ユーザー操作/削除・APIキー・初期設定の取込・為替自動同期等）を `audit_logs` に追記専用で記録（`actor_email` 保全のためユーザー削除後も追跡可）。閲覧は audit_log 能力。
- **APIキー**：平文を保存せず sha256 ハッシュのみ。発行時のみ平文表示（`sc_` プレフィックス）。失効は `is_active=false`。書き込みスコープ付与は要注意。レート制限・有効期限は未実装（残課題）。
- **自己ロックアウト防止**：自分のロール変更・自分の無効化・自分の削除を禁止。経営層の exec_master 無効化をトリガーで禁止。
- **秘密情報**：`SUPABASE_SERVICE_ROLE_KEY` 等は `NEXT_PUBLIC_` を付けずサーバ専用。本番の環境変数は Vercel 側で管理。`.env.local` はバージョン管理外。

---

## 10. 運用・デプロイ

### 10.1 デプロイ構成（本番公開済み）

- フロント：**Vercel（Pro）。GitHub `urgesix-creator/sales-console` の `main` に接続し、push で約1〜2分で本番自動デプロイ**。本番URL：`https://sales-console-rho.vercel.app`（Node 24）。
- 障害時：Vercel の **Instant Rollback** で直前デプロイへ即時復旧。
- バックエンド：Supabase（Tokyo リージョン）。マイグレーションは `supabase/migrations/*.sql`（現在 036 まで適用）。
- 定時処理：`vercel.json` の crons（有効：日報・為替自動取得の2本／いずれも1日1回・無料プラン制約に適合）。

### 10.2 環境変数（本番＝Vercel 管理）

| 変数 | 用途 | 機微 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase プロジェクトURL | 公開可 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 匿名キー（ブラウザ用） | 公開可 |
| SUPABASE_SERVICE_ROLE_KEY | サービスロール（サーバ用） | **機微** |
| NEXT_PUBLIC_SITE_URL | メールリンク先（再設定・招待）＝本番URL | 公開可 |
| SLACK_WEBHOOK_URL | Slack 日報配信先（任意・未投入可・DB保存も可） | 機微 |
| CRON_SECRET | cron 保護（任意・推奨・未投入可） | 機微 |

ローカルの `.env.local` は開発用（`NEXT_PUBLIC_SITE_URL` は localhost のままでよい）。

### 10.3 タイムゾーン

業績日付は店舗ローカル日付（`business_date DATE`）で保存。集計・cron は JST（UTC+9）基準で算出。

### 10.4 依存・更新ルール

フレームワーク本体（Next.js・React 等）のメジャーアップデートは明示承認なしに実行しない。依存は安全な範囲（patch/minor）のみ、メジャーは報告して停止。

---

## 11. 非機能要件

- **レスポンシブ**：主要画面（ダッシュボード・期間集計・日次入力・月次PL・日別売上等）は PC で表、スマホでカード/縦並びに切替。PC表示は従来どおり維持。
- **国際化**：多言語対応の設計基盤あり（`docs/I18N_ARCHITECTURE_v1.0.md`）。
- **可読性**：見出し＝SF Pro Display／数字＝JetBrains Mono（桁揃え）／日本語フォールバック。
- **パフォーマンス**：Server Components 中心。集計は期間集計ロジックを共通化して再利用。保存系の一部は楽観的更新で体感を改善（例：販管費科目の並び替え）。

---

## 12. 既知の制約・今後の課題

- **未実装（設計のみ）の自動処理3種**：日次入力リマインダー（`/api/reminders/daily-input`）、棚卸リマインダー（`/api/reminders/inventory`）、アラート（`/api/alerts/check`）。現状 cron からは外している。
- **npm audit 残件**：いずれも安全な修正版が無い／メジャー更新を要するもの（dev専用の eslint 系、next 内蔵 postcss の moderate、exceljs/uuid の実害なし等）。詳細は依存・脆弱性メモを参照。
- **APIキー**：レート制限・有効期限・IP制限は未実装。read_write キーは「全店の売上閲覧＋日次売上の書き込み」が可能なため秘密情報として厳重管理。
- **実データ検証**：本番データ投入後に税計算・PL・円換算の数値突合を継続。
- 詳細な残課題は要件定義書 v2.9 §9 を参照。

---

## 13. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-06 | 初版。実装（本番DB23テーブル・実コード）と最新設計書（要件 v2.9／データモデル v1.11／画面 v1.2）を統合。 |
| v1.1 | 2026-06 | 現行実装を反映：本番公開（Vercel Pro・GitHub自動デプロイ・`sales-console-rho.vercel.app`）、Next.js 16系へ更新（cookies/searchParams の async 対応）、xlsx 撤去（exceljsのみ）、能力 manage_initial_setup 追加（計11種）、画面「日別売上」「初期設定（Excel一括投入）」追加、daily_sales に祝日列（is_holiday/holiday_name）追加（036）、販管費の全月一括入力、選択店舗のCookie保持、天気選択肢の拡充、税抜客単価の併記、ユーザー完全削除（物理削除の例外に追加）、デプロイ/環境変数/依存更新ルールを更新。 |

---

*© KOGA Holdings — 海外飲食店 売上管理システム（Sales Console）。本書は仕様変更に追従して更新されます。*
