import { z } from 'zod';

export const DAY_PERIODS = ['all', 'lunch', 'dinner'] as const;
export type DayPeriod = (typeof DAY_PERIODS)[number];

// ====================================================================
// 日本の消費税（消費税法）。売上の1日単位で税区分を選ぶ。
//   standard（標準税率）= 10%
//   reduced （軽減税率）=  8%（テイクアウト・持ち帰り等）
// JPY は小数を持たないため税額・税込は整数円に丸める（四捨五入）。
// ====================================================================
export const TAX_CATEGORIES = ['standard', 'reduced'] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];

export const JP_TAX_RATES: Record<TaxCategory, number> = {
  standard: 0.1,
  reduced: 0.08,
};

/** 税区分に対応する消費税率（standard=0.10 / reduced=0.08） */
export function taxRateFor(category: TaxCategory): number {
  return JP_TAX_RATES[category] ?? JP_TAX_RATES.standard;
}

export const TAX_CATEGORY_LABEL: Record<TaxCategory, string> = {
  standard: '標準税率 10%',
  reduced: '軽減税率 8%（テイクアウト）',
};

// 選択肢（東南アジア向け）。weather は DB上は自由文字列。晴/曇/雨 に加え、
// 突発的なスコールや「晴れ時々雨」を選べるようにする。雪は選択肢から除外（旧データ表示は維持）。
export const WEATHER_OPTIONS = ['sunny', 'cloudy', 'rainy', 'squall', 'sunny_rain', 'other'] as const;
export type Weather = (typeof WEATHER_OPTIONS)[number];

// 表示ラベル。既存ラベル（晴/曇/雨/雪/その他）はExcel取込の互換のため変更しない。
// 選択肢に加え、旧データ（snowy）の表示・取込のため広めに保持する（Record<string,string>）。
export const WEATHER_LABEL: Record<string, string> = {
  sunny: '晴',
  cloudy: '曇',
  rainy: '雨',
  squall: 'スコール',
  sunny_rain: '晴れ時々雨',
  other: 'その他',
  snowy: '雪', // 旧データ表示・Excel取込互換用（選択肢からは除外）
};

export const WRITE_ROLES = ['executive', 'country_rep', 'store_manager', 'staff'] as const;

/** JPY は小数を持たないため整数円に丸める（四捨五入） */
function roundYen(n: number): number {
  return Math.round(n);
}

export type SalesCalculation = {
  net_sales: number; // 税抜売上（主入力）
  service_fee: number; // サービス料。日本の消費税制では常に0（互換のため列は保持）
  tax_amount: number; // 消費税額（自動計算＝net × 税区分の税率、整数円）
  gross_sales: number; // 総売上・税込（独立入力。未入力なら net+tax を既定表示）
  avg_per_customer: number | null; // 客単価（自動計算 = gross ÷ 客数。表示用）
};

export type CalculateSalesInput = {
  /** 税抜売上（主入力）。予算・業績指標の基準 */
  netSales: number;
  /**
   * 総売上・税込（独立入力）。0/未入力のときは net + tax を既定値として返す
   * （UI のプレフィル・保存時の既定）。正の値が入っていればそれをそのまま使う。
   */
  grossSales: number;
  /** 売上の税区分（standard=10% / reduced=8%）。店舗が軽減税率非対応なら常に standard */
  taxCategory: TaxCategory;
  /** 客数 */
  customerCount: number;
};

/**
 * 客単価 = 総売上（税込・独立入力）÷ 客数。
 * 客数0、または総売上0以下のときは null。
 */
export function calcAvgPerCustomer(grossSales: number, customerCount: number): number | null {
  if (customerCount <= 0 || grossSales <= 0) return null;
  return roundYen(grossSales / customerCount);
}

/**
 * 日本の消費税に基づく売上の順計算。net_sales（税抜）が主入力。
 *
 *   service_fee = 0                              （消費税制ではサービス料課税はしない）
 *   tax_amount  = round(net_sales × 税率)         （税率 = 標準0.10 / 軽減0.08、整数円）
 *   gross_sales = 入力があればその値、無ければ net + tax（既定プレフィル）
 *   avg_per_customer = gross_sales ÷ customer_count（分子は税込）
 *
 * 旧・海外税制（サービス料＋現地VAT・taxBase='net_plus_service' 逆算）は全廃。
 */
