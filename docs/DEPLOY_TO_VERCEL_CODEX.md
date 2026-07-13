# みせPL Vercel 本番デプロイ 仕様書（Codex 実行用）

版: v1.0 ／ 作成: 2026-07-13 ／ 対象リポジトリ: `~/mise-pl-console`（GitHub: `urgesix-creator/mise-pl-console`, Private）

---

## 0. 目的（結論）

このリポジトリ（Next.js 製の店舗PL/売上管理アプリ「みせPL」）を **Vercel に本番デプロイ**し、**`git push origin main` で自動デプロイ**される状態にする。デプロイ後、公開URLの `/login` が HTTP 200 を返し、テストアカウントでログインできることを確認する。

**Codex への指示：** 下記「4. 手順」を上から実行せよ。**手順A（ダッシュボード）と手順B（CLI）のどちらか一方**でよい。CLI が使える環境なら手順Bを推奨。ただし後述のとおり、Private リポジトリの GitHub 連携許可だけはブラウザでの人手操作が必要になる場合がある。

---

## 1. 前提・現状（すでに完了していること）

- アプリは **日本化・消費税(標準10%/軽減8%)対応・E2E検証済み**で、`main` ブランチに反映済み。`npm run build` は成功する。
- ローカルでは `npm run dev` で起動確認済み（`http://localhost:3001`。ポート3000は別プロセス使用中）。
- バックエンドは **Supabase**（プロジェクト ref `qhflisrhbegxnbzsswie` / 東京リージョン）。スキーマ・シード投入済み。
- ローカルの `~/mise-pl-console/.env.local`（gitignore 済み）に開発用の接続情報が入っている（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` はプレースホルダ, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`）。
- Vercel アカウント: チーム名 **「TOSHIKAZU 's projects」**（GitHub 連携済み想定）。

---

## 2. 触ってはいけないもの（最重要ガードレール）

- ❌ `~/sales-console`（別プロジェクト=KOGA本番）とその Supabase（ref `cytubnofrcbmlnbfidsy`）・その Vercel（`sales-console-rho`）には**一切触れない・接続しない**。
- ❌ **秘密鍵（`SUPABASE_SERVICE_ROLE_KEY`）をリポジトリにコミットしない**。`.env.local` は gitignore 済み。Vercel の環境変数か Supabase ダッシュボードでのみ扱う。
- ✅ 変更は `mise-pl-console` プロジェクトに限定する。デプロイ先の Vercel プロジェクト名は `mise-pl-console`。

---

## 3. 設定する環境変数（4つ・Production と Preview の両方に設定）

| Name | Value | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qhflisrhbegxnbzsswie.supabase.co` | 公開可 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 下記の長い JWT（§3.1） | 公開可（ブラウザで使用） |
| `SUPABASE_SERVICE_ROLE_KEY` | **【ドキュメントに書かない】** Supabaseダッシュボードから取得（§3.2） | 機微・秘密 |
| `NEXT_PUBLIC_SITE_URL` | 暫定 `https://mise-pl-console.vercel.app`（本番URL確定後に実URLへ更新） | 招待/パスワード再設定メールのリンク先 |

### 3.1 anon キー（そのまま使用）
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZmxpc3JoYmVneG5ienNzd2llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjU5MzgsImV4cCI6MjA5OTQ0MTkzOH0.aImPm-8bJj2sTIBXJs5_jB0W5VFpHBWej8DytgzMtOs
```

### 3.2 service_role キーの取得
Supabase ダッシュボード → プロジェクト `mise-pl-console` → **Settings → API Keys**（または「API」）→ `service_role`（`secret`）を Reveal してコピー。**このドキュメントやコードには書かず**、Vercel の環境変数入力欄に直接貼る。

---

## 4. 手順

### 手順A：Vercel ダッシュボードでインポート（確実・GitHub自動デプロイになる）

1. https://vercel.com/new を開く（チーム「TOSHIKAZU 's projects」を選択）。
2. **Import Git Repository** の一覧から `urgesix-creator/mise-pl-console` を選ぶ。
   - 出てこなければ **「Adjust GitHub App Permissions」** → GitHub 側で `mise-pl-console` への Vercel アプリのアクセスを許可 → Vercel に戻る。**この GitHub アプリ許可はアカウント所有者のブラウザ操作が必須**（自動化不可）。
3. **Import** → 設定画面で **Framework=Next.js（自動）／Root=`./`**。
4. **Environment Variables** に §3 の4つを追加（Production/Preview 両方）。
5. **Deploy** を押す。1〜3分でビルド。**日本化・検証済みのため成功する想定**。
6. 本番URL（例 `https://mise-pl-console.vercel.app`）を確認。§3の `NEXT_PUBLIC_SITE_URL` が実URLと異なれば **Settings → Environment Variables** で修正し **Redeploy**。

### 手順B：Vercel CLI（Codex 向け・自動化寄り）

