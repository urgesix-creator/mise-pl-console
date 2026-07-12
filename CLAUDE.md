# CLAUDE.md

このファイルは Claude Code がこのプロジェクトを実装する際のマスター指示書です。

## プロジェクト概要

**KOGAホールディングス海外飲食店 売上管理システム（Sales Console）**

タイ・インドネシアの飲食店3店舗の日次オペレーションを統合管理するWebアプリケーション。現場入力→本部リアルタイム把握→月次PL自動化を実現する。

**開発体制**: 比嘉俊一（KOGAホールディングス専務取締役・COO/CFO）が単独でClaude Codeと協働して実装。

## 重要な前提

以下の文書は事前に確定済み。実装中に矛盾を感じたら**必ず比嘉専務に確認**してから進めること。

| 文書 | バージョン | 場所 |
|---|---|---|
| 要件定義書 | v2.2 | `/docs/requirements_v2.2.md` |
| データモデル設計書 | v1.5 | `/docs/data_model_v1.5.md` |
| 画面設計書 | v1.0 | `/docs/screen_design_v1.0.md` |
| 実装計画書 | v1.0 | `/docs/IMPLEMENTATION_PLAN_v1.0.md` |
| UI参考artifact | 15画面分 | `/reference-artifacts/*.jsx` |

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 14 App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| アイコン | lucide-react |
| チャート | recharts |
| バックエンド | Supabase (PostgreSQL + Auth + Storage) |
| デプロイ | Vercel (frontend) + Supabase (backend) |
| Excel処理 | SheetJS (xlsx) |
| 日付処理 | date-fns |

## ディレクトリ構造

```
app/
├── (auth)/              # 認証不要画面
│   ├── login/
│   ├── reset-password/
│   └── change-password/
├── (app)/               # 認証必須画面
│   ├── layout.tsx       # 共通レイアウト（ヘッダー・ナビ）
│   ├── dashboard/
│   ├── input/           # 日次入力
│   ├── targets/
│   ├── data/
│   ├── masters/
│   ├── admin/
│   └── profile/
└── api/
    ├── reports/
    ├── exports/
    └── imports/
```

## コーディング規約

### TypeScript

- `any` の使用禁止。`unknown` を使うか、適切に型定義する
- DBから取得する値は `Database['public']['Tables']['...']['Row']` 型を使用
- 関数の引数・戻り値は明示的に型注釈
- 列挙型は文字列リテラル型で定義（`type Role = 'executive' | 'staff' | ...`）

### React

- Server Components をデフォルト、必要な場合のみ `'use client'`
- フォームは Server Actions を優先
- `useState` の最小化、URL state（searchParams）を活用
- コンポーネントは `components/features/` または `components/shared/` に配置

### Tailwind / UI

- 参考artifact（`/reference-artifacts/`）の見た目を**忠実に再現**
- フォント: Bricolage Grotesque（見出し）+ Manrope（本文）+ JetBrains Mono（数字）+ Noto Sans JP
- カラー: 白背景 + slate-900テキスト + 達成度色分け（緑・黒・朱）
- shadcn/ui のコンポーネントを基盤に、必要に応じて拡張

### 達成率の色分け（システム全体共通ルール）

```typescript
// utils/achievement.ts
export function getAchievementColor(pct: number): 'success' | 'neutral' | 'warning' {
  if (pct >= 100) return 'success';   // 緑（emerald）
  if (pct >= 95) return 'neutral';    // 黒（slate-900）
  return 'warning';                   // 朱色（rose）
}
```

このルールは**すべての達成率表示で必ず適用**すること（要件定義書 v2.1 6.0節）。

## 重要な実装ルール

### 1. 月末レート方式（為替）

`exchange_rates` は通貨ペアごとに1値のみ保持。**当月の全データは現在のレートで換算**される。レート更新時は過去データも遡って再計算される（要件定義書 v2.2 6.4節）。

```typescript
// JPY換算
const jpyAmount = originalAmount * exchangeRate.rate;
// effective_date は計算に使用しない（メタ情報のみ）
```

### 2. Excel取込は常に上書き方式

UPSERT を使用。マッチする既存レコードは上書き、なければ追加。

