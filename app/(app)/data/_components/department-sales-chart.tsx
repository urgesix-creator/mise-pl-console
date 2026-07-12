'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import type { DepartmentSalesSummaryRow } from './types';

export type ColoredSummaryRow = DepartmentSalesSummaryRow & { color: string };

type DepartmentSalesChartProps = {
  rows: ColoredSummaryRow[];
  total: number;
  currencyCode: string;
};

/** ドーナツの各セグメントにホバーした時のツールチップ（部門名・金額・構成比） */
function ChartTooltip({
  active,
  payload,
  currencyCode,
}: TooltipProps<number, string> & { currencyCode: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ColoredSummaryRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
        {row.name}
      </div>
      <div className="mt-0.5 text-xs text-slate-600 font-num">
        {row.cumulative_gross.toLocaleString()} {currencyCode}
        <span className="ml-2 font-semibold text-slate-900">{row.share_pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function DepartmentSalesChart({ rows, total, currencyCode }: DepartmentSalesChartProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
        構成比（部門内シェア）
      </div>

      <div className="relative" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="cumulative_gross"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={108}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.department_id} fill={r.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip currencyCode={currencyCode} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* 中央：期間合計額 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            期間合計（税込）
          </div>
          <div className="font-num text-2xl font-bold text-slate-900">
            {total.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 font-num">{currencyCode}</div>
        </div>
      </div>

      {/* 凡例 */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {rows.map((r) => (
          <li key={r.department_id} className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
            <span className="font-medium">{r.name}</span>
            <span className="text-slate-500 font-num">{r.share_pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
