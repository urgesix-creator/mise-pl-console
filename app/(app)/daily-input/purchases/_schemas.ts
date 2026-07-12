import { z } from 'zod';

// ====================================================================
// 日次仕入入力のスキーマ
//
// - 仕入先（supplier）ごとに金額を入力する。
// - 既存の suppliers マスタ・daily_purchases テーブルをそのまま使う（構造変更なし）。
// - 保存は (store_id, business_date, supplier_id) で UPSERT（常に上書き）。
// - 空欄は 0 として扱う。DELETE は一切行わない（訂正は上書きで実現）。
// - 入力権限は日次売上入力と同一（WRITE_ROLES は sales 側を単一の正とする）。
// ====================================================================

/** 1仕入先ぶんの入力 */
export const purchaseEntrySchema = z.object({
  supplier_id: z.string().uuid('仕入先IDが不正です'),
  // 任意入力。空欄（null/undefined）はサーバ側で 0 に正規化して保存する（DELETEしない）。
  amount: z
    .number({ invalid_type_error: '仕入額を数値で入力してください' })
    .nonnegative('仕入額は0以上で入力してください')
    .max(1_000_000_000_000, '仕入額の上限を超えています')
    .nullable()
    .optional(),
});

export const upsertDailyPurchasesSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  business_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '営業日は YYYY-MM-DD 形式で指定してください'),
  entries: z.array(purchaseEntrySchema),
});

export type PurchaseEntry = z.infer<typeof purchaseEntrySchema>;
export type UpsertDailyPurchasesInput = z.infer<typeof upsertDailyPurchasesSchema>;

// ====================================================================
// 棚卸し（在庫）の保存スキーマ
//
// - 店舗 × 営業日 で在庫合計額を1値だけ持つ（011 で履歴化済みの inventory_estimates）。
// - 空欄（amount 未入力）はその日の記録を作らない（仕入の「空欄=0」とは逆）。DELETE もしない。
// - 入力権限は仕入・売上と同一（WRITE_ROLES）。
// ====================================================================
export const upsertInventorySchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  business_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '営業日は YYYY-MM-DD 形式で指定してください'),
  // 空欄（null/undefined）は保存しない（記録を作らない）。
  amount: z
    .number({ invalid_type_error: '在庫合計額を数値で入力してください' })
    .nonnegative('在庫合計額は0以上で入力してください')
    .max(1_000_000_000_000, '在庫合計額の上限を超えています')
    .nullable()
    .optional(),
});

export type UpsertInventoryInput = z.infer<typeof upsertInventorySchema>;
