# 実装チェックリスト v1.0

Claude Code が実装を進める際の進捗管理用チェックリスト。完了したらチェックを入れていく。

---

## Phase A: 基盤構築

### A.1 環境セットアップ

- [ ] Supabase プロジェクト作成（Region: Tokyo）
- [ ] Supabase Auth 設定（Email + TOTP）
- [ ] `001_initial_schema.sql` 実行
- [ ] `002_rls_policies.sql` 実行
- [ ] `003_seed_data.sql` 実行
- [ ] Next.js プロジェクト初期化
- [ ] 依存パッケージインストール
- [ ] shadcn/ui セットアップ
- [ ] Vercel プロジェクト作成・リンク
- [ ] 環境変数設定（.env.local + Vercel）

### A.2 共通基盤

- [ ] `lib/supabase/client.ts` 実装
- [ ] `lib/supabase/server.ts` 実装
- [ ] `lib/business.ts` 配置（達成率計算・税計算等）
- [ ] `lib/utils.ts` 実装（cn() 等）
- [ ] `types/database.ts` 配置
- [ ] `middleware.ts` 実装（認証チェック）
- [ ] `app/layout.tsx` ルートレイアウト
- [ ] `app/globals.css` フォント・基本スタイル
- [ ] `tailwind.config.ts` 設定
- [ ] エラー境界・404・loading.tsx 等の共通画面

### A.3 認証画面

- [ ] `app/(auth)/login/page.tsx` （参考: login_screen.jsx）
- [ ] `app/(auth)/reset-password/page.tsx` （参考: password_reset_request_screen.jsx）
- [ ] `app/(auth)/change-password/page.tsx` （参考: password_change_screen.jsx）
- [ ] Server Actions: signIn, signOut, requestPasswordReset, changePassword
- [ ] 「この端末を信頼する」機能（30日Cookie）
- [ ] 2FA TOTP フロー

### A.4 共通レイアウト

- [ ] `app/(app)/layout.tsx` ヘッダー＋ナビ＋認証チェック
- [ ] ヘッダーコンポーネント（ロゴ・ナビ・通知ベル・アバター）
- [ ] サイドナビ（モバイル時はドロワー）
- [ ] トースト通知システム
- [ ] ロール別ナビ表示制御

---

## Phase B: マスタ管理画面

### B.1 店舗マスタ

- [ ] `app/(app)/masters/stores/page.tsx`（参考: store_master_screen.jsx）
- [ ] 店舗一覧カード（ステータス・パラメータ表示）
- [ ] 4セクション編集モーダル
- [ ] 国マスタとの連動（税制自動表示）
- [ ] 取引履歴チェック→削除制限ロジック
- [ ] Server Actions: createStore, updateStore, toggleActive, deleteStore

### B.2 仕入カテゴリマスタ

- [ ] `app/(app)/masters/categories/page.tsx`（参考: category_master_screen.jsx）
- [ ] 店舗別カテゴリ一覧
- [ ] 並び順変更（drag/arrows）
- [ ] 仕入先紐付きチェック→削除制限
- [ ] Server Actions

### B.3 仕入先マスタ

- [ ] `app/(app)/masters/suppliers/page.tsx`（参考: supplier_master_screen.jsx）
- [ ] カテゴリ連動（同店舗のカテゴリのみ表示）
- [ ] 取引履歴チェック→削除制限
- [ ] Server Actions

### B.4 販管費科目マスタ

- [ ] `app/(app)/masters/expense-accounts/page.tsx`（参考: expense_account_master_screen.jsx）
- [ ] 上位分類8種類でグループ化表示
- [ ] 店舗別の科目名カスタマイズ
- [ ] Server Actions

### B.5 為替レート

- [ ] `app/(app)/masters/exchange-rates/page.tsx`（参考: exchange_rates_screen.jsx）
- [ ] 通貨ペアカード（大きなレート表示）
- [ ] 月末レート方式の警告バナー
- [ ] 30日超で「要更新」アラート
- [ ] Server Actions

---

## Phase C: 業務画面

### C.1 日次入力（最重要）

- [ ] `app/(app)/input/page.tsx`（参考: daily_input_screen_v3.jsx）
- [ ] ヒーローカード（達成率・色分けルール厳守）
- [ ] 5セクション（基本情報・売上・仕入・販管費・概算棚卸）
- [ ] 売上の自動計算（税抜・サービス料・税額）
- [ ] **税計算式の検算**（比嘉専務とサンプル数値で検証）
- [ ] 仕入の一括チェックリスト UI
- [ ] 仕入先カテゴリ別グループ化
- [ ] 既存データの読み込み（編集モード）
- [ ] Sticky 保存バー
- [ ] 昼夜分離店対応（ジャカルタ）
- [ ] 天気・イベント欄（店舗設定で表示制御）
- [ ] Server Actions: upsertDailySales, upsertDailyPurchases, upsertDailyExpenses

### C.2 売上目標カレンダー

- [ ] `app/(app)/targets/page.tsx`（参考: targets_calendar_screen.jsx）
- [ ] 7×5 カレンダーグリッド
- [ ] セル直接入力
- [ ] 一括設定機能（平日/土日/全日）
- [ ] 前月コピー
- [ ] 月切替ナビゲーション
- [ ] 4つの統計カード
- [ ] Excel取込/出力ボタン（後でG実装）
- [ ] Server Actions: upsertDailyTargets

