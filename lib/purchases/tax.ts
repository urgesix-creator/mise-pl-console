// ====================================================================
// 仕入の税計算（純粋関数・DB非依存）
//
//   店舗の入力モード（税抜/税込）＋取引先の税率(%)・非課税から net/tax/gross を整合算出。
//   - 税別(excluded)：入力=net → tax=round(net×率), gross=net+tax
//   - 税込(included)：入力=gross → net=round(gross/(1+率)), tax=gross-net
//   - 非課税 or 税率0：税額0・gross=net（モード無関係）
//   端数は四捨五入（Math.round＝正値は0.5切上げ）。整数通貨(IDR等)は整数丸め。
//   ※売上の税計算(§8.1)とは無関係（仕入専用）。
// ====================================================================

export type PurchaseTaxMode = 'excluded' | 'included';

export type PurchaseTaxResult = { net: number; tax: number; gross: number };

/** 整数丸めで扱う通貨（小数を持たない）。現状 IDR（ルピア）。必要に応じ追加。 */
const INTEGER_CURRENCIES = new Set(['idr', 'vnd', 'jpy']);

export function isIntegerCurrency(currencyId: string | null | undefined): boolean {
  return INTEGER_CURRENCIES.has((currencyId ?? '').toLowerCase());
}

export function computePurchaseTax(params: {
  /** 入力値（モードに応じ net か gross） */
  input: number;
  mode: PurchaseTaxMode;
  /** 税率(%)。例 7, 11 */
  ratePercent: number;
  isExempt: boolean;
  /** 整数丸めの通貨か（IDR 等） */
  integerCurrency: boolean;
}): PurchaseTaxResult {
  const { input, mode, ratePercent, isExempt, integerCurrency } = params;
  const round = (n: number): number =>
    integerCurrency ? Math.round(n) : Math.round(n * 100) / 100; // 四捨五入

  const amount = Number.isFinite(input) ? input : 0;

  // 非課税・税率0：税額0・税込＝税抜（モード無関係）
  if (isExempt || !(ratePercent > 0)) {
    const v = round(amount);
    return { net: v, tax: 0, gross: v };
  }

  const r = ratePercent / 100;
  if (mode === 'included') {
    const gross = round(amount);
    const net = round(gross / (1 + r));
    const tax = round(gross - net);
    return { net, tax, gross };
  }
  // excluded（税別）
  const net = round(amount);
  const tax = round(net * r);
  const gross = round(net + tax);
  return { net, tax, gross };
}
