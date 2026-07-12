import type { DepartmentSalesSummary } from '../_components/types';

// ====================================================================
// 部門別売上の構成比集計（純関数・データモデル設計書 v1.8 §8.8 準拠）
//
//   - cumulative = Σ gross_sales（部門ごと・期間内の累計）
//   - total      = Σ 全部門の cumulative
//   - share_pct  = cumulative ÷ total × 100（total > 0 のときのみ。合計100%）
//   - INNER JOIN 相当：明細のある部門のみ対象。売上0（累計0）の部門は出さない。
//   - 無効部門（is_active=false）も、明細が渡されれば含める（呼び出し側で is_active 除外しない）。
//   - daily_sales（経営データ）は一切参照しない。
//
// 本関数は Supabase に依存しない純関数（テスト容易・将来 RPC/ビューへ差替可）。
// ====================================================================

/** 明細（daily_department_sales の1行）。gross_sales は number / 文字列 / null を許容し内部で数値化 */
export type DepartmentSaleRow = {
  department_id: string;
  gross_sales: number | string | null;
};

/** 部門マスタ（名称・表示順の解決用） */
export type DepartmentMeta = {
  id: string;
  name: string;
  display_order: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function aggregateDepartmentSales(
  salesRows: DepartmentSaleRow[],
  departments: DepartmentMeta[],
): DepartmentSalesSummary {
  const metaById = new Map(departments.map((d) => [d.id, d]));

  // 部門ごとに累計（raw）
  const cumulativeById = new Map<string, number>();
  for (const r of salesRows) {
    const amt = Number(r.gross_sales ?? 0);
    if (!Number.isFinite(amt)) continue;
    cumulativeById.set(r.department_id, (cumulativeById.get(r.department_id) ?? 0) + amt);
  }

  // 売上0（累計0以下）の部門は出さない（INNER JOIN相当の対象から除外）
  const entries = [...cumulativeById.entries()].filter(([, amt]) => amt > 0);

  // 全部門の累計合計（分母）
  const total = entries.reduce((sum, [, amt]) => sum + amt, 0);

  const rows = entries
    .map(([id, amt]) => {
      const meta = metaById.get(id);
      return {
        department_id: id,
        name: meta?.name ?? '(不明な部門)',
        display_order: meta?.display_order ?? Number.MAX_SAFE_INTEGER,
        cumulative_gross: round2(amt),
        // total > 0 が保証される（entries は amt>0 のみ）
        share_pct: total > 0 ? round1((amt / total) * 100) : 0,
      };
    })
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  return {
    rows,
    total: round2(total),
    hasData: rows.length > 0 && total > 0,
  };
}