```sql
INSERT INTO daily_sales (store_id, business_date, day_period, gross_sales, ...)
VALUES (...)
ON CONFLICT (store_id, business_date, day_period)
DO UPDATE SET
  gross_sales = EXCLUDED.gross_sales,
  ...
  updated_at = NOW();
```

UNIQUE制約（マッチング条件）：
- `daily_sales`: (store_id, business_date, day_period)
- `daily_purchases`: (store_id, business_date, supplier_id)
- `daily_expenses`: (store_id, business_date, expense_account_id)
- `daily_targets`: (store_id, target_date)

### 3. 削除ではなく無効化（ソフト削除）

退職者・廃止店舗・廃止科目等は**削除せず `is_active = FALSE` で対応**。過去データの整合性を保護。

> **【例外・2026-06-07／2026-06-08 追記】月次PL の販管費科目の削除に限り、物理削除（DELETE）を許可する。対象は次の2テーブルのみ。**
> 1. **`monthly_expenses`（手入力の販管費科目）**：「店舗×月×科目（自由入力名）」の月次値。`is_active` 列を持たず誤追加科目を整理する手段が無いため、科目行の削除では当該科目（`store_id × year_month × account_name`・当年度分）を物理 DELETE する。
> 2. **`expense_formulas`（変動費の計算式科目・018）**：「店舗×科目（自由入力名）」で全月共通。`is_active` 列を持たず誤追加の式を整理する手段が無いため、科目の削除では当該行（`store_id × account_name`）を物理 DELETE する。
> **【例外・2026-06-12 追記】ユーザー（profiles＋auth アカウント）の完全削除を許可する（比嘉専務承認・どのユーザーも対象）。**
> ユーザー管理画面の「削除」は、誤った招待や不要アカウントの整理のため、`profiles` 行（→`user_store_assignments` は CASCADE で連動削除）と認証アカウントを**物理 DELETE** する。基本は従来どおり「無効化（`is_active=false`）」で記録を残すが、削除も選べる。**自分自身は削除不可**（ロックアウト防止）。削除操作は監査ログ（`audit_logs`・`actor_email` で保全）に記録し、取引データはユーザーを参照しないため帳簿は壊れない。
>
> **上記の例外（monthly_expenses／expense_formulas／users）以外では従来どおり物理削除を禁止**（無効化＝ソフト削除、または UPSERT 上書きのみ）。

### 4. 売上の税計算

> **【2026-05-30 改訂】税計算を新制度（net 主入力）に修正。**
> 旧サンプル（`grossSales` から逆算する `calculateTaxAndService`）は数式が破綻していた（内訳合計が総売上に一致しない）うえ、旧制度のままだった。**新制度では `net_sales`（税抜）が主入力**で、サービス料・税額をそこから算出する。
> **正典は `docs/data_model_v1.7.md` §8.1（売上計算）・§8.1.1（桁違い警告）。** 関連：要件定義書 v2.4 §4.2.1、画面設計書 v1.1 §6.3。本コードと正典が食い違う場合は正典を優先し、比嘉専務に確認すること。

**基準（v1.7/v2.4/v1.1 と整合）：**

- `net_sales`（税抜）が**主入力**。予算・業績指標の基準。
- `gross_sales`（税込）・ランチ売上・ディナー売上は**独立入力**（`net_sales` から自動算出しない、連動しない）。
- `service_fee` / `tax_amount` / `avg_per_customer` は**自動計算**。

