'use server';

// ====================================================================
// 売上予算 カレンダー手入力の保存 Server Action（月一括UPSERT）
//
//   - その月の全日を daily_targets に UPSERT（store_id, target_date キー・常に上書き）。
//   - 空欄は 0 として保存（クライアントで 0 に正規化済み・サーバでも非負を検証）。
//   - DELETE は一切しない（全日UPSERTのみ）。画面＝その月の予算の権威。
//   - 手入力保存で Excel取込済みの値も上書きされる（手入力が最新＝正）。
//   - 権限・店舗スコープは ensureTargetWriteAccess（店長以上）で検証。RLSが最終防衛線。
//   - 経営データ（daily_sales）・税計算には一切触れない。
// ====================================================================

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ensureTargetWriteAccess } from './target-auth';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

const monthEntrySchema = z.object({
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が不正です'),
  target_sales: z
    .number({ invalid_type_error: '予算額を数値で入力してください' })
    .nonnegative('予算額は0以上で入力してください')
    .max(1_000_000_000_000, '予算額の上限を超えています'),
});

const upsertMonthlyTargetsSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  year_month: z.string().regex(/^\d{4}-\d{2}$/, '対象月の形式が不正です（YYYY-MM）'),
  entries: z.array(monthEntrySchema).max(31, '1か月分（最大31日）を超えています'),
});

export type UpsertMonthlyTargetsInput = z.infer<typeof upsertMonthlyTargetsSchema>;

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return '一意制約に違反しています（日付の重複を確認してください）';
  if (error.code === '23514') return '入力値が制約に違反しています（予算額は0以上）';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

/**
 * 1か月分の日別売上予算を daily_targets へ一括 UPSERT する。
 * - entries は当該月の全日（空欄は 0 として呼び出し側で渡す）。
 * - すべての target_date が year_month の月に属することを検証（他月混入防止）。
 */
export async function upsertMonthlyTargets(
  input: UpsertMonthlyTargetsInput,
): Promise<ActionResult<{ saved: number }>> {
  const parsed = upsertMonthlyTargetsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容を確認してください' };
  }

  // 全 target_date が対象月（year_month）に属することを検証
  for (const e of parsed.data.entries) {
    if (!e.target_date.startsWith(`${parsed.data.year_month}-`)) {
      return { success: false, error: '対象月に属さない日付が含まれています' };
    }
  }

  const auth = await ensureTargetWriteAccess(parsed.data.store_id);
  if (!auth.ok) return { success: false, error: auth.error };

  if (parsed.data.entries.length === 0) {
    return { success: true, data: { saved: 0 } };
  }

  const rows = parsed.data.entries.map((e) => ({
    store_id: parsed.data.store_id,
    target_date: e.target_date,
    target_sales: e.target_sales,
  }));

  const { error } = await auth.supabase
    .from('daily_targets')
    .upsert(rows, { onConflict: 'store_id,target_date' });
  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/targets');
  return { success: true, data: { saved: rows.length } };
}
