# メール招待 設定マニュアル v1.0（SMTP・Supabase）

対象：Sales Console の「ユーザー管理 → メール招待」を実際に使えるようにするための設定手順。
作成：実装担当（Claude Code）／宛先：比嘉専務

---

## 0. このマニュアルの位置づけ

アプリ側の実装（招待アクション・パスワード設定画面の再利用）は**完了済み**です。
ただし **Supabase が実際に招待メールを送るには、メール送信サーバ（SMTP）の設定が必要**です。
本書はその「SMTPプロバイダの選定」と「具体的な設定手順」をまとめたものです。

> 補足：SMTP を設定しない間は、招待を「**仮パスワード方式**」で運用できます（メール不要・画面に仮パスワードを表示し本人へ手動連絡）。急がない場合はこの方式で先に運用開始できます。

設定が必要なものは次の3つです。本書はこの順で説明します。

1. **SMTPプロバイダ**（メール送信サービス）の契約とドメイン認証
2. **Supabase の Custom SMTP 設定**＋**リダイレクトURL許可**＋**招待メール文面**
3. **アプリの環境変数** `NEXT_PUBLIC_SITE_URL` の設定

---

## 1. SMTPプロバイダの選定

### 1.1 なぜ必要か
Supabase には開発用の内蔵メール送信がありますが、**1時間に数通**などの厳しい送信制限があり、
**本番・実運用には使えません**（公式にもテスト用と明記）。そのため外部のSMTPサービスを使います。

### 1.2 候補の比較（少人数・低頻度の社内招待向け）

本システムの用途は「社員を時々招待する」程度の**低頻度・少量**です。その前提での比較です。

| プロバイダ | 無料枠の目安 | 設定の手軽さ | 向き | 備考 |
|---|---|---|---|---|
| **Resend（推奨）** | 月3,000通・日100通 | ★★★（最も簡単） | 少量〜中量・開発者向け | Supabase公式の推奨例。SMTPもAPIキー1つで完結 |
| Amazon SES | 月62,000通（EC2経由）等 | ★（AWS知識が必要） | 大量・最安 | サンドボックス解除申請が必要。低頻度には過剰 |
| SendGrid | 日100通 | ★★ | 定番 | アカウント審査がやや厳しめ |
| Brevo（旧Sendinblue） | 日300通 | ★★ | 少量 | 無料枠大きめ |
| Postmark | テスト100通/月（以降有料） | ★★ | 到達率重視 | トランザクション特化・有料前提 |

### 1.3 推奨

- **基本は Resend を推奨**します。理由：設定が最も簡単（APIキー1つ）、無料枠が用途に十分、Supabase との相性が良い。
- すでに **AWS を業務で使っている**場合は **Amazon SES** でも可（最安だが設定はやや手間）。
- どれを選んでも、**「独自ドメインの認証（SPF/DKIM）」**を行うと迷惑メール判定されにくくなります（強く推奨）。

> 本書は **Resend を例**に手順を書きます。他社でも「SMTPのホスト/ポート/ユーザー名/パスワード」を取得する点は同じです。

---

## 2. 設定手順

### ステップA：SMTPプロバイダ側（Resend の例）

1. https://resend.com にサインアップ（GitHub/メールで可）。
2. **Domains → Add Domain** で送信に使う独自ドメインを追加（例：`koga-hd.com`）。
   - 表示される **DNSレコード（SPF / DKIM / 必要なら DMARC）** を、ドメインのDNS管理画面に登録。
   - 反映後、Resend上でドメインが **Verified** になることを確認（数分〜最大48時間）。
   - ※ ドメインが用意できない場合、テスト用に `onboarding@resend.dev` を送信元にできますが、**本番は独自ドメイン必須**。
3. **API Keys → Create API Key** で APIキーを発行し、**安全に控える**（再表示不可）。
4. SMTP接続情報（Resend固定）：
   - **Host**：`smtp.resend.com`
   - **Port**：`465`（SSL）または `587`（STARTTLS）
   - **Username**：`resend`
   - **Password**：**発行したAPIキー**
   - **送信元（From）**：認証したドメインのアドレス（例：`no-reply@koga-hd.com`）

> 他社の場合も、各社ダッシュボードで「SMTP credentials（Host/Port/User/Pass）」と「認証済み送信元アドレス」を取得してください。

---

### ステップB：Supabase の Custom SMTP 設定

1. Supabase ダッシュボード → 対象プロジェクト（`sales-console`）を開く。
2. 左メニュー **Authentication → Emails（または Settings 内の SMTP Settings）**。
   - 画面名はUI更新で変わることがあります。「**Custom SMTP**」「**SMTP Settings**」を探してください。
3. **Enable Custom SMTP** をオンにし、次を入力（Resendの例）：
   - **Sender email**：`no-reply@koga-hd.com`（ステップAの送信元）
   - **Sender name**：`KOGA Sales Console`
   - **Host**：`smtp.resend.com`
   - **Port**：`465`
   - **Username**：`resend`
   - **Password**：ResendのAPIキー
4. 保存。

> ヒント：**Minimum interval between emails**（送信間隔）の項目があれば、招待が弾かれないよう小さめ（既定のまま可）でOK。

