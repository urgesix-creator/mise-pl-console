// ====================================================================
// 仕入先名の類似判定（重複登録の防止・確認方式）
//
//   マスタ画面・仕入入力画面の両方から使う共通ロジック（複製しない）。
//   ブロックではなく「似た名前がありますが、よろしいですか？」の確認に使う。
//   判定はシンプル：正規化後の 完全一致／前方一致／包含。あいまい一致は使わない。
// ====================================================================

/**
 * 仕入先名の正規化：
 *  - NFKC で全角／半角・互換文字の揺れを吸収
 *  - 前後空白を除去、連続空白を1つに
 *  - 大文字小文字を区別しない（小文字化）
 */
export function normalizeSupplierName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 入力名に「似ている」既存名を返す（元の表記のまま）。
 *  - 正規化後が等しい／一方が他方を含む（前方一致・包含を内包）場合に似ているとみなす。
 *  - 戻り値が空＝似たものなし。重複表記は除く。
 */
export function findSimilarNames(input: string, existing: string[]): string[] {
  const n = normalizeSupplierName(input);
  if (!n) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of existing) {
    const ne = normalizeSupplierName(e);
    if (!ne) continue;
    if (ne === n || ne.includes(n) || n.includes(ne)) {
      if (!seen.has(e)) {
        seen.add(e);
        out.push(e);
      }
    }
  }
  return out;
}
