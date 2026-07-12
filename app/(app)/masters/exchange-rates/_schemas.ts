import { z } from 'zod';

export const STALE_THRESHOLD_DAYS = 30 as const;

export const QUOTE_CURRENCY_ID = 'jpy' as const;

export const WRITE_ROLES = ['executive', 'accounting'] as const;

export const rateFormSchema = z.object({
  from_currency_id: z.string().min(1, '元通貨を選択してください'),
  to_currency_id: z.string().min(1, '換算先通貨を選択してください'),
  rate: z
    .number({ invalid_type_error: 'レートを数値で入力してください' })
    .positive('レートは正の数で入力してください')
    .max(1_000_000, 'レートが大きすぎます'),
  effective_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '基準日は YYYY-MM-DD 形式で入力してください'),
  notes: z.string().max(500, 'メモは500文字以内で入力してください').nullable().optional(),
});

export const createExchangeRateSchema = rateFormSchema;

export const updateExchangeRateSchema = rateFormSchema.pick({
  rate: true,
  effective_date: true,
  notes: true,
});

export const currencyFormSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, '通貨IDは2文字以上で入力してください')
    .max(8, '通貨IDは8文字以内で入力してください')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      '通貨IDは小文字英字で始まり、英数字とアンダースコアのみ使用できます',
    ),
  code: z
    .string()
    .trim()
    .min(2, '通貨コードは2文字以上で入力してください')
    .max(8, '通貨コードは8文字以内で入力してください')
    .regex(/^[A-Z][A-Z0-9]*$/, '通貨コードは大文字英字と数字で入力してください'),
  symbol: z
    .string()
    .trim()
    .min(1, '通貨記号を入力してください')
    .max(8, '通貨記号は8文字以内で入力してください'),
  name: z
    .string()
    .trim()
    .min(1, '通貨名を入力してください')
    .max(50, '通貨名は50文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '表示順は数値で入力してください' })
    .int('表示順は整数で入力してください')
    .min(0, '表示順は0以上で入力してください'),
});

export type RateFormData = z.infer<typeof rateFormSchema>;
export type CurrencyFormData = z.infer<typeof currencyFormSchema>;
