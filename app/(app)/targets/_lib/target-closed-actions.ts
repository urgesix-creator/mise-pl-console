'use server';

// ====================================================================
// 売上予算カレンダーからの「店休日」設定 Server Action（即時保存）
//
//   - 店休日は daily_sales.is_closed に一本化（売上入力画面と同じ列）。
//   - 予算カレンダー（/targets）から、各日の店休日を ON/OFF する専用Action。
//     予算（daily_targets）の月一括保存（upsertMonthlyTargets）とは別経路・無変更。
//   - day_period は 'all' 基準（予算カレンダーは1日1セル）。
//   - 店休日ON：レコード有→ is_closed=true＋売上0化。無→ 売上0＋is_closed=true で新規作成。
//   - 店休日OFF：is_closed=false に更新（売上0レコードは残す・DELETEしない）。
//   - 税計算（§8.1 calculateSales）には触れない（売上0で税も0。本Actionは0を直接保存）。
//   - 権限：店長以上（ensureTargetWriteAccess を流用）＋店舗スコープ。RLSが最終防衛線。
// ====================================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ensureTargetWriteAccess } from './target-auth';

type ActionResult = { success: true } | { success: false; error: string };

const setClosedDaySchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が不正です'),
  is_closed: z.boolean(),
});

export type SetClosedDayInput = z.infer<typeof setClosedDaySchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23514') return '入力値が制約に違反しています';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

/**
 * 指定日（day_period='all'）の店休日フラグを設定する。
 *
 * - ON（is_closed=true）：売上系（net_sales/gross_sales/service_fee/tax_amount/customer_count）
 *   をすべて 0 にして is_closed=true で UPSERT（レコード無なら新規作成・有なら上書き）。
 * - OFF（is_closed=false）：is_closed のみ false に更新（既存レコードがある場合）。
 *   レコードが無ければ何もしない（営業日に「売上0の空レコード」を作らない）。
 * - マッチングキー (store_id, business_date, day_period='all')。DELETE はしない。
 */
export async function setClosedDay(input: SetClosedDayInput): Promise<ActionResult> {
  const parsed = setClosedDaySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  const auth = await ensureTargetWriteAccess(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };

  const { supabase } = auth;
  const { store_id, business_date, is_closed } = parsed.data;

  if (is_closed) {
    // 店休日化：売上0＋is_closed=true。税額も0で確定（売上0＝税0。calculateSales は呼ばない）。
    // 既存の weather/event_note を消さないため、UPSERT ではなく「有無で update / insert」に分岐する。
    const { data: existing, error: selError } = await supabase
      .from('daily_sales')
      .select('id')
      .eq('store_id', store_id)
      .eq('business_date', business_date)
      .eq('day_period', 'all')
      .maybeSingle();
    if (selError) return { success: false, error: translateDbError(selError) };

    if (existing) {
      // 有：売上系のみ0化＋is_closed=true（weather/event_note・他は保持）
      const { error } = await supabase
        .from('daily_sales')
        .update({
          net_sales: 0,
          gross_sales: 0,
          service_fee: 0,
          tax_amount: 0,
          customer_count: 0,
          is_closed: true,
        })
        .eq('id', existing.id);
      if (error) return { success: false, error: translateDbError(error) };
    } else {
      // 無：売上0＋is_closed=true で新規作成
      const { error } = await supabase.from('daily_sales').insert({
        store_id,
        business_date,
        day_period: 'all',
        net_sales: 0,
        gross_sales: 0,
        service_fee: 0,
        tax_amount: 0,
        customer_count: 0,
        weather: null,
        event_note: null,
        is_closed: true,
      });
      if (error) return { success: false, error: translateDbError(error) };
    }
  } else {
    // 店休日解除：既存レコードがあれば is_closed=false に更新（売上0は残す・DELETEしない）。
    // レコードが無ければ何もしない（営業日に空の0レコードを作らない）。
    const { error } = await supabase
      .from('daily_sales')
      .update({ is_closed: false })
      .eq('store_id', store_id)
      .eq('business_date', business_date)
      .eq('day_period', 'all');
    if (error) return { success: false, error: translateDbError(error) };
  }

  revalidatePath('/targets');
  revalidatePath('/daily-input/sales');
  return { success: true };
}
