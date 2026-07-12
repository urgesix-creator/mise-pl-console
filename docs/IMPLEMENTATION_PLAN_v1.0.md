# KOGAホールディングス海外飲食店 売上管理システム 実装計画書 v1.0

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Sales Console |
| 作成日 | 2026年5月10日 |
| 作成者 | 比嘉俊一（KOGAホールディングス株式会社 専務取締役） |
| 関連文書 | 要件定義書 v2.2、データモデル v1.5、画面設計書 v1.0 |

---

## 0. 実装方針（再確認）

| 項目 | 内容 |
|---|---|
| **開発体制** | 比嘉俊一（自社） × Claude Code（AIペア開発） |
| **環境** | macOS、ターミナル、VSCode、Claude Code CLI |
| **デプロイ先** | Vercel（フロントエンド）／Supabase（バックエンド） |
| **データベース** | Supabase PostgreSQL |
| **認証** | Supabase Auth（メール+PW、TOTP 2FA） |
| **CSS** | Tailwind CSS + shadcn/ui コンポーネント |
| **状態管理** | React Server Components + minimal client state |
| **デプロイ戦略** | mainブランチへのプッシュで自動デプロイ |

## 1. フェーズ分割

| フェーズ | 内容 | 推定工数 |
|---|---|---|
| **フェーズA** | 基盤構築（DB・認証・レイアウト） | 1〜2週 |
| **フェーズB** | マスタ管理画面（4種） | 1週 |
| **フェーズC** | 業務画面（日次入力・売上目標） | 1〜2週 |
| **フェーズD** | 閲覧・集計（データ閲覧・ダッシュボード） | 1週 |
| **フェーズE** | 管理機能（ユーザー・システム設定・為替） | 1週 |
| **フェーズF** | Slack連携・スケジューラ | 1週 |
| **フェーズG** | Excel取込/出力（6種出力・2種取込） | 1週 |
| **フェーズH** | 統合テスト・本番投入 | 1週 |

**累計：8〜10週間**（Claude Code支援前提）

## 2. フェーズA：基盤構築（最初に実装）

### 2.1 環境セットアップ

```bash
# プロジェクト作成
npx create-next-app@latest sales-console --typescript --tailwind --app
cd sales-console

# 依存パッケージ
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react recharts date-fns
npm install class-variance-authority clsx tailwind-merge
npm install -D @types/node

# shadcn/ui 初期化
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label dialog toast
```

### 2.2 Supabase プロジェクト作成

1. https://supabase.com で新規プロジェクト作成（Region: Tokyo）
2. SQL Editor で以下を順次実行：
   - `001_initial_schema.sql` - 15テーブル定義
   - `002_rls_policies.sql` - Row Level Security
   - `003_seed_data.sql` - 国・通貨・店舗マスタ
3. Authentication > Providers でEmail有効化、TOTP有効化
4. .env.local に接続情報を設定

### 2.3 ファイル構造

