'use client';

import type { ColoredSummaryRow } from './department-sales-chart';

type DepartmentSalesTableProps = {
  rows: ColoredSummaryRow[];
  total: number;
  currencyCode: string;
};

export function DepartmentSalesTable({ rows, total, currencyCode }: DepartmentSalesTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
          金額一覧（{currencyCode}・税込）
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_140px_88px] gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <div>部門名</div>
        <div className="text-right">累計税込売上</div>
        <div className="text-right">構成比</div>
      </div>

      {/* Rows（display_order 順） */}
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li
            key={r.department_id}
            className="grid grid-cols-[1fr_140px_88px] gap-3 px-5 py-3 items-center"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="font-medium text-slate-900 truncate">{r.name}</span>
            </div>
            <div className="text-right font-num text-slate-900">
              {r.cumulative_gross.toLocaleString()}
            </div>
            <div className="text-right font-num text-slate-700">{r.share_pct.toFixed(1)}%</div>
          </li>
        ))}
      </ul>

      {/* 合計行 */}
      <div className="grid grid-cols-[1fr_140px_88px] gap-3 px-5 py-3 items-center bg-slate-50 border-t border-slate-200">
        <div className="font-semibold text-slate-900">合計</div>
        <div className="text-right font-num font-bold text-slate-900">
          {total.toLocaleString()}
        </div>
        <div className="text-right font-num font-semibold text-slate-700">100.0%</div>
      </div>
    </div>
  );
}
