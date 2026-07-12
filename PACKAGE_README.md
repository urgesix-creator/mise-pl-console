# 📦 Sales Console 実装パッケージ

KOGAホールディングス海外飲食店 売上管理システム（Sales Console）の実装パッケージです。

## このフォルダの中身

このZIPファイルには **49ファイル**が、Next.js プロジェクトとして**そのまま使える構造**で配置されています。

## 📖 まず最初に読むファイル

実装の進め方は **`FINAL_HANDOVER.md`** をお読みください。

Day 1 の手順、必要な準備、よくある質問などすべて書かれています。

---

## 📂 フォルダ構造

```
sales-console-package/
├── docs/                       ← 📚 設計文書（5ファイル）
│   ├── requirements_v2.3.md       要件定義書
│   ├── data_model_v1.6.md         データモデル設計書
│   ├── screen_design_v1.0.md      画面設計書
│   ├── IMPLEMENTATION_PLAN_v1.0.md 実装計画書
│   └── I18N_ARCHITECTURE_v1.0.md  多言語対応設計
│
├── reference-artifacts/        ← 🎨 画面の見本（15ファイル）
│   ├── login_screen.jsx           ログイン
│   ├── password_reset_request_screen.jsx
│   ├── password_change_screen.jsx
│   ├── dashboard_screen.jsx       ダッシュボード
│   ├── daily_input_screen_v3.jsx  日次入力（最重要）
│   ├── targets_calendar_screen.jsx 売上目標カレンダー
│   ├── data_browse_screen.jsx     データ閲覧
│   ├── store_master_screen.jsx    店舗マスタ
│   ├── category_master_screen.jsx 仕入カテゴリマスタ
│   ├── supplier_master_screen.jsx 仕入先マスタ
│   ├── expense_account_master_screen.jsx 販管費科目マスタ
│   ├── exchange_rates_screen.jsx  為替レート
│   ├── user_management_screen_v2.jsx ユーザー管理
│   ├── system_settings_screen.jsx システム設定
│   └── profile_screen_v2.jsx      プロフィール
│
├── supabase/migrations/        ← 🗄️ データベース定義（4ファイル）
│   ├── 001_initial_schema.sql     15テーブル定義
│   ├── 002_rls_policies.sql       Row Level Security
│   ├── 003_seed_data.sql          国・通貨・店舗の初期データ
│   └── 004_add_user_language.sql  言語カラム追加
│
├── messages/                   ← 🌐 翻訳ファイル（4言語）
│   ├── ja.json                    日本語
│   ├── en.json                    英語
│   ├── th.json                    タイ語
│   └── id.json                    インドネシア語
│
├── lib/                        ← 🔧 共通ライブラリ
│   ├── business.ts                達成率・税計算・JPY換算
│   ├── email/templates.ts         メールテンプレート4言語
│   ├── slack/templates.ts         Slack配信テンプレート
│   ├── i18n/locales.ts           ロケール定数
│   ├── i18n/format.ts            数値・日付フォーマット
│   └── supabase/                  Supabaseクライアント
│       ├── client.ts              ブラウザ用
│       └── server.ts              サーバー用
│
├── types/
│   └── database.ts                TypeScript型定義
│
├── app/(auth)/
│   └── actions.ts                 ログイン・PWリセット Server Actions
│
├── scripts/
│   └── migrate-from-excel.ts      既存Excelデータ移行スクリプト
│
├── package.json                ← Next.js 依存パッケージ
├── tsconfig.json               ← TypeScript 設定
├── tailwind.config.ts          ← Tailwind CSS 設定
├── middleware.ts               ← 認証ミドルウェア
├── i18n.ts                     ← 多言語対応エントリポイント
├── vercel.json                 ← Vercel Cron 設定
├── .env.example                ← 環境変数テンプレート
│
├── CLAUDE.md                   ← 🤖 Claude Code への指示書（重要）
├── README.md                   ← プロジェクト全体ガイド
├── IMPLEMENTATION_CHECKLIST.md ← 100項目超の進捗チェックリスト
├── FINAL_HANDOVER.md           ← ⭐ 最終引き継ぎ書（最初に読む）
└── PACKAGE_README.md           ← このファイル
```

---

## 🚀 実装開始までの手順（超簡単版）

### Step 1: ファイルを置く場所を準備
1. デスクトップに「**Sales Console**」フォルダを作る
2. このZIPを展開した中身（`sales-console-package/` の中身）を、その中に入れる
3. フォルダ名を `sales-console-package` から `sales-console` に変更

### Step 2: 必要なソフトをインストール
- **Node.js 20+**（https://nodejs.org/ja からダウンロード）
- **VSCode**（https://code.visualstudio.com/ からダウンロード）
- **Claude Code**（インストール後に `npm install -g @anthropic-ai/claude-code` 実行）

### Step 3: アカウント作成
- **GitHub**（https://github.com/）
- **Supabase**（https://supabase.com/）
- **Vercel**（https://vercel.com/）
- **Anthropic API**（https://console.anthropic.com/）

### Step 4: ターミナルで以下を実行

```bash
# プロジェクトフォルダに移動
cd ~/Desktop/Sales\ Console/sales-console

# Next.js のセットアップ補助ファイルを生成（既存ファイルは保護される）
npm install

# 動作確認
npm run dev
```

### Step 5: Supabase でSQLを実行

1. Supabase プロジェクト作成（Region: Tokyo）
2. SQL Editor で以下を順次実行：
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql`
   - `supabase/migrations/004_add_user_language.sql`

### Step 6: 環境変数の設定

```bash
cp .env.example .env.local
# .env.local を VSCode で開いて、Supabase の URL・keys を入力
```

### Step 7: Claude Code で実装開始！

```bash
claude
```

最初の指示：
```
プロジェクトルートの CLAUDE.md と FINAL_HANDOVER.md を読んでください。
その後、IMPLEMENTATION_PLAN_v1.0.md のフェーズA から順に実装してください。
```

---

## 📞 困ったとき

新しい Claude Chat で：

```
KOGAホールディングス専務の比嘉です。
Sales Console プロジェクトを実装中です。

[FINAL_HANDOVER.md の中身を貼り付け]

現在こういう状況で困っています：[状況説明]
```

→ 新しいClaudeが文脈を即理解してサポート可能。

---

## ✅ ファイル数チェック

このパッケージには **合計49ファイル**含まれています。

| カテゴリ | ファイル数 |
|---|---|
| 設計文書 | 5 |
| 画面参考 (.jsx) | 15 |
| Supabase SQL | 4 |
| 翻訳JSON | 4 |
| Next.js 設定 | 7 |
| コアライブラリ | 8 |
| TypeScript型 | 1 |
| Server Action | 1 |
| 移行スクリプト | 1 |
| ドキュメント | 4 (CLAUDE.md, README.md, IMPLEMENTATION_CHECKLIST.md, FINAL_HANDOVER.md) |
| パッケージREADME | 1 (このファイル) |
| **合計** | **49** + (PACKAGE_README.md) |

---

**Let's build this. 🚀**
