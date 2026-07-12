import { z } from 'zod';

// 国マスタの書込ロール（countries の RLS は is_executive() のみ書込可と整合）
export const WRITE_ROLES = ['executive'] as const;

// 課税ベース（countries.tax_base の CHECK制約：この2値のみ）
export const TAX_BASES = ['net_sales', 'net_plus_service'] as const;
export type TaxBase = (typeof TAX_BASES)[number];

// 画面表示用の課税ベースラベル
export const TAX_BASE_LABELS: Record<TaxBase, string> = {
  net_sales: '税抜売上に課税（net_sales）',
  net_plus_service: '税抜売上＋サービス料に課税（net_plus_service）',
};

/**
 * Server Action 用スキーマ。tax_rate は「小数」（0.07 等）で受け取る。
 * ％入力→小数変換はフォーム側（country-form-dialog）で行う。
 */
export const countryFormSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, '国IDは2文字以上で入力してください')
    .max(8, '国IDは8文字以内で入力してください')
    .regex(/^[a-z][a-z0-9_]*$/, '国IDは小文字英字で始まり、英数字とアンダースコアのみ使用できます'),
  code: z
    .string()
    .trim()
    .min(2, '国コードは2文字以上で入力してください')
    .max(8, '国コードは8文字以内で入力してください')
    .regex(/^[A-Z][A-Z0-9]*$/, '国コードは大文字英字と数字で入力してください'),
  name: z.string().trim().min(1, '国名を入力してください').max(50, '国名は50文字以内で入力してください'),
  flag: z.string().trim().max(8, '国旗は8文字以内で入力してください').nullable().optional(),
  tax_rate: z
    .number({ invalid_type_error: '税率を数値で入力してください' })
    .min(0, '税率は0%以上で入力してください')
    .max(1, '税率は100%以下で入力してください'),
  tax_base: z.enum(['net_sales', 'net_plus_service'], {
    errorMap: () => ({ message: '課税ベースを選択してください' }),
  }),
  tax_label: z
    .string()
    .trim()
    .min(1, '課税ラベルを入力してください')
    .max(20, '課税ラベルは20文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '表示順は数値で入力してください' })
    .int('表示順は整数で入力してください')
    .min(0, '表示順は0以上で入力してください'),
});

export type CountryFormData = z.infer<typeof countryFormSchema>;