```typescript
// 課税ベース（countries.tax_base）
//   タイ        : 'net_plus_service' → (税抜売上 + サービス料) に課税（税率7%）
//   インドネシア: 'net_plus_service' → (税抜売上 + サービス料) に課税（税率10%）
// ※両国とも課税ベースは同一（net_sales + service_fee）。税率のみ異なる。
// サービス料率（stores.service_fee_rate）は店舗ごと、税率（countries.tax_rate）は国ごと。

// net_sales（税抜）を主入力として、サービス料・税額を自動計算する
function calcServiceAndTax(netSales: number, country: Country, store: Store) {
  // サービス料 = 税抜売上 × 店舗のサービス料率
  const serviceFee = netSales * store.service_fee_rate;

  // 税額 = 課税ベースに応じて算出
  const taxBaseAmount =
    country.tax_base === 'net_plus_service'
      ? netSales + serviceFee // タイ・インドネシア：税抜 + サービス料
      : netSales;             // net_sales のみ課税（日本・台湾等の将来用）
  const taxAmount = taxBaseAmount * country.tax_rate;

  return { serviceFee, taxAmount };
}

// 客単価 = 総売上（税込・独立入力）÷ 客数（分子は gross_sales）
function calcAvgPerCustomer(grossSales: number, customerCount: number): number | null {
  if (customerCount <= 0) return null;
  return grossSales / customerCount;
}

// 整合性チェックは「桁違い警告」のみ（保存はブロックしない）
// gross_sales は net_sales と独立入力のため、厳密一致（税抜+税=税込）は検証しない
function grossNetDigitWarning(grossSales: number, netSales: number): boolean {
  if (netSales <= 0) return false; // 税抜が0/未入力なら判定しない
  const ratio = grossSales / netSales;
  return ratio > 2.0 || ratio < 0.5; // true = 桁違いの可能性を警告（保存は許容）
}
```

**検算例（数式の正しさを確認）：**

```
■ タイ（tax_base='net_plus_service'、料率10%、VAT7%）
  net_sales = 100,000（主入力）
  serviceFee = 100,000 × 0.10            = 10,000
  taxAmount  = (100,000 + 10,000) × 0.07 =  7,700
  （参考）典型的な gross 入力値 = 100,000 + 10,000 + 7,700 = 117,700

■ インドネシア（tax_base='net_plus_service'、料率10%、PB1 10%）
  net_sales = 100,000（主入力）
  serviceFee = 100,000 × 0.10            = 10,000
  taxAmount  = (100,000 + 10,000) × 0.10 = 11,000
  （参考）典型的な gross 入力値 = 100,000 + 10,000 + 11,000 = 121,000

■ 客単価（タイ例、gross=117,000・客数50）
  avg_per_customer = 117,000 ÷ 50 = 2,340

■ 桁違い警告
  正常: gross=117,000 / net=100,000 → ratio=1.17 → 警告なし
  誤入力: gross=1,170,000 / net=100,000 → ratio=11.7 → 警告（保存は可能）
```

【注意】`gross_sales` は独立入力のため、`serviceFee`/`taxAmount` から逆算しない。上記「参考 gross」は典型値であり、実際の `gross_sales` 入力値と一致する必要はない（桁違い警告のみで許容）。

実装の細部に疑義があれば**必ず比嘉専務に確認**すること（正典 = data_model_v1.7 §8.1・§8.1.1）。

### 5. RLS（Row Level Security）

すべてのDBアクセスはSupabaseクライアント経由で実行され、RLSが自動適用される。`002_rls_policies.sql` を参照。

ヘルパー関数：
- `auth.user_role()` - ロール取得
- `auth.user_country()` - 所属国
- `auth.can_access_store(store_id)` - 店舗アクセス可否
- `auth.is_executive()` - 経営層判定

## Phase別の実装手順

### Phase A: 基盤構築（最初）

1. Supabase プロジェクト作成（Region: Tokyo）
2. SQL Editor で `001_initial_schema.sql` → `002_rls_policies.sql` → `003_seed_data.sql` 順実行
3. Auth設定：Email有効化、TOTP有効化
4. Next.js プロジェクト初期化
5. `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` 実装
6. ログイン画面実装（参考: `login_screen.jsx`）
7. (app) レイアウト + ヘッダー + ナビ実装
8. 簡易ダッシュボード実装（後でフル機能化）

### Phase B以降

実装計画書 v1.0 を参照。各フェーズで参考artifactを忠実に再現。

## 確認が必要な事項

実装中、以下の事項に遭遇したら**必ず比嘉専務に確認**：

- [ ] 店舗の正式名称（「あお季タイ」「AOKI ロバタ」「博多天神ジャカルタ」）
- [ ] 各店舗の仕入先完全リスト
- [ ] 各店舗の販管費科目完全リスト
- [ ] 初期ユーザーのメールアドレス・ロール
- [ ] Slack Webhook URL
- [ ] 期首棚卸の初期値
- [ ] データ移行範囲（過去何ヶ月）
- [ ] 税計算式の検算用サンプル

## トーンと進め方

