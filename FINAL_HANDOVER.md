# 🎯 Sales Console プロジェクト マスター引き継ぎ書

**KOGAホールディングス海外飲食店 売上管理システム**

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Sales Console |
| 作成日 | 2026年5月10日 |
| 作成者 | 比嘉俊一（KOGAホールディングス株式会社 専務取締役） |
| 設計支援 | Claude（Anthropic AI） |
| 実装支援予定 | Claude Code |

---

## 📑 このドキュメントの目的

設計フェーズで作成した**44ファイル**を一覧化し、Claude Code での実装着手に必要な情報をすべてここに集約する。**Day 1 から迷わず実装開始できる**ことを保証する。

---

## ✅ 完成した成果物一覧（44ファイル）

### A. 設計文書（5ファイル）

| # | ファイル | 内容 |
|---|---|---|
| A1 | `requirements_v2.3.md` | 要件定義書（最新）。多言語対応含む |
| A2 | `data_model_v1.6.md` | データモデル設計書（15テーブル） |
| A3 | `screen_design_v1.0.md` | 画面設計書 |
| A4 | `IMPLEMENTATION_PLAN_v1.0.md` | フェーズA〜H実装計画 |
| A5 | `I18N_ARCHITECTURE_v1.0.md` | 多言語対応アーキテクチャ |

### B. UI 参考 artifact（17ファイル）

| # | ファイル | 用途 |
|---|---|---|
| B1 | `login_screen.jsx` | ログイン |
| B2 | `password_reset_request_screen.jsx` | パスワードリセット要求 |
| B3 | `password_change_screen.jsx` | パスワード変更（リセット経由） |
| B4 | `dashboard_screen.jsx` | ダッシュボード |
| B5 | `daily_input_screen_v3.jsx` | **日次入力（最重要）** |
| B6 | `targets_calendar_screen.jsx` | 売上目標カレンダー |
| B7 | `data_browse_screen.jsx` | データ閲覧 |
| B8 | `store_master_screen.jsx` | 店舗マスタ |
| B9 | `category_master_screen.jsx` | 仕入カテゴリマスタ |
| B10 | `supplier_master_screen.jsx` | 仕入先マスタ |
| B11 | `expense_account_master_screen.jsx` | 販管費科目マスタ |
| B12 | `exchange_rates_screen.jsx` | 為替レート |
| B13 | `user_management_screen_v2.jsx` | **ユーザー管理（v2、招待時の言語選択）** |
| B14 | `system_settings_screen.jsx` | システム設定 |
| B15 | `profile_screen_v2.jsx` | **プロフィール（v2、言語切替）** |

### C. Supabase バックエンド（4ファイル）

| # | ファイル | 内容 |
|---|---|---|
| C1 | `001_initial_schema.sql` | 15テーブル定義 + ビュー + トリガー |
| C2 | `002_rls_policies.sql` | Row Level Security（5ロール対応） |
| C3 | `003_seed_data.sql` | 国・通貨・店舗・初期マスタ |
| C4 | `004_add_user_language.sql` | profiles.language カラム追加 |

### D. Next.js プロジェクト雛形（10ファイル）

| # | ファイル | 配置先 |
|---|---|---|
| D1 | `package.json` | プロジェクトルート |
| D2 | `tsconfig.json` | プロジェクトルート |
| D3 | `tailwind.config.ts` | プロジェクトルート |
| D4 | `vercel.json` | プロジェクトルート |
| D5 | `.env.example` | プロジェクトルート |
| D6 | `middleware.ts` | プロジェクトルート |
| D7 | `i18n.ts` | プロジェクトルート（next-intl エントリポイント） |
| D8 | `lib_supabase_client.ts` | `lib/supabase/client.ts` |
| D9 | `lib_supabase_server.ts` | `lib/supabase/server.ts` |
| D10 | `app_auth_actions.ts` | `app/(auth)/actions.ts` |

### E. コアライブラリ（5ファイル）

| # | ファイル | 配置先 | 役割 |
|---|---|---|---|
| E1 | `types_database.ts` | `types/database.ts` | DB スキーマ型 |
| E2 | `lib_business.ts` | `lib/business.ts` | 達成率・税計算・JPY換算 |
| E3 | `lib_i18n_locales.ts` | `lib/i18n/locales.ts` | ロケール定数 |
| E4 | `lib_i18n_format.ts` | `lib/i18n/format.ts` | ロケール対応フォーマッタ |
| E5 | `lib_email_templates.ts` | `lib/email/templates.ts` | メールテンプレート4言語 |
| E6 | `lib_slack_templates.ts` | `lib/slack/templates.ts` | Slack 配信テンプレート |

