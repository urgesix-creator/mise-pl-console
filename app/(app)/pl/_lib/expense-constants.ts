// ====================================================================
// 月次PL 販管費の区分タグ 定数・型（通常モジュール・'use server' なし）
//
//   - 'use server' ファイル（expense-actions.ts）からは async関数しか正しく export できないため、
//     定数（配列）・型・ラベルはこの通常tsファイルに一元化し、サーバ/クライアント双方が import する。
//   - 値は monthly_expenses.category_tag の CHECK制約（016・4種）と一致させる。
// ====================================================================

/** 区分タグ（monthly_expenses.category_tag）。016 のCHECK 4種と一致 */
export const CATEGORY_TAGS = ['labor', 'rent', 'depreciation', 'other'] as const;
export type CategoryTag = (typeof CATEGORY_TAGS)[number];

/** 区分タグの日本語ラベル（UI表示用） */
export const TAG_LABELS: Record<CategoryTag, string> = {
  labor: '人件費',
  rent: '家賃',
  depreciation: '減価償却',
  other: 'その他',
};