---

### ステップC：リダイレクトURL（許可リスト）と Site URL

招待メールのリンクは、認証後に**アプリのパスワード設定画面**へ戻します。その戻り先を許可します。

1. Supabase → **Authentication → URL Configuration**。
2. **Site URL** に、アプリの基本URLを設定：
   - ローカル確認時：`http://localhost:3000`
   - 本番運用時：実際の本番URL（例：`https://sales-console.example.com`）
3. **Redirect URLs（許可リスト）** に、次を**追加**：
   - `http://localhost:3000/change-password`（ローカル）
   - 本番URL + `/change-password`（本番）
   - ワイルドカード可なら `http://localhost:3000/**` でも可（厳密に書くなら上記2つ）。
4. 保存。

> 仕組み：アプリは招待時に `redirectTo = <NEXT_PUBLIC_SITE_URL>/change-password?type=invite` を渡します。
> ここで許可していないURLには戻せないため、**必ず許可リストへ登録**してください。

---

### ステップD：アプリの環境変数 `NEXT_PUBLIC_SITE_URL`

アプリが招待リンクの戻り先を組み立てるために使います（**未設定だと Supabase の Site URL にフォールバック**しますが、明示推奨）。

- **ローカル**：プロジェクト直下の `.env.local` に追記
  ```
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```
  追記後、`npm run dev` を再起動。
- **本番（Vercel等）**：プロジェクトの環境変数に `NEXT_PUBLIC_SITE_URL=<本番URL>` を追加して再デプロイ。

> 補足：この変数は既存の「パスワードを忘れた（リセット）」メールのリンクでも使われます。設定するとリセット導線も正しくなります。

---

### ステップE：招待メールの文面（任意・推奨）

1. Supabase → **Authentication → Emails → Templates**。
2. **「Invite user」テンプレート**を選び、日本語に整える。
   - 本文中の **`{{ .ConfirmationURL }}`** が「パスワード設定リンク」です。**消さないでください**。
   - 例（本文）：
     ```
     KOGA Sales Console へ招待されました。
     下のリンクからパスワードを設定してログインしてください。

     {{ .ConfirmationURL }}

     ※ このリンクの有効期限は一定時間です。期限切れの場合は管理者にご連絡ください。
     ```
3. 件名例：`KOGA Sales Console への招待`。
4. 保存。

---

### ステップF：テスト（重要）

1. アプリ `/admin/users` →「ユーザーを招待」→ **メール招待**を選択。
2. 自分が受信できるテスト用アドレスで招待を送信。
3. 受信したメールのリンクを開く → `/change-password` に遷移 → 新パスワードを設定。
4. 設定したパスワードで `/login` からログインできることを確認。
5. `/admin/users` の一覧で、そのユーザーの状態を確認（受諾後 `accepted_at` が記録されます）。

---

## 3. うまくいかない時（トラブルシューティング）

| 症状 | 主な原因 | 対処 |
|---|---|---|
| メールが届かない | SMTP未設定／送信元ドメイン未認証 | ステップA・Bを再確認。Resend側のログ（Emails）で送信可否を確認 |
| 迷惑メールに入る | SPF/DKIM未設定 | ドメインのDNSにSPF/DKIMを登録し Verified にする |
| リンクで「redirect not allowed」 | 許可リスト未登録 | ステップCで `/change-password` を許可リストに追加 |
| リンクが期限切れ | トークン有効期限超過 | 「パスワード再発行」または再招待 |
| 「送信に失敗しました」表示 | SMTP認証エラー | ユーザー名 `resend`・パスワード（APIキー）を再確認 |
| 内蔵メールの制限に当たる | Custom SMTP未有効 | ステップBで Enable Custom SMTP をオンに |
| リンクを開いてもログイン状態にならない | 認証フローの戻り方 | まず既存の「パスワードリセット」メールが正しく動くか確認。動かない場合は実装側で受け口（callback）の追加が必要なため担当（Claude Code）へ連絡 |

---

## 4. 設定しない場合の運用（フォールバック）

SMTPを整備しない間は、招待ダイアログで「**仮パスワード**」を選べば**メール不要**で運用できます。
- 画面に表示された仮パスワードを、管理者が本人へ安全な方法（口頭・社内チャット等）で連絡。
- 本人がログイン後、**プロフィール画面でパスワードを変更**。

---

## 5. チェックリスト（設定完了の確認）

- [ ] SMTPプロバイダ契約・**送信元ドメインが Verified**
- [ ] Supabase **Custom SMTP** を Enable・接続情報を入力
- [ ] Supabase **Site URL** 設定・**Redirect URLs** に `/change-password` を追加
- [ ] 環境変数 **`NEXT_PUBLIC_SITE_URL`** を設定（ローカル/本番）
- [ ] 招待メール**テンプレートを日本語化**（`{{ .ConfirmationURL }}` は保持）
- [ ] **テスト招待**でメール受信→パスワード設定→ログインを確認

---

（不明点や、AWS SES を選ぶ場合の手順が必要な場合は、担当＝Claude Code までご連絡ください。本書は v1.0。UI名称は各サービスの更新で変わることがあります。）