### F. 翻訳ファイル（4ファイル）

| # | ファイル | 配置先 |
|---|---|---|
| F1 | `messages_ja.json` | `messages/ja.json` |
| F2 | `messages_en.json` | `messages/en.json` |
| F3 | `messages_th.json` | `messages/th.json` |
| F4 | `messages_id.json` | `messages/id.json` |

### G. ドキュメント・指示書（4ファイル）

| # | ファイル | 用途 |
|---|---|---|
| G1 | `CLAUDE.md` | Claude Code への実装指示書 |
| G2 | `README.md` | プロジェクト全体ガイド |
| G3 | `IMPLEMENTATION_CHECKLIST.md` | 100項目超の進捗チェックリスト |
| G4 | `migrate-from-excel.ts` | 既存Excelデータ移行スクリプト |

---

## 🚀 Day 1 開始手順

このドキュメントに従って、以下の順番で作業すれば Day 1 で **「ログイン画面が動く状態」** まで到達可能。

### Step 1: アカウント作成（30分）

```bash
# Supabase
1. https://supabase.com で無料アカウント作成
2. 新規プロジェクト作成（Region: Asia Pacific (Tokyo)）
3. Database password を安全な場所に保存

# Vercel
1. https://vercel.com で GitHub 連携アカウント作成

# GitHub
1. プライベートリポジトリ「sales-console」作成
```

### Step 2: ローカル環境構築（30分）

```bash
# Node.js 確認
node --version  # 20以上

# Claude Code インストール
npm install -g @anthropic-ai/claude-code

# プロジェクトクローン
git clone https://github.com/YOUR_USER/sales-console.git
cd sales-console

# Next.js 初期化
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
# プロンプトで全部 Yes

# 依存パッケージ追加
npm install @supabase/supabase-js @supabase/ssr next-intl
npm install lucide-react recharts date-fns xlsx zod
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
```

### Step 3: 配信ファイルをローカルに配置（30分）

このプロジェクトで作成した44ファイルを所定の場所に配置：

```bash
# ドキュメント
mkdir -p docs
cp 受信した requirements_v2.3.md docs/
cp 受信した data_model_v1.6.md docs/
cp 受信した screen_design_v1.0.md docs/
cp 受信した IMPLEMENTATION_PLAN_v1.0.md docs/
cp 受信した I18N_ARCHITECTURE_v1.0.md docs/

# 参考artifact
mkdir -p reference-artifacts
cp 受信した *.jsx reference-artifacts/

# Supabase migrations
mkdir -p supabase/migrations
cp 受信した 001_initial_schema.sql supabase/migrations/
cp 受信した 002_rls_policies.sql supabase/migrations/
cp 受信した 003_seed_data.sql supabase/migrations/
cp 受信した 004_add_user_language.sql supabase/migrations/

# 翻訳JSON
mkdir -p messages
cp 受信した messages_ja.json messages/ja.json
cp 受信した messages_en.json messages/en.json
cp 受信した messages_th.json messages/th.json
cp 受信した messages_id.json messages/id.json

# Next.js コアファイル（プロジェクトルート）
cp 受信した package.json .  # 上書き
cp 受信した tsconfig.json .  # 上書き
cp 受信した tailwind.config.ts .  # 上書き
cp 受信した middleware.ts .
cp 受信した i18n.ts .
cp 受信した vercel.json .
cp 受信した .env.example .

# コアライブラリ
mkdir -p lib/supabase lib/i18n lib/email lib/slack types
cp 受信した lib_supabase_client.ts lib/supabase/client.ts
cp 受信した lib_supabase_server.ts lib/supabase/server.ts
cp 受信した lib_business.ts lib/business.ts
cp 受信した lib_i18n_locales.ts lib/i18n/locales.ts
cp 受信した lib_i18n_format.ts lib/i18n/format.ts
cp 受信した lib_email_templates.ts lib/email/templates.ts
cp 受信した lib_slack_templates.ts lib/slack/templates.ts
cp 受信した types_database.ts types/database.ts

# 移行スクリプト
mkdir -p scripts
cp 受信した migrate-from-excel.ts scripts/

# Claude Code 指示書
cp 受信した CLAUDE.md .
cp 受信した README.md .
cp 受信した IMPLEMENTATION_CHECKLIST.md .

# 依存追加
npm install
```

