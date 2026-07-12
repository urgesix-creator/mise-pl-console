# Sales Console MCP サーバ

Sales Console の REST API v1（`/api/v1`）を **MCP ツール**として提供し、
**Claude Desktop / Claude Code** から店舗・期間集計・日次売上を「ツール」として
取得（read_write キーなら登録/更新）できるようにするものです。

> アプリ本体（Next.js）とは別プロセスです。このフォルダ単体でセットアップします。

---

## 1. 前提

- Node.js 18 以上（`fetch` を使用）。
- Sales Console が起動していること（ローカルなら `npm run dev` → `http://localhost:3000`）。
- **APIキー**：アプリの「管理 → APIキー（/admin/api-keys）」で発行。
  - 参照だけなら **read（読み取り専用）** を推奨。
  - 書き込み（`upsert_daily_sales`）を使う場合のみ **read_write**（リスク同意が必要）。

## 2. セットアップ

```bash
cd mcp
npm install
```

動作確認（任意）：
```bash
SALES_CONSOLE_API_URL="http://localhost:3000/api/v1" \
SALES_CONSOLE_API_KEY="sc_xxxxx" \
node server.mjs
# 「[sales-console-mcp] started」と表示されれば起動成功（Ctrl+C で終了）
```

## 3. Claude Desktop に登録

設定ファイル（`claude_desktop_config.json`）の `mcpServers` に追加：

```json
{
  "mcpServers": {
    "sales-console": {
      "command": "node",
      "args": ["/絶対パス/sales-console/mcp/server.mjs"],
      "env": {
        "SALES_CONSOLE_API_URL": "http://localhost:3000/api/v1",
        "SALES_CONSOLE_API_KEY": "sc_xxxxx"
      }
    }
  }
}
```

- `args` はこのファイルの**絶対パス**にしてください。
- 設定ファイルの場所：
  - macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows：`%APPDATA%\Claude\claude_desktop_config.json`
- 保存後 Claude Desktop を再起動すると、ツールが使えます。

## 4. Claude Code（CLI）に登録

```bash
claude mcp add sales-console \
  --env SALES_CONSOLE_API_URL=http://localhost:3000/api/v1 \
  --env SALES_CONSOLE_API_KEY=sc_xxxxx \
  -- node /絶対パス/sales-console/mcp/server.mjs
```

## 5. 使えるツール

| ツール | 内容 | 権限 |
|---|---|---|
| `list_stores` | 店舗一覧 | read |
| `period_summary(start, end)` | 店舗別 期間集計（売上・予算比・粗利・差益・棚卸） | read |
| `get_daily_sales(store, from, to)` | 日次売上の取得 | read |
| `get_daily_purchases(store, from, to)` | 日次仕入の取得（仕入先・原価区分つき） | read |
| `upsert_daily_sales(store_id, business_date, net_sales, …)` | 日次売上の登録/更新 | **read_write** |

使用例（Claude への指示）：
- 「list_stores で店舗を確認して、period_summary で 2026-06-01〜2026-06-30 の各店の売上と粗利を要約して」
- （書き込み許可時）「001店の 2026-06-15 の税抜売上を 100000、客数 50 で upsert して」

## 6. 注意

- このサーバに渡したデータは、接続している AI（Claude）側にも渡ります（機微な財務データの取り扱いに注意）。
- 書き込みは `read_write` キーのときのみ可能。read キーで `upsert_daily_sales` を呼ぶと API が 403 を返します。
- キーは漏えいに注意し、不要になったら `/admin/api-keys` で失効してください。

---

（v1。REST API の仕様は `../docs/api_v1.md` を参照。エンドポイント追加に合わせてツールも拡張予定。）
