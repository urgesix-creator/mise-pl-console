import { z } from 'zod';

// 店舗グループの書込ロール（store_groups の RLS は is_executive() のみ書込可と整合）
export const WRITE_ROLES = ['executive'] as const;

export const storeGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'グループ名を入力してください').max(50, 'グループ名は50文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '表示順は数値で入力してください' })
    .int('表示順は整数で入力してください')
    .min(0, '表示順は0以上で入力してください'),
  store_ids: z.array(z.string().uuid()).default([]),
});

export type StoreGroupFormData = z.infer<typeof storeGroupFormSchema>;
