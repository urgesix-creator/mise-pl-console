# Sales Console REST API v1（外部AI/ツール連携）

外部のAI（Claude / Codex 等）・自作エージェント・スクリプトから、本システムのデータを
取得（および必要に応じて更新）するための REST API。

> このドキュメントは、連携相手（AIやエンジニア）に「APIキー」と一緒に渡せば、そのまま使えます。

---

## 1. ベースURL

```
<アプリのURL>/api/v1
```
ローカル：`http://localhost:3000/api/v1`／本番：デプロイ先URL + `/api/v1`

## 2. 認証（APIキー）

すべてのリクエストに HTTP ヘッダーでキーを付けます。

```
Authorization: Bearer <APIキー>
```

- キーは **管理 → APIキー（/admin/api-keys）** で経営層が発行します（平文は発行時に1回だけ表示）。
- 権限（scope）は2種類：
  - **read**（読み取り専用・推奨）
  - **read_write**（読み書き・強力／発行時にリスク同意が必要）
- 失効したキー・不正なキーは `401`、書き込みを読み取り専用キーで行うと `403` を返します。

## 3. エンドポイント

### GET /api/v1/stores — 店舗一覧（read）
```
curl -H "Authorization: Bearer $KEY" <BASE>/api/v1/stores
```
レスポンス：`{ "data": [ { id, store_no, name, country_id, currency_id, is_active, fiscal_year_start_month } ] }`

### GET /api/v1/period-summary?start=YYYY-MM-DD&end=YYYY-MM-DD — 店舗別 期間集計（read・税抜）
```
curl -H "Authorization: Bearer $KEY" \
  "<BASE>/api/v1/period-summary?start=2026-06-01&end=2026-06-30"
```
レスポンス：`{ period:{start,end}, data:[ { store_no, name, currency, net_sales, budget, budget_pct, cogs, gross_profit, gross_margin_pct, margin_profit, margin_pct, closing_inventory } ] }`
（売上・予算比・粗利・差益・棚卸額。画面の「期間集計」と同じ計算）

### GET /api/v1/daily-sales?store=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD — 日次売上（read）
```
curl -H "Authorization: Bearer $KEY" \
  "<BASE>/api/v1/daily-sales?store=<店舗UUID>&from=2026-06-01&to=2026-06-30"
```

### GET /api/v1/daily-purchases?store=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD — 日次仕入（read）
```
curl -H "Authorization: Bearer $KEY" \
  "<BASE>/api/v1/daily-purchases?store=<店舗UUID>&from=2026-06-01&to=2026-06-30"
```
レスポンス：`{ "data":[ { business_date, amount, supplier, cost_type } ] }`
（`cost_type`：`cogs`=売上原価 / `sga`=販管費）

### POST /api/v1/daily-sales — 日次売上の登録/更新（**read_write キー必須**）
```
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "store_id":"<uuid>", "business_date":"2026-06-15", "net_sales":100000, "gross_sales":117000, "customer_count":50 }' \
  <BASE>/api/v1/daily-sales
```
- `day_period` は常に `all`。サービス料・税額は**サーバ側で再計算**（§8.1）。`gross_sales` は独立入力。
- 店休日は `"is_closed": true`（売上0で保存）。
- 同じ店舗・日付は**上書き**（UPSERT）。
- 書き込みは**監査ログ**（/admin/audit・`API経由の書き込み`）に記録されます。

## 4. AIに使わせる（Claude / Codex 等）

- このドキュメント＋発行したAPIキー（用途に応じ **read 推奨**）を渡せば、AIが上記エンドポイントを呼んでデータを取得・分析できます。
- 例：「下のAPI（period-summary）で2026年6月の店舗別売上・粗利を取得して要約して」。
- **書き込みを許可する場合のみ** read_write キーを使います（誤更新・漏えいのリスクを理解した上で）。

## 5. 注意・セキュリティ

- キーを持つ相手は対象データにアクセスできます。**キーの保管・失効・最終利用日時の監視**を行ってください。
- AIに渡したデータは、その**AI事業者（Anthropic/OpenAI等）側にも渡ります**。機微な財務データの取り扱いにご注意ください。
- 書き込み可（read_write）キーは漏えい時の被害が大きいため、必要最小限・用途明確化・短命運用を推奨します。

## 6. MCPサーバ（Claude Desktop/Code 直結）

上記REST APIをMCPツールとして包んだサーバを `mcp/` に用意しています。Claude Desktop / Claude Code
から「ツール」として店舗・期間集計・日次売上を取得（read_writeキーなら登録/更新）できます。
セットアップは **`mcp/README.md`** を参照。

## 7. 今後（予定）

- 認証単位の細分化（店舗別スコープ等）・レート制限。
- エンドポイント追加（月次PL・仕入・在庫等）。

（このドキュメントは v1。エンドポイントは順次追加予定。）
