import { z } from 'zod';
import type { TaxBase } from '@/types/database';

export const DAY_PERIODS = ['all', 'lunch', 'dinner'] as const;
export type DayPeriod = (typeof DAY_PERIODS)[number];

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

/** 金額を小数2桁に丸める（DECIMAL(12,2) に合わせる） */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type SalesCalculation = {
  net_sales: number; // 税抜売上（主入力）
  service_fee: number; // サービス料（自動計算）
  tax_amount: number; // 税額（自動計算）
  gross_sales: number; // 総売上・税込（独立入力。逆算しない）
  avg_per_customer: number | null; // 客単価（自動計算 = gross ÷ 客数。表示用）
};

export type CalculateSalesInput = {
  /** 税抜売上（主入力）。予算・業績指標の基準 */
  netSales: number;
  /** 総売上・税込（独立入力）。net から逆算せず、入力値をそのまま使う */
  grossSales: number;
  /** 店舗マスタのサービス料率（0.10 = 10%） */
  serviceFeeRate: number;
  /** 国マスタの税率（0.07 = 7%） */
  taxRate: number;
  /** 国マスタの課税ベース */
  taxBase: TaxBase;
  /** 客数 */
  customerCount: number;
  /**
   * サービス料込みモード（既定 false=「別」＝従来）。
   * true=「込み」：入力税抜額には既にサービス料が含まれる。本体を分離して net_sales に保存する。
   */
  serviceFeeIncluded?: boolean;
};

/**
 * 客単価 = 総売上（税込・独立入力）÷ 客数。
 * 客数0、または総売上0以下のときは null。
 */
export function calcAvgPerCustomer(grossSales: number, customerCount: number): number | null {
  if (customerCount <= 0 || grossSales <= 0) return null;
  return round2(grossSales / customerCount);
}

/**
 * net_sales（税抜）を主入力とした順計算（data_model_v1.7 §8.1 を正典とする）。
 *
 *   service_fee = net_sales × service_fee_rate
 *   tax_amount  = net_sales × tax_rate                      （taxBase = 'net_sales'：タイ）
 *               = (net_sales + service_fee) × tax_rate       （taxBase = 'net_plus_service'：インドネシア）
 *   avg_per_customer = gross_sales ÷ customer_count          （分子は税込）
 *
 * gross_sales（税込）は独立入力。入力値をそのまま保持し、net からは逆算しない。
 * 旧 divisor=(1+service)(1+tax) のインドネシア方式ハードコード逆算は撤廃。
 *
 * モード（serviceFeeIncluded）：
 *  - false（既定・「別」＝従来）：入力税抜をそのまま net_sales とし、service_fee=net×料率 を上乗せ。
 *    ＝従来式と完全同一（既存行は全て false 固定のため過去は不変）。
 *  - true（「込み」）：入力税抜額に既にサービス料が含まれる。
 *      本体 = 入力 ÷ (1 + 料率)、service_fee = 入力 − 本体、net_sales には【本体】を保存。
 *      課税ベースは net_plus_service なら 本体+service(=入力全体)、net_sales なら 本体のみ。
 */
export function calculateSales(input: CalculateSalesInput): SalesCalculation {
  const { netSales, grossSales, serviceFeeRate, taxRate, taxBase, customerCount } = input;
  const serviceFeeIncluded = input.serviceFeeIncluded ?? false;

  const entered = netSales > 0 ? netSales : 0; // 入力された税抜額
  const gross = grossSales > 0 ? grossSales : 0;

  let net: number; // 保存する net_sales（本体）
  let serviceFee: number;
  if (serviceFeeIncluded) {
    // 「込み」：本体を分離。net_sales=本体・service_fee=入力−本体。
    net = round2(entered / (1 + serviceFeeRate));
    serviceFee = round2(entered - net);
  } else {
    // 「別」：従来式（入力をそのまま net とし、service を上乗せ算出）
    net = round2(entered);
    serviceFee = round2(net * serviceFeeRate);
  }

  const taxableBase = taxBase === 'net_plus_service' ? net + serviceFee : net;
  const taxAmount = round2(taxableBase * taxRate);

  return {
    net_sales: net,
    service_fee: serviceFee,
    tax_amount: taxAmount,
    gross_sales: round2(gross), // 独立入力値をそのまま（逆算しない）
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