- **結論先出し、根拠は後**：比嘉専務の好み
- **お世辞・忖度なし**：率直な指摘・提案を歓迎
- **不確実な情報は明示**：【憶測】【要確認】タグを使用
- **段階的に進める**：1つの機能を完成させてから次へ
- **Git commit は機能単位**：「日次入力画面の売上セクション実装」等

## デプロイ／本番運用ルール

> **【2026-06-12 改訂】本番公開済み。GitHub-Vercel の自動デプロイが稼働中。以下が現行ルール（旧「自動デプロイ未連携・push は記録のみ」の記述は全廃）。**
> 本番URL：**https://sales-console-rho.vercel.app**（Vercel）。GitHub `urgesix-creator/sales-console` の `main` ブランチを Vercel に接続。Vercel プランは **Pro**（商用利用の規約対応・メンバーは比嘉専務1名のみ。スタッフは Vercel に追加しない方針）。

### push ＝ 本番自動反映

`git push origin main` すると、**Vercel が約1〜2分で本番（https://sales-console-rho.vercel.app）へ自動デプロイ**する。
**「push は GitHub への記録のみ・本番影響なし」という旧運用は廃止。push は本番反映を意味する。**

```bash
# ローカル開発サーバ起動（http://localhost:3000）
npm run dev
```

### push 後の確認（作業の締めの定型）

push 後 **2〜3分待ち**、次のコマンドで本番の HTTP 応答（200 または 3xx）を確認して報告する：

```bash
curl -s -o /dev/null -w "%{http_code}" https://sales-console-rho.vercel.app
```

### 障害時の復旧

不具合が出たら、Vercel の **Instant Rollback** で直前の正常デプロイへ即時復旧する（ブラウザ操作・比嘉専務が実施）。

### 環境変数の管理

- **本番＝Vercel 側で管理**（Production / Preview に設定）。ローカルの `.env.local` は**開発用**で、`NEXT_PUBLIC_SITE_URL` は localhost のままでよい。
- 本番で必須：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`（機微）
  - `NEXT_PUBLIC_SITE_URL` ＝ **`https://sales-console-rho.vercel.app`**（パスワード再設定・招待メールのリンク先）
- 任意（現状未投入）：`SLACK_WEBHOOK_URL`（Slack日報を本番で使う段で追加。`system_settings` 保存でも可）／`CRON_SECRET`（cron保護・推奨）。

### 依存パッケージ・フレームワークの更新ルール

- **Next.js・React 等フレームワーク本体のメジャーアップデートは、いかなる理由でも明示承認なしに実行しない。**
- 依存パッケージは従来どおり**安全な範囲（patch / minor）のみ**適用。メジャーが必要な場合は**報告して停止**し、承認を得てから実施する。

### Vercel Cron（本番稼働中）

`vercel.json` の crons が本番で稼働：

```json
{
  "crons": [
    { "path": "/api/reports/daily", "schedule": "0 0 * * *" },
    { "path": "/api/exchange-rates/sync", "schedule": "0 0 1 * *" }
  ]
}
```

JSTで朝9時 = UTC 0:00（日報＝毎日／為替自動取得＝毎月1日）。Slack日報は `SLACK_WEBHOOK_URL` 設定後に有効。

## トラブルシューティング

### よくあるエラー

1. **RLSでデータが取れない** → `auth.uid()` が null。ログイン状態を確認
2. **UPSERTが効かない** → UNIQUE制約を確認（schema SQL参照）
3. **タイムゾーン問題** → 必ず `business_date DATE` で店舗ローカル日付を保存

## 参考実装：日次入力画面の構造

参考artifact `daily_input_screen_v3.jsx` を**忠実に再現**：

1. ヒーローカード：達成率を大きく表示（色分けルール厳守）
2. 5セクション：基本情報・売上・仕入・販管費・概算棚卸
3. 仕入：「一括チェックリスト方式」（カテゴリ別グループ、空欄=仕入なし）
4. Sticky保存バー：常にアクセス可能
5. リアルタイム計算：税抜・サービス料・税額の自動計算

## 連絡先

実装中に質問・課題があれば、まず比嘉専務に直接相談。Claude Code は提案するが、**重要な判断は必ず比嘉専務が下す**。
