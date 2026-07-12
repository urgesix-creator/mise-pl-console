/**
 * Slack 配信メッセージテンプレート
 *
 * 配信先：経営会議グループ（日本語固定）
 * 形式：Slack Block Kit JSON
 *
 * 使い方：
 *   import { buildDailyReportMessage } from '@/lib/slack/templates';
 *   const message = buildDailyReportMessage({ stores: [...], date: '...' });
 *   await fetch(SLACK_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(message) });
 */

// ====================================================================
// 型定義
// ====================================================================

export type StoreReport = {
  storeName: string;
  countryFlag: string;
  currencySymbol: string;
  grossSales: number;
  netSalesJpy: number;
  customerCount: number;
  achievementPct: number | null;
  weather?: string | null;
  eventNote?: string | null;
};

export type AlertSeverity = 'info' | 'warning' | 'critical';

// ====================================================================
// ヘルパー関数
// ====================================================================

const formatNumber = (n: number): string =>
  Number(n).toLocaleString('en-US');

const formatJpy = (n: number): string => {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return `¥${formatNumber(n)}`;
};

/**
 * 達成率の絵文字（システム共通：v2.1）
 * - 100%以上：🟢 緑
 * - 95%以上100%未満：⚪️ 黒
 * - 95%未満：🔴 朱
 */
const achievementEmoji = (pct: number | null): string => {
  if (pct === null) return '⚫️';
  if (pct >= 100) return '🟢';
  if (pct >= 95) return '⚪️';
  return '🔴';
};

const formatDateJp = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${['日','月','火','水','木','金','土'][d.getDay()]})`;
};

// ====================================================================
// 1. 日報配信メッセージ
// ====================================================================

export function buildDailyReportMessage(params: {
  date: string;        // 'YYYY-MM-DD'
  stores: StoreReport[];
  totalNetSalesJpy: number;
  totalCustomers: number;
  monthAchievementPct?: number | null;
}): object {
  const dateLabel = formatDateJp(params.date);
  
  const storeBlocks = params.stores.map(store => {
    const fields: string[] = [
      `*${store.countryFlag} ${store.storeName}*`,
      `${achievementEmoji(store.achievementPct)} 達成率: ${store.achievementPct !== null ? store.achievementPct.toFixed(1) + '%' : '—'}`,
      `売上: ${store.currencySymbol}${formatNumber(store.grossSales)} (${formatJpy(store.netSalesJpy)})`,
      `客数: ${formatNumber(store.customerCount)}名`,
    ];
    if (store.weather) fields.push(`天気: ${store.weather}`);
    if (store.eventNote) fields.push(`📌 ${store.eventNote}`);
    
    return {
      type: 'section',
      text: { type: 'mrkdwn', text: fields.join('\n') },
    };
  });

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📊 日報 ${dateLabel}`, emoji: true },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `全店合計（税抜JPY換算）: *${formatJpy(params.totalNetSalesJpy)}* / 客数: *${formatNumber(params.totalCustomers)}名*` },
        ],
      },
      ...(params.monthAchievementPct !== null && params.monthAchievementPct !== undefined ? [
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `当月累計達成率: ${achievementEmoji(params.monthAchievementPct)} *${params.monthAchievementPct.toFixed(1)}%*` },
          ],
        },
      ] : []),
      { type: 'divider' },
      ...storeBlocks,
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '🤖 みせPL' },
        ],
      },
    ],
  };
}

// ====================================================================
// 2. アラート通知（売上達成率低下等）
// ====================================================================

export function buildAlertMessage(params: {
  severity: AlertSeverity;
  title: string;
  storeName?: string;
  countryFlag?: string;
  message: string;
  detailsUrl?: string;
}): object {
  const severityIcon = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  }[params.severity];

  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${severityIcon} ${params.title}`, emoji: true },
    },
  ];

  if (params.storeName) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `対象店舗: *${params.countryFlag || ''} ${params.storeName}*` },
    });
  }

  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: params.message },
  });

  if (params.detailsUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '詳細を確認' },
          url: params.detailsUrl,
          style: params.severity === 'critical' ? 'danger' : 'primary',
        },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `🤖 みせPL / Alert at ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}` },
    ],
  });

  return { blocks };
}

// ====================================================================
// 3. 入力遅延リマインダー
// ====================================================================

export function buildInputReminderMessage(params: {
  pendingStores: { storeName: string; countryFlag: string; pendingDate: string }[];
}): object {
  const storeList = params.pendingStores.map(s =>
    `• ${s.countryFlag} *${s.storeName}* — ${s.pendingDate}`
  ).join('\n');

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '⏰ 入力リマインダー', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `以下の店舗で日次入力が未完了です：\n\n${storeList}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '担当者へ確認をお願いします。' },
        ],
      },
    ],
  };
}

// ====================================================================
// 4. 月末棚卸リマインダー
// ====================================================================

export function buildInventoryReminderMessage(params: {
  daysUntilMonthEnd: number;
  storeNames: string[];
}): object {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📦 月末棚卸リマインダー', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `月末まで *${params.daysUntilMonthEnd}日*。以下の店舗で概算棚卸額の更新をお願いします：\n\n${params.storeNames.map(n => `• ${n}`).join('\n')}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '月次PL の精度向上のため、月末日中の更新を推奨します。' },
        ],
      },
    ],
  };
}

// ====================================================================
// 5. 異常検知（システムエラー、日報失敗等）
// ====================================================================

export function buildSystemErrorMessage(params: {
  errorType: string;
  errorMessage: string;
  context?: Record<string, unknown>;
}): object {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🛠 システムエラー', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*エラー種別:*\n${params.errorType}` },
          { type: 'mrkdwn', text: `*発生時刻:*\n${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*エラーメッセージ:*\n\`\`\`${params.errorMessage}\`\`\`` },
      },
      ...(params.context ? [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*コンテキスト:*\n\`\`\`${JSON.stringify(params.context, null, 2)}\`\`\`` },
        },
      ] : []),
    ],
  };
}

// ====================================================================
// 統合送信ユーティリティ
// ====================================================================

/**
 * Slack Webhook へメッセージを送信
 */
export async function sendToSlack(
  webhookUrl: string,
  message: object
): Promise<void> {
  if (!webhookUrl) {
    throw new Error('Slack webhook URL is not configured');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${errorText}`);
  }
}