前提: Node.js 20+。`~/mise-pl-console` 直下で実行。

```bash
cd ~/mise-pl-console

# 1) ログイン（ブラウザ認証。人手が要る）
npx vercel@latest login

# 2) プロジェクトをリンク/作成（scope=TOSHIKAZU 's projects, project name=mise-pl-console）
npx vercel@latest link

# 3) 環境変数を Production と Preview に登録（値は stdin で渡す）
printf '%s' "https://qhflisrhbegxnbzsswie.supabase.co" | npx vercel@latest env add NEXT_PUBLIC_SUPABASE_URL production
printf '%s' "https://qhflisrhbegxnbzsswie.supabase.co" | npx vercel@latest env add NEXT_PUBLIC_SUPABASE_URL preview
# anon キー（§3.1 の値）
printf '%s' "<§3.1のanonキー>" | npx vercel@latest env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
printf '%s' "<§3.1のanonキー>" | npx vercel@latest env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
# service_role（§3.2 でダッシュボードからコピーした値。履歴に残さないよう注意）
printf '%s' "<service_role秘密鍵>" | npx vercel@latest env add SUPABASE_SERVICE_ROLE_KEY production
printf '%s' "<service_role秘密鍵>" | npx vercel@latest env add SUPABASE_SERVICE_ROLE_KEY preview
# SITE_URL（暫定。本番URL確定後に更新）
printf '%s' "https://mise-pl-console.vercel.app" | npx vercel@latest env add NEXT_PUBLIC_SITE_URL production

# 4) 本番デプロイ
npx vercel@latest --prod

# 5) GitHub と接続（push→自動デプロイにする）。Private リポジトリは Vercel GitHub アプリの許可が必要（ブラウザ）
npx vercel@latest git connect
```

> 注: `git connect` が権限不足で失敗する場合は、手順A（ダッシュボード）で GitHub アプリのアクセスを許可してから再実行する。CLI 単独では Private リポジトリの許可まで完結しないことがある（GitHub 側の認可はブラウザ操作）。

---

## 5. デプロイ後の検証（必須）

```bash
# 本番URL（<PROD_URL> は確定した実URL）
curl -s -o /dev/null -w "login=%{http_code}\n" https://<PROD_URL>/login   # 期待: 200
curl -s -o /dev/null -w "root=%{http_code}\n"  https://<PROD_URL>/        # 期待: 307（/login へ）
```

ブラウザでの動作確認（テストアカウント）:
- URL: `https://<PROD_URL>/login`
- ログイン: `demo@mise-pl.local` / `DemoPass123!`（Supabase に作成済みの executive ユーザー）
- 確認: ログイン→「みせPL デモ店」で日次売上入力→**税区分 10%/8%** を選ぶ→消費税・税込が自動計算→保存→`/pl` に反映。
  - 検算: 税抜10,000＋標準10% → 消費税1,000・税込11,000／軽減8% → 800・10,800。

Vercel のビルドが赤（Failed）なら、Vercel ダッシュボードの **Deployments → 該当 → Build Logs** を読み、原因（多くは環境変数未設定 or Node バージョン）を特定して修正 → Redeploy。

---

## 6. 完了条件（Definition of Done）

- [ ] Vercel プロジェクト `mise-pl-console` が作成され、Production デプロイが成功（緑）。
- [ ] `https://<PROD_URL>/login` が 200。
- [ ] テストアカウントでログインでき、消費税10%/8%が上記検算どおり動く。
- [ ] `git push origin main` で自動デプロイが走る（GitHub 連携済み）。
- [ ] `NEXT_PUBLIC_SITE_URL` が実際の本番URLに一致。

---

## 7. 付録：本番前の任意タスク（今回のスコープ外・後日でよい）

- 実ロゴ画像の用意（現状はテキストロゴ）。
- デモ用テストユーザー `demo@mise-pl.local` と「みせPL デモ店」を、実顧客提供前に整理/削除。
- `~/mise-pl-console/CLAUDE.md` が旧 KOGA（海外・タイ/インドネシア税制）前提の記述のまま（開発ドキュメントのみ・ユーザー非表示）。みせPL 用に書き換え推奨。
- 既知の限界: 1日の中で 10% と 8% が混在する店舗は、現状の「日次1レコード＝単一税区分」では表現不可。将来、部門別（`sales_departments`/`daily_department_sales`）に税区分を持たせる拡張で対応可能。

---

## 8. 参考（このリポジトリ内の関連ドキュメント）

- `docs/FORK_PLAN_JP.md` … 国内化フォークの全体計画・設計判断（消費税モデル含む）。
- `supabase/migrations/041_jp_consumption_tax.sql` … 消費税(税区分/has_takeout)のDDL。
- 税計算の正典: `app/(app)/daily-input/sales/_schemas.ts`（`calculateSales`）＋ サーバ権威計算 `app/(app)/daily-input/sales/actions.ts`。