### Step 4: Supabase データベース構築（30分）

Supabase ダッシュボード → SQL Editor で以下を順次実行：

```
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_rls_policies.sql
3. supabase/migrations/003_seed_data.sql
4. supabase/migrations/004_add_user_language.sql
```

各実行時に `RAISE NOTICE` メッセージが表示されることを確認。

### Step 5: 環境変数設定（10分）

```bash
cp .env.example .env.local
```

`.env.local` を編集：
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

値は Supabase Dashboard → Settings → API から取得。

### Step 6: 初期ユーザー作成（10分）

Supabase ダッシュボード → Authentication → Users → "Add user" で：

```
email: higa@koga-hd.co.jp
password: （仮パスワード、後で変更）
```

その後、SQL Editor で：
```sql
INSERT INTO profiles (id, display_name, email, role, country_id, language, is_active, has_2fa)
VALUES (
  'auth.users から取得したUUID',
  '比嘉 俊一',
  'higa@koga-hd.co.jp',
  'executive',
  'jp',
  'ja',
  TRUE,
  FALSE
);
```

### Step 7: Claude Code 起動（実装開始！）

```bash
cd sales-console
claude-code
```

最初のプロンプト：

```
> プロジェクトルートの CLAUDE.md と README.md を読んで、現在のプロジェクトの状態を理解してください。
> その後、IMPLEMENTATION_PLAN_v1.0.md のフェーズA を実装してください。
> まず Phase A.2「共通基盤」から開始：
> - app/layout.tsx（ルートレイアウト）
> - app/globals.css（フォント・基本スタイル）
> - next.config.js を next-intl 用に調整
> 
> 既に lib/, types/, middleware.ts などは配置済みです。
> 完了したら一旦止めて、私が確認します。
```

**ここまでで約2〜3時間**。Day 1 で `npm run dev` を起動して、何かが画面に出るところまで進められます。

---

## 📋 確認すべき情報リスト（実装中に必要）

| # | 項目 | 確認元 | フェーズ |
|---|---|---|---|
| 1 | 店舗の正式名称（あお季タイ・AOKIロバタ・博多天神ジャカルタ） | 比嘉専務ご記憶 | A1 |
| 2 | 初期ユーザーのメール（比嘉・古賀・経理） | 比嘉専務 | A3 |
| 3 | 各店舗の仕入先完全リスト | 既存Excel | B3 |
| 4 | 各店舗の販管費科目完全リスト | 既存Excel | B4 |
| 5 | 税計算検算サンプル（タイ・インドネシア各1件） | 既存レシート | C1 |
| 6 | Slack Webhook URL | Slack管理者 | F1 |
| 7 | 期首棚卸の実額（移行用） | 各店長 | H |
| 8 | 月初の為替レート（三菱UFJ TTM） | 比嘉専務 | A1 |
| 9 | 過去データ移行範囲（直近何ヶ月） | 比嘉専務判断 | H |
| 10 | タイ語・インドネシア語翻訳のネイティブレビュー | 各国スタッフ | H |

---

## 🛡️ 重要なシステムルール（再確認）

実装中に必ず守るべき4つのルール：

### ① 達成率の色分け（v2.1）

```typescript
// すべての達成率表示で必ず適用
if (pct >= 100) → 緑（emerald）
else if (pct >= 95) → 黒（slate-900）
else → 朱色（rose）
```

参照: `lib/business.ts` の `getAchievementLevel()`

### ② 月末レート方式（v2.2）

```
exchange_rates は通貨ペアごとに1値のみ保持
→ 当月の全データを現在のレートで換算
→ レート更新時は過去データも遡って再計算
→ effective_date は計算に使用しない（メタ情報のみ）
```

### ③ Excel取込は常に上書き（v2.0）

```sql
INSERT INTO ... ON CONFLICT (...) DO UPDATE SET ...
```

UNIQUE制約が UPSERT のマッチングキー。

### ④ 削除ではなく無効化

```typescript
// ❌ DELETE FROM
// ✅ UPDATE ... SET is_active = FALSE
```

---

## ❓ よくある質問（FAQ）

### Q1. Claude Code が要件と違う実装をしたら？

reference-artifact を再度参照させる：

```
> 「app/(app)/input/page.tsx の現在の実装は reference-artifacts/daily_input_screen_v3.jsx と
>   見た目が違います。artifact の通りに修正してください。
>   特にヒーローカードの達成率表示と、仕入の一括チェックリスト UI が違います。」
```

### Q2. 税計算が合わない場合は？

