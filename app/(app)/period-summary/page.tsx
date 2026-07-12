import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPeriodSummary } from './actions';
import { PeriodSummaryClient } from './_components/period-summary-client';

export const metadata = {
  title: '店舗別 期間集計 | みせPL',
};

// 日次データはアプリ外でも更新され得るため常に最新を取得
export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
/** 日本時間（JST=UTC+9）基準の今日 YYYY-MM-DD */
function jstTodayISO(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}
/** 日本時間（JST=UTC+9）基準の前日 YYYY-MM-DD */
function jstYesterdayISO(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default async function PeriodSummaryPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) redirect('/login');

  // 期間：searchParams（start/end）。既定＝当月1日〜前日（JST基準）。
  // 終了日の初期値（最初にカーソルが合う日）は「前日」。月初日のみ開始日(=当月1日)でクランプし範囲エラーを回避。
  const today = jstTodayISO();
  const yesterday = jstYesterdayISO();
  const defaultStart = `${today.slice(0, 7)}-01`;
  const defaultEnd = yesterday < defaultStart ? defaultStart : yesterday;
  const rawStart = pickString(searchParams?.start);
  const rawEnd = pickString(searchParams?.end);
  const start = rawStart && DATE_PATTERN.test(rawStart) ? rawStart : defaultStart;
  const end = rawEnd && DATE_PATTERN.test(rawEnd) ? rawEnd : defaultEnd;

  const rangeError = start > end ? '開始日が終了日より後になっています' : null;

  // 通貨記号（id→symbol）・有効グループ・有効店舗（絞り込みSelect用）
  const [currenciesResult, groupsResult, storesResult] = await Promise.all([
    supabase.from('currencies').select('id, symbol'),
    supabase.from('store_groups').select('id, name').eq('is_active', true).order('display_order'),
    supabase.from('stores').select('id, store_no, name').eq('is_active', true).order('store_no'),
  ]);
  const currencySymbols: Record<string, string> = {};
  for (const c of (currenciesResult.data ?? []) as { id: string; symbol: string }[]) {
    currencySymbols[c.id] = c.symbol;
  }
  const groups = (groupsResult.data ?? []) as { id: string; name: string }[];
  // グループ欄に常備する「各店舗（1店ずつ）」。RLSで見える有効店舗のみ・store_no 順。
  const stores = (storesResult.data ?? []) as { id: string; store_no: number; name: string }[];

  // 選択（searchParams group=<value>）。value は 'store:<id>'（単一店舗）／<groupId>（自由グループ）。
  // 「全店舗」は未指定（null）。不明な値は全店舗扱い。
  const rawGroup = pickString(searchParams?.group);
  let selectedGroupId: string | null = null;
  let selectedStoreId: string | null = null;
  if (rawGroup) {
    if (rawGroup.startsWith('store:')) {
      const sid = rawGroup.slice('store:'.length);
      if (stores.some((s) => s.id === sid)) selectedStoreId = sid;
    } else if (groups.some((g) => g.id === rawGroup)) {
      selectedGroupId = rawGroup;
    }
  }

  // 開始>終了 のときはデータ取得しない
  const result = rangeError
    ? null
    : await getPeriodSummary(start, end, selectedGroupId, selectedStoreId);

  return (
    <PeriodSummaryClient
      start={start}
      end={end}
      rangeError={rangeError}
      result={result}
      currencySymbols={currencySymbols}
      groups={groups}
      stores={stores.map((s) => ({ id: s.id, name: s.name }))}
      selectedGroupId={selectedGroupId}
      selectedStoreId={selectedStoreId}
    />
  );
}