```
sales-console/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── change-password/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # 認証必須レイアウト
│   │   ├── dashboard/page.tsx
│   │   ├── input/page.tsx          # 日次入力
│   │   ├── targets/page.tsx        # 売上目標
│   │   ├── data/page.tsx           # データ閲覧
│   │   ├── masters/
│   │   │   ├── stores/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── suppliers/page.tsx
│   │   │   ├── expense-accounts/page.tsx
│   │   │   └── exchange-rates/page.tsx
│   │   ├── admin/
│   │   │   ├── users/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── profile/page.tsx
│   ├── api/
│   │   ├── reports/daily/route.ts  # 日報配信用
│   │   ├── exports/[type]/route.ts # Excel出力
│   │   └── imports/[type]/route.ts # Excel取込
│   ├── layout.tsx                  # ルートレイアウト
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn/ui
│   ├── shared/                     # 共通コンポーネント
│   └── features/                   # 機能別コンポーネント
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── auth.ts
│   ├── utils.ts
│   └── constants.ts
├── types/
│   └── database.ts
├── middleware.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 3. 実装の優先順位

### 必ず先に実装するもの（フェーズA）

1. ✅ Supabase接続設定
2. ✅ ログイン画面（メール+PW）
3. ✅ middleware.ts（認証チェック）
4. ✅ ヘッダー＋ナビゲーション共通レイアウト
5. ✅ ダッシュボード（最低限の表示）

### 次に実装（フェーズB）

6. 店舗マスタ画面（CRUD）
7. 仕入カテゴリマスタ
8. 仕入先マスタ
9. 販管費科目マスタ

### 業務の中核（フェーズC）

10. 日次入力画面（最も重要、入念にテスト）
11. 売上目標カレンダー

### 閲覧・分析（フェーズD）

12. データ閲覧画面
13. ダッシュボードの完全実装（チャート含む）

### 管理機能（フェーズE）

14. ユーザー管理
15. 為替レート
16. システム設定
17. プロフィール
18. パスワードリセット系2画面

### 自動化（フェーズF）

19. Slack Webhook連携
20. 日報配信スケジューラ（Vercel Cron）
21. アラート通知
22. リマインダー通知

### Excel連携（フェーズG）

23. Excel出力 6種（SheetJS）
24. Excel取込 2種（UPSERT実装）

### 仕上げ（フェーズH）

25. 統合テスト
26. 本番Supabase環境構築
27. データ移行（既存Excelからの移行）
28. ユーザー研修・運用ドキュメント
29. 本番投入

## 4. 確認が必要な情報（実装前）

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | 各店舗の正確な店舗名 | 比嘉専務の確認（あお季タイ・AOKIロバタの正式名称） |
| 2 | 各店舗の仕入先マスタ完全リスト | 既存Excelからの抽出 |
| 3 | 各店舗の販管費科目マスタ完全リスト | 既存Excelからの抽出 |
| 4 | 各ユーザーのメールアドレス | 比嘉専務 |
| 5 | Slack 経営会議グループのチャンネルID／Webhook URL | Slackワークスペース管理者 |
| 6 | 期首棚卸の実額（移行用） | 各店長 |
| 7 | 月初の為替レート | 三菱UFJ TTM |
| 8 | 過去データ移行の範囲（直近何ヶ月） | 比嘉専務の判断 |

## 5. リスクと対策

| リスク | 対策 |
|---|---|
| **店舗のオフライン入力**（通信障害） | フェーズBで決定。MVPは「通信障害時は入力不可・運用ガイド明示」で対応 |
| **多通貨換算の誤差** | 月末レート方式（要件定義 v2.2）で運用簡素化済み |
| **既存Excelからの移行データ不整合** | 移行スクリプトで検証→比嘉専務がレビュー後に投入 |
| **本番事故**（誤った大量更新等） | 段階的ロールアウト：日乃出食品→1店舗→2店舗→全店 |
| **Claude Code 支援の限界** | 要件・データモデル・画面設計が完成しているため、実装パターンは明確 |

## 6. ロールアウト計画

```
Week 1-2 ：開発環境構築 + Phase A 実装
Week 3-4 ：Phase B + C 実装、比嘉専務がプロトタイプで検証
Week 5-6 ：Phase D + E 実装、ステージング環境でテスト
Week 7   ：Phase F + G 実装、Slack連携の検証
Week 8   ：Phase H、データ移行、本番投入
Week 9   ：1店舗で先行運用、フィードバック収集
Week 10  ：全店ロールアウト
```

## 7. 成功指標（KPI）

| 指標 | 目標 |
|---|---|
| 日次入力完了率 | ≥ 95%（全店舗・全営業日） |
| 入力所要時間（1日分） | ≤ 5分 |
| 日報配信成功率 | ≥ 99% |
| 月次PL生成所要時間 | ≤ 30分（旧運用は2-3日） |
| ユーザー満足度（社内アンケート） | ≥ 4/5 |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 | 変更者 |
|---|---|---|---|
| 2026-05-10 | v1.0 | 実装計画書 初版作成。フェーズA〜Hの分割、ファイル構造、リスク・対策、ロールアウト計画を策定。 | 比嘉俊一 |
