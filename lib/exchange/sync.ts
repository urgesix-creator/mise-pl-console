// ====================================================================
// 為替レート自動取得（前月末・対JPY）
//   無料の Frankfurter API（ECB・キー不要・履歴対応）から、前月末日（JST基準）の
//   各通貨→JPY レートを取得し、exchange_rates に UPSERT する。
//   月末レート方式：通貨ペアごとに1値。effective_date は実際に採用した相場日（メタ）。
//   ※ ECB 非対応通貨（VND/TWD 等）は自動スキップ。AI不使用。
// ====================================================================

import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/** JST基準の「前月末日」 YYYY-MM-DD（当月1日の前日＝前月最終日） */
export function previousMonthEndDate(): string {
  const now = jstNow();
  const firstOfThisMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const d = new Date(firstOfThisMonth - 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 指定日の <currency>→JPY を Frankfurter から取得（休場日は直近営業日にフォールバック） */
async function fetchRateToJpy(
  currencyId: string,
  dateISO: string,
): Promise<{ rate: number; date: string } | null> {
  if (currencyId === 'jpy') return null;
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/${dateISO}?base=${currencyId.toUpperCase()}&symbols=JPY`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { date?: string; rates?: { JPY?: number } };
    const rate = json?.rates?.JPY;
    if (typeof rate !== 'number' || !(rate > 0)) return null;
    return { rate, date: json.date ?? dateISO };
  } catch {
    return null;
  }
}

export type FxSyncResult = {
  effectiveDate: string; // 取得対象（前月末）
  updated: { currency: string; rate: number; date: string }[];
  skipped: string[]; // 取得不可（未対応通貨・エラー等）
};

/** 前月末（JST）の各通貨→JPY を取得し exchange_rates に UPSERT する */
export async function syncPreviousMonthEndRates(
  supabase: SupabaseServerClient,
): Promise<FxSyncResult> {
  const target = previousMonthEndDate();

  const { data: currencies } = await supabase.from('currencies').select('id').neq('id', 'jpy');
  const updated: FxSyncResult['updated'] = [];
  const skipped: string[] = [];

  for (const c of (currencies ?? []) as { id: string }[]) {
    const r = await fetchRateToJpy(c.id, target);
    if (!r) {
      skipped.push(c.id);
      continue;
    }
    const { error } = await supabase.from('exchange_rates').upsert(
      {
        from_currency_id: c.id,
        to_currency_id: 'jpy',
        rate: r.rate,
        effective_date: r.date,
        is_active: true,
        notes: '自動取得（前月末・ECB）',
      },
      { onConflict: 'from_currency_id,to_currency_id' },
    );
    if (error) {
      skipped.push(c.id);
      continue;
    }
    updated.push({ currency: c.id, rate: r.rate, date: r.date });
  }

  return { effectiveDate: target, updated, skipped };
}