1. 既存の月次PLから1件サンプル数値を取り出す
2. Claude Code に「以下の数値で `calculateTaxBreakdown` を実行して結果を表示」と依頼
3. 期待値と比較
4. 違いがあれば計算式を要件定義 v2.3 と照合・修正

### Q3. 多言語の翻訳に間違いがあったら？

`messages/{ja,en,th,id}.json` を直接編集して、関連キーを修正。
本番投入前に各国スタッフ（あお季タイ、博多天神ジャカルタ）にレビュー依頼を推奨。

### Q4. RLS でデータが取れない場合は？

Supabase SQL Editor で：

```sql
-- ログイン状態の確認
SELECT auth.uid();

-- ユーザーロールの確認
SELECT role, country_id FROM profiles WHERE id = auth.uid();

-- ポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'daily_sales';
```

### Q5. 実装中にこのチャットの内容を参照したい場合は？

このマスター引き継ぎ書の内容を Claude Code に渡せばOK：

```
> 「@FINAL_HANDOVER.md を読んで、このプロジェクトの全体像を理解してください」
```

---

## 📈 想定スケジュール

| Week | フェーズ | 主な成果物 |
|---|---|---|
| 1〜2 | A: 基盤構築 | ログイン・共通レイアウト・ダッシュボード（簡易） |
| 3 | B: マスタ画面 | 5マスタCRUD完成 |
| 4〜5 | C: 業務画面 | **日次入力完成（最重要）**・売上目標 |
| 6 | D: 閲覧・集計 | データ閲覧・ダッシュボード完全版 |
| 7 | E: 管理機能 | ユーザー管理・システム設定・プロフィール |
| 8 | F: 通知・スケジューラ | Slack配信・リマインダー |
| 9 | G: Excel連携 | 出力6種・取込2種 |
| 10 | H: 統合テスト・本番投入 | データ移行・1店舗先行運用 |
| 11〜12 | ロールアウト | 全店展開・ユーザー研修 |

**合計：8〜12週間**（比嘉専務リソース：1日2〜3時間）

---

## 🎓 想定される学習・成長

このプロジェクトを通じて比嘉専務が獲得できるもの：

| カテゴリ | 内容 |
|---|---|
| **技術** | Next.js / TypeScript / Supabase / Tailwind の実践理解 |
| **AIペアプロ** | Claude Code との協働ノウハウ（KOGAグループの他案件にも応用可能） |
| **IT資産** | 自社管理可能なWebアプリ。外注依存からの脱却 |
| **業務フロー** | 海外店舗オペレーションの構造化・標準化 |
| **データ駆動経営** | リアルタイムKPI監視・月次PL自動生成 |

---

## 🌟 今後の拡張余地（Phase 2 以降）

このシステムは、以下の拡張が容易な設計：

| 拡張 | 内容 |
|---|---|
| **店舗追加** | 新店舗（ベトナム・台湾等）のレコード追加で対応 |
| **言語追加** | 中国語繁体字（台湾法人）・ベトナム語等 |
| **マスタ多言語化** | 仕入先名・科目名等の多言語名称管理 |
| **AI予測** | 売上予測・在庫最適化（Claude API連携） |
| **モバイル化** | PWA化、将来的に React Native アプリ |
| **経費精算統合** | 既存の経費精算ワークフロー（GAS）との統合 |
| **会計ソフト連携** | 弥生会計等への自動エクスポート |

---

## 💡 比嘉専務へのメッセージ

このプロジェクトは、KOGAホールディングスの**海外事業拡大の基盤インフラ**となります。

- M&A先・新規海外店舗の追加が容易
- 各国の現地スタッフが母国語で操作可能
- 経営層がリアルタイムで全店舗の状況把握
- 月次PL作成時間を **2〜3日 → 30分**に短縮

設計フェーズで作成した44ファイルが、Claude Code との協働実装で **8〜10週間後**には動くシステムとなります。

**戦略型事業家としてのスタイル**（短期で MVP を立ち上げ、運用しながら改善）に最も合うアプローチです。M&A・海外案件と並行して進められる設計になっています。

---

## 📞 サポート

実装中にこのチャット（または新しい Claude チャット）で：

1. 「Sales Console プロジェクトの実装を進めています」と伝える
2. このマスター引き継ぎ書を共有
3. 具体的な質問や状況を伝える

→ Claude が文脈を即座に把握し、サポート可能。

---

**Let's build this. 🚀**

— 設計フェーズ完了。実装フェーズへ。
