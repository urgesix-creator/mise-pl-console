#!/usr/bin/env node
// ====================================================================
// Sales Console MCP サーバ（stdio）
//
//   Sales Console の REST API v1（/api/v1）を MCP ツールとして提供する。
//   Claude Desktop / Claude Code から「ツール」として店舗・期間集計・日次売上の
//   取得（および read_write キーなら登録/更新）ができる。
//
//   必要な環境変数：
//     SALES_CONSOLE_API_URL  例: http://localhost:3000/api/v1
//     SALES_CONSOLE_API_KEY  /admin/api-keys で発行したAPIキー（参照のみなら read 推奨）
//
//   起動：node server.mjs（通常は Claude Desktop/Code の設定から自動起動）
//   セットアップは同フォルダの README.md を参照。
// ====================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = (process.env.SALES_CONSOLE_API_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.SALES_CONSOLE_API_KEY ?? '';

if (!API_URL || !API_KEY) {
  console.error('[sales-console-mcp] SALES_CONSOLE_API_URL と SALES_CONSOLE_API_KEY を設定してください。');
  process.exit(1);
}

/** REST API 呼び出し（Bearer 認証） */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${json?.error ?? text}`);
  }
  return json;
}

/** ツールの戻り値（テキスト1件） */
function asText(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
function asError(err) {
  return { isError: true, content: [{ type: 'text', text: `エラー: ${err.message ?? String(err)}` }] };
}

const server = new McpServer({ name: 'sales-console', version: '1.0.0' });

server.tool(
  'list_stores',
  '店舗一覧（店舗番号・名称・国・通貨など）を取得する。',
  {},
  async () => {
    try {
      return asText(await api('/stores'));
    } catch (e) {
      return asError(e);
    }
  },
);

server.tool(
  'period_summary',
  '指定期間の店舗別 期間集計（売上・予算比・粗利・差益・棚卸額／すべて税抜）を取得する。',
  {
    start: z.string().describe('開始日 YYYY-MM-DD'),
    end: z.string().describe('終了日 YYYY-MM-DD'),
  },
  async ({ start, end }) => {
    try {
      return asText(await api(`/period-summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`));
    } catch (e) {
      return asError(e);
    }
  },
);

server.tool(
  'get_daily_sales',
  '指定店舗・期間の日次売上（税抜net・税込gross・サービス料・税額・客数・店休日）を取得する。',
  {
    store: z.string().describe('店舗ID（UUID）'),
    from: z.string().describe('開始日 YYYY-MM-DD'),
    to: z.string().describe('終了日 YYYY-MM-DD'),
  },
  async ({ store, from, to }) => {
    try {
      return asText(
        await api(
          `/daily-sales?store=${encodeURIComponent(store)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
      );
    } catch (e) {
      return asError(e);
    }
  },
);

server.tool(
  'get_daily_purchases',
  '指定店舗・期間の日次仕入（仕入先名・原価区分 cogs=売上原価/sga=販管費・金額）を取得する。',
  {
    store: z.string().describe('店舗ID（UUID）'),
    from: z.string().describe('開始日 YYYY-MM-DD'),
    to: z.string().describe('終了日 YYYY-MM-DD'),
  },
  async ({ store, from, to }) => {
    try {
      return asText(
        await api(
          `/daily-purchases?store=${encodeURIComponent(store)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
      );
    } catch (e) {
      return asError(e);
    }
  },
);

server.tool(
  'upsert_daily_sales',
  '日次売上を登録/更新する（書き込み）。read_write スコープのAPIキーが必要。サービス料・税額はサーバ側で再計算される。',
  {
    store_id: z.string().describe('店舗ID（UUID）'),
    business_date: z.string().describe('営業日 YYYY-MM-DD'),
    net_sales: z.number().describe('税抜売上（主入力）'),
    gross_sales: z.number().optional().describe('税込売上（独立入力・任意）'),
    customer_count: z.number().int().describe('客数'),
    is_closed: z.boolean().optional().describe('店休日なら true（売上0で保存）'),
    weather: z.string().optional(),
    event_note: z.string().optional(),
  },
  async (args) => {
    try {
      return asText(await api('/daily-sales', { method: 'POST', body: args }));
    } catch (e) {
      return asError(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[sales-console-mcp] started');
