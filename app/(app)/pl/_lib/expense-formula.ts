// ====================================================================
// 月次PL 変動費の計算式 計算純関数（DB・ネットワーク非依存・副作用なし）
//
//   - 計算式の設定（calc_type・パラメータ）と その月の net_sales（税抜売上）から、
//     販管費の金額を算出する純関数。入力→出力のみ（DBアクセス・保存はしない）。
//   - 率（rate1/rate2）は小数（0.05＝5%）。金額・しきい値は現地通貨。
//   - net が null（計算不可・未来月等）のとき：
//       fixed（固定額）は net 非依存なので固定額を返す。
//       それ以外（percent/tiered/fixed_plus_percent）は net が必要なので null を返す。
//
//   ※ lib/pl（売上・原価予測）は変更しない。net は呼び出し側が lib/pl の結果を渡す。
//      税計算（§8.1）・経営データ・既存機能には触れない。
// ====================================================================

import type { Database } from '@/types/database';

/** expense_formulas の Row（018・types/database.ts）。計算に必要な項目のみを抜粋して受ける */
type ExpenseFormulaRow = Database['public']['Tables']['expense_formulas']['Row'];

/** 計算式の設定（計算に使う項目のみ。Row 全体でも構造的に受けられる） */
export type ExpenseFormulaInput = Pick<
  ExpenseFormulaRow,
  'calc_type' | 'rate1' | 'rate2' | 'threshold' | 'fixed_amount'
>;

/**
 * 計算式と net（その月の税抜売上）から販管費の金額を算出する純関数。
 *
 *  - percent            : net × rate1
 *  - tiered             : min(net, threshold) × rate1 + max(0, net − threshold) × rate2
 *  - fixed              : fixed_amount（net 非依存・net=null でも返す）
 *  - fixed_plus_percent : fixed_amount + net × rate1
 *
 * net が null かつ net に依存するタイプ（percent/tiered/fixed_plus_percent）は null（計算不可）。
 * 必要パラメータが欠落している場合も null を返す（018 の CHECK で通常は揃っているが防御的に）。
 *
 * @param formula 計算式の設定（calc_type＋パラメータ）
 * @param net その月の net_sales（税抜売上）。計算不可・未評価は null
 * @returns 金額（number）または null（計算不可）
 */
export function calcExpenseFromFormula(
  formula: ExpenseFormulaInput,
  net: number | null,
): number | null {
  switch (formula.calc_type) {
    case 'fixed': {
      // net 非依存。固定額が無ければ計算不可。
      return formula.fixed_amount ?? null;
    }
    case 'percent': {
      if (net === null || formula.rate1 === null) return null;
      return net * formula.rate1;
    }
    case 'fixed_plus_percent': {
      if (net === null || formula.rate1 === null || formula.fixed_amount === null) return null;
      return formula.fixed_amount + net * formula.rate1;
    }
    case 'tiered': {
      if (
        net === null ||
        formula.rate1 === null ||
        formula.rate2 === null ||
        formula.threshold === null
      ) {
        return null;
      }
      const lower = Math.min(net, formula.threshold) * formula.rate1;
      const upper = Math.max(0, net - formula.threshold) * formula.rate2;
      return lower + upper;
    }
    default: {
      // 想定外の calc_type（型上は到達しない）
      return null;
    }
  }
}
