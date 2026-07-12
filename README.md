# Sales Console - KOGAホールディングス海外飲食店 売上管理システム

タイ・インドネシアの飲食店3店舗の日次オペレーションを統合管理するWebアプリケーション。

## 開発フェーズ

| フェーズ | 期間 | 状態 |
|---|---|---|
| 言語化 | 2026年5月 | ✅ 完了 |
| データモデル設計 | 2026年5月 | ✅ 完了（v1.5） |
| 画面設計 | 2026年5月 | ✅ 完了（v1.0） |
| **実装着手** | **2026年5月10日〜** | **🔄 開始** |
| 統合テスト | TBD | - |
| 本番投入 | TBD | - |

## クイックスタート

### 1. 前提環境

- Node.js 20以上
- npm または pnpm
- Supabase アカウント
- Vercel アカウント（デプロイ用）

### 2. プロジェクト初期化

```bash
# Next.js プロジェクト作成
npx create-next-app@latest sales-console --typescript --tailwind --app --no-src-dir
cd sales-console

# 依存パッケージ追加
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react recharts date-fns xlsx zod
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label
npm install @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-switch
npm install @radix-ui/react-tabs @radix-ui/react-toast

# shadcn/ui 初期化
npx shadcn-ui@latest init
```

### 3. Supabase セットアップ

1. https://supabase.com で新規プロジェクト作成
   - Region: **Asia Pacific (Tokyo)**
   - Database password: 安全な値を設定

2. SQL Editor で順次実行：
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql`

3. Authentication > Providers
   - Email を Enabled
   - 「Confirm email」を ON
   - 「Multi-factor authentication」で TOTP を有効化

4. プロジェクト URL と anon key を取得

### 4. 環境変数設定

`.env.local` を作成：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY  # API Routes用、機微
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 5. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 で起動。

### 6. 初期ユーザー作成

Supabase ダッシュボード → Authentication → Users → "Add user" で：

- 比嘉俊一: higa@koga-hd.co.jp
- 古賀善敏: koga@koga-hd.co.jp

その後、`profiles` テーブルに以下を INSERT：

```sql
INSERT INTO profiles (id, display_name, email, role, country_id, is_active, has_2fa)
VALUES
  ('higaのauth.users.id', '比嘉 俊一', 'higa@koga-hd.co.jp', 'executive', 'jp', TRUE, FALSE),
  ('kogaのauth.users.id', '古賀 善敏', 'koga@koga-hd.co.jp', 'executive', 'jp', TRUE, FALSE);
```

## ファイル構造

```
sales-console/
├── app/
│   ├── (auth)/                  # 認証不要画面
│   │   ├── login/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── change-password/page.tsx
│   ├── (app)/                   # 認証必須画面
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── input/page.tsx       # 日次入力
│   │   ├── targets/page.tsx     # 売上目標
│   │   ├── data/page.tsx        # データ閲覧
│   │   ├── masters/             # マスタ管理
│   │   │   ├── stores/
│   │   │   ├── categories/
│   │   │   ├── suppliers/
│   │   │   ├── expense-accounts/
│   │   │   └── exchange-rates/
│   │   ├── admin/               # 管理機能（経営層のみ）
│   │   │   ├── users/
│   │   │   └── settings/
│   │   └── profile/page.tsx
│   ├── api/                     # API Routes
│   │   ├── reports/daily/       # 日報配信（Vercel Cron）
│   │   ├── exports/[type]/      # Excel出力
│   │   └── imports/[type]/      # Excel取込
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                      # shadcn/ui コンポーネント
│   ├── shared/                  # 共通コンポーネント
│   └── features/                # 機能別コンポーネント
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser用
│   │   └── server.ts            # Server用
│   ├── business.ts              # ビジネスロジック
│   ├── utils.ts
│   └── constants.ts
├── types/
│   └── database.ts              # Supabaseスキーマ型
├── supabase/
│   └── migrations/              # SQL マイグレーション
├── reference-artifacts/         # UI参考用（v1.0時点の15画面）
├── docs/                        # 設計文書
│   ├── requirements_v2.2.md
│   ├── data_model_v1.5.md
│   ├── screen_design_v1.0.md
│   └── IMPLEMENTATION_PLAN_v1.0.md
├── middleware.ts
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── CLAUDE.md                    # Claude Code 指示書
└── README.md                    # このファイル
```

## 開発フロー

### ブランチ戦略

```
main         # 本番（自動デプロイ）
└── develop  # 開発統合
    ├── feature/dashboard-implementation
    ├── feature/daily-input-screen
    └── feature/master-screens
```

### Claude Code との協働

`CLAUDE.md` に詳細な指示書を記載。Claude Code 起動時に自動読み込みされる。

開発フロー例：

```bash
# Claude Code 起動
claude-code

# プロンプト例
> 「日次入力画面を実装して。reference-artifacts/daily_input_screen_v3.jsx を忠実に再現すること」

# Claude Code が自動的に：
# 1. CLAUDE.md を読む
# 2. 参考artifactを読む
# 3. lib/business.ts の関数を活用
# 4. types/database.ts の型を使う
# 5. ファイルを作成・編集
```

## 重要な実装ルール（要約）

### システム全体共通

1. **達成率の色分け**：100%以上=緑 / 95%以上=黒 / 95%未満=朱（v2.1）
2. **月末レート方式**：1ペア1値、当月全データに統一適用（v2.2）
3. **Excel取込は常に上書き**：UPSERT、過去データに影響あり（v2.0）
4. **削除ではなく無効化**：is_active = FALSE で対応

### 認証

- メール+PW でログイン
- TOTP 2FA（経営層・各国代表は必須推奨）
- 「この端末を信頼する」で30日間スキップ可
- ログイン失敗は抽象メッセージ（情報漏洩防止）

### RLS

すべてのDBアクセスは Supabase クライアント経由で RLS が適用される。`002_rls_policies.sql` を参照。

## デプロイ

### Vercel

```bash
# Vercel CLI でリンク
vercel link

# 環境変数設定
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SLACK_WEBHOOK_URL

# 本番デプロイ
git push origin main  # 自動デプロイ
```

### Vercel Cron（日報配信）

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/reports/daily",
      "schedule": "0 0 * * *"
    }
  ]
}
```

JST朝9時 = UTC 0:00。Pro プラン必要。

## 参考資料

| 文書 | 用途 |
|---|---|
| `docs/requirements_v2.2.md` | 要件定義（最新） |
| `docs/data_model_v1.5.md` | データモデル設計 |
| `docs/screen_design_v1.0.md` | 画面設計 |
| `docs/IMPLEMENTATION_PLAN_v1.0.md` | 実装計画・フェーズ分割 |
| `CLAUDE.md` | Claude Code向け指示書 |
| `reference-artifacts/*.jsx` | UI参考実装（15画面） |

## 連絡先

- 比嘉俊一（KOGAホールディングス株式会社 専務取締役）
- 全実装判断は比嘉専務が行う

## ライセンス

Private - KOGA Holdings Co., Ltd.