---

## Phase D: 閲覧・集計

### D.1 ダッシュボード

- [ ] `app/(app)/dashboard/page.tsx`（参考: dashboard_screen.jsx）
- [ ] グリーティング（時間帯別）
- [ ] ヒーローカード（全店合計・JPY換算）
- [ ] 店舗別カード（recharts スパークライン）
- [ ] アクティビティフィード
- [ ] 注意事項パネル（未入力アラート等）
- [ ] ロール別表示の切替（経営層 vs 店長 vs 現場社員）

### D.2 データ閲覧

- [ ] `app/(app)/data/page.tsx`（参考: data_browse_screen.jsx）
- [ ] 3タブ（売上・仕入・販管費）
- [ ] フィルタ（店舗・期間・検索）
- [ ] ソート可能テーブル
- [ ] ページネーション
- [ ] 編集モーダル
- [ ] Excel出力（Phase G）

---

## Phase E: 管理機能

### E.1 ユーザー管理

- [ ] `app/(app)/admin/users/page.tsx`（参考: user_management_screen.jsx）
- [ ] ユーザー一覧（5ロール視覚区別）
- [ ] 招待モーダル（4セクション）
- [ ] 招待メール送信（Supabase Auth）
- [ ] 編集モーダル
- [ ] 無効化・再有効化
- [ ] 2FA リセット（管理者操作）
- [ ] 招待再送

### E.2 システム設定

- [ ] `app/(app)/admin/settings/page.tsx`（参考: system_settings_screen.jsx）
- [ ] 6セクション（日報・アラート・リマインダー・認証・Slack・表示）
- [ ] Sticky 保存バー（dirty検知）
- [ ] Slack webhook テスト送信
- [ ] デフォルトリセット機能
- [ ] 経営層のみアクセス制限

### E.3 プロフィール

- [ ] `app/(app)/profile/page.tsx`（参考: profile_screen.jsx）
- [ ] ヒーローカード（アバター・ロール・ログイン履歴）
- [ ] 表示名変更
- [ ] パスワード変更（強度メーター）
- [ ] 2FA セットアップフロー（QRコード）
- [ ] アクティブセッション管理
- [ ] ログアウト

---

## Phase F: 通知・スケジューラ

### F.1 Slack 連携

- [ ] `lib/slack.ts` Webhook 送信ユーティリティ
- [ ] 日報メッセージフォーマット
- [ ] アラートメッセージフォーマット
- [ ] リマインダーメッセージフォーマット
- [ ] エラーハンドリング（Slack側エラー時のリトライ）

### F.2 スケジューラ（Vercel Cron）

- [ ] `app/api/reports/daily/route.ts` 日報配信（朝9時）
- [ ] `app/api/reminders/daily-input/route.ts` 入力リマインダー
- [ ] `app/api/reminders/inventory/route.ts` 月末棚卸リマインダー
- [ ] `app/api/alerts/check/route.ts` アラートチェック（毎時）

---

## Phase G: Excel 連携

### G.1 Excel 出力（6種）

- [ ] `app/api/exports/daily-data/route.ts` 日次データ
- [ ] `app/api/exports/monthly-pl/route.ts` 月次PL
- [ ] `app/api/exports/supplier-summary/route.ts` 仕入先別サマリ
- [ ] `app/api/exports/master-data/route.ts` マスタデータ
- [ ] `app/api/exports/all-data/route.ts` 全データ
- [ ] `app/api/exports/daily-targets/route.ts` 日別売上目標

### G.2 Excel 取込（2種）

- [ ] `app/api/imports/daily-data/route.ts` 日次データ取込（UPSERT）
- [ ] `app/api/imports/daily-targets/route.ts` 日別売上目標取込（UPSERT）
- [ ] プレビュー機能（取込前に変更内容を確認）
- [ ] エラー詳細表示

---

## Phase H: 統合テスト・本番投入

### H.1 テスト

- [ ] 各画面の手動テスト（経営層・店長・現場社員でログイン）
- [ ] RLS 動作確認（権限外のデータが見えない）
- [ ] 税計算の検算（比嘉専務に確認）
- [ ] Excel 取込/出力の往復テスト
- [ ] Slack 配信テスト（チャンネルで実際に確認）
- [ ] パフォーマンステスト（数百件のデータで動作確認）

### H.2 データ移行

- [ ] 既存Excelからのデータ抽出スクリプト作成
- [ ] マスタデータ移行（仕入先・販管費科目）
- [ ] 過去データ移行（直近3ヶ月程度）
- [ ] 期首棚卸の入力
- [ ] 比嘉専務によるレビュー

### H.3 本番投入

- [ ] 本番Supabase環境構築
- [ ] 本番Vercel環境構築
- [ ] 環境変数の本番設定
- [ ] 本番ドメイン設定（カスタムドメイン）
- [ ] 1店舗（日乃出食品 or あお季タイ）で先行運用
- [ ] フィードバック収集・修正
- [ ] 全店ロールアウト
- [ ] ユーザー研修・運用ガイド配布

---

## Phase 2（将来）

- [ ] 月次PL自動生成画面
- [ ] カスタムアラート閾値UI
- [ ] AIによる売上予測
- [ ] 経費精算サブシステム統合
- [ ] モバイルアプリ（PWA → React Native）
- [ ] 多言語対応（タイ語・インドネシア語）
