'use server';

// ====================================================================
// 店舗別 期間集計 Server Action（read-only）
//
//   getPeriodSummary(start, end)：
//     - RLS で参照可能な有効店舗（store_no 順）を取得
//     - 各店舗を lib/period-summary で期間集計（PL と同じ集計・在庫補完を再利用）
//     - 為替レート（→jpy・is_active）を取得し、絶対額の円換算値を併せて返す
//   権限は RLS 任せ（executive は全店・他ロールは見える店のみ）。
//   SELECT のみ。書き込みは一切しない。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { convertToJpy } from '@/lib/business';
import {
  aggregateStorePeriod,
  computeStorePeriodMetrics,
  computeGroupTotal,
  type StorePeriodMetrics,
  type GroupTotal,
} from '@/lib/period-summary/aggregate';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodJpy = {
  netSales: number;
  grossProfit: number;
  marginProfit: number;
  closingInventory: number;
};

export type PeriodSummaryRow = {
  storeId: string;
  storeNo: number;
  name: string;
  currencyId: string;
  metrics: StorePeriodMetrics;
  /** 円換算値（レート未登録なら null） */
  jpy: PeriodJpy | null;
  /** 適用した 現地通貨→JPY レート（未登録なら null） */
  rate: number | null;
};

export type PeriodSummaryResult =
  | {
      success: true;
      rows: PeriodSummaryRow[];
      /** 円換算に使った 通貨→レート の一覧（注記用） */
      appliedRates: { currencyId: string; rate: number }[];
      /** 円換算レートが無い通貨（注記用） */
      missingRateCurrencies: string[];
      /** グループ選択時の合計行（未選択 or 所属0件は null） */
      groupTotal: GroupTotal | null;
    }
  | { success: false; error: string };

const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;

export async function getPeriodSummary(
  start: string,
  end: string,
  groupId?: string | null,
  storeId?: string | null,
): Promise<PeriodSummaryResult> {
  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
    return { success: false, error: '日付の形式が正しくありません（YYYY-MM-DD）' };
  }
  if (start > end) {
    return { success: false, error: '開始日が終了日より後になっています' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  // RLS で参照可能な有効店舗（store_no 順）
  const { data: storesData, error: storesError } = await supabase
    .from('stores')
    .select('id, store_no, name, currency_id')
    .eq('is_active', true)
    .order('store_no');
  if (storesError) {
    return { success: false, error: `店舗の取得に失敗しました: ${storesError.message}` };
  }
  let stores = storesData ?? [];

  // 単一店舗指定時（グループ欄の「各店舗」）：その店舗のみへ絞り込み（グループ指定より優先）。
  // 集計ロジック（aggregateStorePeriod／computeStorePeriodMetrics）は不変。対象店舗を絞るのみ。
  const useSingleStore = !!storeId && UUID_PATTERN.test(storeId);
  // グループ指定時：そのグループに有効所属する店舗のみへ絞り込み（未指定時は全有効店舗のまま）
  const useGroup = !useSingleStore && !!groupId && UUID_PATTERN.test(groupId);
  if (useSingleStore) {
    stores = stores.filter((s) => s.id === storeId);
  } else if (useGroup) {
    const { data: memberRows, error: memberError } = await supabase
      .from('store_group_members')
      .select('store_id')
      .eq('group_id', groupId as string)
      .eq('is_active', true);
    if (memberError) {
      return { success: false, error: `グループ所属の取得に失敗しました: ${memberError.message}` };
    }
    const memberSet = new Set((memberRows ?? []).map((m) => m.store_id));
    stores = stores.filter((s) => memberSet.has(s.id));
  }

  // 為替レート（→jpy・有効）。月末レート方式：通貨ペアごとに1値。
  const { data: rateRows } = await supabase
    .from('exchange_rates')
    .select('from_currency_id, to_currency_id, rate')
    .eq('to_currency_id', 'jpy')
    .eq('is_active', true);
  const rates = (rateRows ?? []) as {
    from_currency_id: string;
    to_currency_id: string;
    rate: number;
  }[];

  const rows: PeriodSummaryRow[] = await Promise.all(
    stores.map(async (s): Promise<PeriodSummaryRow> => {
      const actuals = await aggregateStorePeriod(supabase, s.id, start, end);
      const metrics = computeStorePeriodMetrics(actuals);

      const factor = convertToJpy(1, s.currency_id, rates); // 1通貨 = ? JPY（無→null）
      const jpy: PeriodJpy | null =
        factor === null
          ? null
          : {
              netSales: metrics.netSales * factor,
              grossProfit: metrics.grossProfit * factor,
              marginProfit: metrics.marginProfit * factor,
              closingInventory: metrics.closingInventory * factor,
            };

      return {
        storeId: s.id,
        storeNo: Number(s.store_no),
        name: s.name,
        currencyId: s.currency_id,
        metrics,
        jpy,
        rate: factor,
      };
    }),
  );

  // 注記用：登場する通貨について 適用レート / 未登録 を集計
  const seen = new Set<string>();
  const appliedRates: { currencyId: string; rate: number }[] = [];
  const missingRateCurrencies: string[] = [];
  for (const r of rows) {
    if (r.currencyId === 'jpy' || seen.has(r.currencyId)) continue;
    seen.add(r.currencyId);
    if (r.rate === null) missingRateCurrencies.push(r.currencyId);
    else appliedRates.push({ currencyId: r.currencyId, rate: r.rate });
  }

  // グループ選択かつ所属店舗ありのときのみ合計行を算出（サーバ側）
  const groupTotal: GroupTotal | null =
    useGroup && rows.length > 0
      ? computeGroupTotal(
          rows.map((r) => ({ metrics: r.metrics, currencyId: r.currencyId, rate: r.rate })),
        )
      : null;

  return { success: true, rows, appliedRates, missingRateCurrencies, groupTotal };
}