export function calculateSales(input: CalculateSalesInput): SalesCalculation {
  const { netSales, grossSales, taxCategory, customerCount } = input;

  const net = roundYen(netSales > 0 ? netSales : 0);
  const rate = taxRateFor(taxCategory);
  const taxAmount = roundYen(net * rate);

  // 総売上（税込）は独立入力。未入力（0以下）のときは net+tax を既定として返す。
  const gross = grossSales > 0 ? roundYen(grossSales) : net + taxAmount;

  return {
    net_sales: net,
    service_fee: 0, // 消費税制では常に0
    tax_amount: taxAmount,
    gross_sales: gross,
    avg_per_customer: calcAvgPerCustomer(gross, customerCount),
  };
}

export type DigitWarning = {
  /** true のとき桁違いの可能性を警告（保存はブロックしない） */
  warn: boolean;
  message: string | null;
};

/**
 * 売上入力の桁違い警告（data_model_v1.7 §8.1.1）。
 * gross_sales ÷ net_sales が 2.0超 または 0.5未満で警告を返す（net_sales > 0 のときのみ）。
 * 警告は保存をブロックしない（フラグ／メッセージを返すだけ）。
 */
export function grossNetDigitWarning(grossSales: number, netSales: number): DigitWarning {
  if (netSales <= 0) return { warn: false, message: null };
  const ratio = grossSales / netSales;
  if (ratio > 2.0 || ratio < 0.5) {
    return {
      warn: true,
      message:
        '総売上（税込）と税抜売上の比率が通常範囲外です。桁の入力ミスがないかご確認ください（このまま保存も可能です）。',
    };
  }
  return { warn: false, message: null };
}

export const upsertDailySalesSchema = z.object({
  store_id: z.string().uuid('店舗IDが不正です'),
  business_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '営業日は YYYY-MM-DD 形式で指定してください'),
  day_period: z.enum(DAY_PERIODS),
  // 税抜売上（主入力・必須）。予算・業績指標の基準
  net_sales: z
    .number({ invalid_type_error: '税抜売上を数値で入力してください' })
    .nonnegative('税抜売上は0以上で入力してください')
    .max(1_000_000_000_000, '税抜売上の上限を超えています'),
  // 総売上・税込（独立入力）。net とは連動しない。未入力可
  gross_sales: z
    .number({ invalid_type_error: '総売上を数値で入力してください' })
    .nonnegative('総売上は0以上で入力してください')
    .max(1_000_000_000_000, '総売上の上限を超えています')
    .optional(),
  customer_count: z
    .number({ invalid_type_error: '客数を数値で入力してください' })
    .int('客数は整数で入力してください')
    .nonnegative('客数は0以上で入力してください')
    .max(100_000, '客数の上限を超えています'),
  // 売上の税区分（standard=10% / reduced=8%）。未指定は standard 扱い。
  // 店舗が軽減税率非対応（has_takeout=false）の場合はサーバ側で standard に強制する。
  tax_category: z.enum(TAX_CATEGORIES).optional(),
  weather: z.string().nullable().optional(),
  event_note: z
    .string()
    .max(500, 'イベントメモは500文字以内で入力してください')
    .nullable()
    .optional(),
  // 店休日フラグ。true のとき売上0で保存（サーバ側でも0を強制）。
  is_closed: z.boolean(),
  // 祝日フラグ＋祝日名（#9・任意）。店休とは独立。集計・税計算には不使用。
  is_holiday: z.boolean().optional(),
  holiday_name: z
    .string()
    .max(100, '祝日名は100文字以内で入力してください')
    .nullable()
    .optional(),
});

/**
 * クライアント側フォーム検証用（store_id / business_date を除いたもの）。
 * これを useForm の resolver に渡す。
 *
 * 注：service_fee / tax_amount / avg_per_customer は入力項目ではなく、
 * calculateSales による自動計算値（フォームには含めない）。
 */
export const salesFormSchema = upsertDailySalesSchema.omit({
  store_id: true,
  business_date: true,
});

export type UpsertDailySalesInput = z.infer<typeof upsertDailySalesSchema>;
export type SalesFormSchemaValues = z.infer<typeof salesFormSchema>;
