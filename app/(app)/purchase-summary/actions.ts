'use server';

// ====================================================================
// 仕入先別 仕入集計：取引先×対象月の「日別内訳」取得（read-only）
//
//   指定店舗・仕入先・対象月(YYYY-MM)の daily_purchases を取得し、
//   1日〜月末の日別金額（無い日は0）を返す。RLS で参照可能店舗に限定。
//   金額の合算・PL・期間集計のロジックには一切触れない（表示用の参照のみ）。
// ====================================================================

import { createClient } from '@/lib/supabase/server';

const YM_PATTERN = /^\d{4}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;

export type SupplierDailyRow = { date: string; day: number; amount: number };
export type SupplierDailyResult =
  | { success: true; days: SupplierDailyRow[]; total: number }
  | { success: false; error: string };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export async function getSupplierDailyPurchases(
  storeId: string,
  supplierId: string,
  yearMonth: string,
): Promise<SupplierDailyResult> {
  if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(supplierId)) {
    return { success: false, error: 'パラメータが不正です' };
  }
  if (!YM_PATTERN.test(yearMonth)) {
    return { success: false, error: '対象月の形式が正しくありません' };
  }

  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-${pad(daysInMonth)}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_purchases')
    .select('business_date, amount')
    .eq('store_id', storeId)
    .eq('supplier_id', supplierId)
    .gte('business_date', start)
    .lte('business_date', end);

  if (error) return { success: false, error: `日別内訳の取得に失敗しました: ${error.message}` };

  const amountByDate = new Map<string, number>();
  for (const r of (data ?? []) as { business_date: string; amount: number | string }[]) {
    amountByDate.set(
      r.business_date,
      (amountByDate.get(r.business_date) ?? 0) + Number(r.amount ?? 0),
    );
  }

  const days: SupplierDailyRow[] = [];
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${yearMonth}-${pad(d)}`;
    const amount = amountByDate.get(date) ?? 0;
    total += amount;
    days.push({ date, day: d, amount });
  }

  return { success: true, days, total };
}
