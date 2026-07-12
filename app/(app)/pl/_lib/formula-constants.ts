// ====================================================================
// 月次PL 変動費の計算式の 定数・型（通常モジュール・'use server' なし）
//
//   - 'use server' ファイル（formula-actions.ts）からは async関数しか正しく export できないため、
//     定数（配列）・型・ラベルはこの通常tsファイルに一元化し、サーバ/クライアント双方が import する。
//   - 値は expense_formulas.calc_type の CHECK制約（018・4種）と一致させる。
// ====================================================================

/** 計算タイプ（expense_formulas.calc_type）。018 のCHECK 4種と一致 */
export const CALC_TYPES = ['percent', 'tiered', 'fixed', 'fixed_plus_percent'] as const;
export type CalcType = (typeof CALC_TYPES)[number];

/** 計算タイプの日本語ラベル（UI表示用） */
export const CALC_TYPE_LABELS: Record<CalcType, string> = {
  percent: '一律％',
  tiered: '段階制％（2段階）',
  fixed: '固定額',
  fixed_plus_percent: '固定額＋％',
};

/** 各タイプが必要とするパラメータ（バリデーション・UI表示の指針） */
export const CALC_TYPE_REQUIRED_PARAMS: Record<CalcType, ReadonlyArray<
  'rate1' | 'rate2' | 'threshold' | 'fixed_amount'
>> = {
  percent: ['rate1'],
  tiered: ['rate1', 'rate2', 'threshold'],
  fixed: ['fixed_amount'],
  fixed_plus_percent: ['fixed_amount', 'rate1'],
};
