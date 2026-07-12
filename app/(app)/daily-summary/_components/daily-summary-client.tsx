'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
} from 'recharts';
import { ChevronRight, CalendarDays, LineChart as LineChartIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

export type StoreLite = { id: string; name: string; currency: string };
export type DailyRow = {
  date: string; // YYYY-MM-DD
  net: number;
  gross: number;
  customers: number;
  avgNet: number | null;
  isClosed: boolean;
};

function fmt(n: number): string {
  return n.toLocaleString('ja-JP');
}
function dayOfMonth(date: string): string {
  return String(Number(date.slice(8, 10)));
}
function weekdayJa(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return '日月火水木金土'[d.getUTCDay()];
}

// グラフX軸の目盛り：日付（上段）の下に曜日（下段）を表示。日=朱・土=青で色分け。
function DayAxisTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string | number };
  dowByDay: Map<string, string>;
}) {
  const { x = 0, y = 0, payload, dowByDay } = props;
  const day = String(payload?.value ?? '');
  const dow = dowByDay.get(day) ?? '';
  const dowColor = dow === '日' ? '#f43f5e' : dow === '土' ? '#3b82f6' : '#94a3b8';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} dy={12} textAnchor="middle" fontSize={11} fill="#64748b">
        {day}
      </text>
      <text x={0} dy={25} textAnchor="middle" fontSize={10} fill={dowColor}>
        {dow}
      </text>
    </g>
  );
}

export function DailySummaryClient({
  stores,
  selectedStoreId,
  currency,
  month,
  rows,
}: {
  stores: StoreLite[];
  selectedStoreId: string | null;
  currency: string;
  month: string;
  rows: DailyRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const totals = useMemo(() => {
    const net = rows.reduce((s, r) => s + r.net, 0);
    const gross = rows.reduce((s, r) => s + r.gross, 0);
    const customers = rows.reduce((s, r) => s + r.customers, 0);
    return { net, gross, customers, avgNet: customers > 0 ? Math.round(net / customers) : null };
  }, [rows]);

  const chartData = useMemo(
    () => rows.map((r) => ({ day: dayOfMonth(r.date), dow: weekdayJa(r.date), 税抜売上: r.net, 客数: r.customers })),
    [rows],
  );

  // X軸の「日付の下の曜日」用：日→曜日の対応表（日=朱・土=青で色分け）
  const dowByDay = useMemo(() => {
    const m = new Map<string, string>();
    chartData.forEach((d) => m.set(d.day, d.dow));
    return m;
  }, [chartData]);

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">業務</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">日別売上</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <CalendarDays className="w-7 h-7 text-slate-700" />
          日別売上
        </h1>
        <p className="text-sm text-slate-600">店舗・月を選んで、日別の売上・客数・客単価（税抜）と推移グラフを表示します（税抜・現地通貨）。</p>
      </div>

      {/* セレクタ */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="space-y-1">
          <Label className="text-xs text-slate-600">店舗</Label>
          <select
            value={selectedStoreId ?? ''}
            onChange={(e) => updateParam('store', e.target.value)}
            className="block w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 outline-none"
          >
            {stores.length === 0 && <option value="">店舗がありません</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-600">月</Label>
          <input
            type="month"
            value={month}
            onChange={(e) => updateParam('month', e.target.value)}
            className="block rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 outline-none font-num"
          />
        </div>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="税抜売上 合計" value={`${currency}${fmt(totals.net)}`} />
        <SummaryCard label="税込売上 合計" value={`${currency}${fmt(totals.gross)}`} />
        <SummaryCard label="客数 合計" value={fmt(totals.customers)} />
        <SummaryCard label="客単価（税抜・平均）" value={totals.avgNet === null ? '—' : `${currency}${fmt(totals.avgNet)}`} />
      </div>

      {/* グラフ（#8） */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-5">
        <div className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <LineChartIcon className="w-4 h-4 text-slate-600" />
          推移（税抜売上 / 客数）
        </div>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-400">データがありません</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" height={34} tickLine={false} tick={<DayAxisTick dowByDay={dowByDay} />} />
                <YAxis yAxisId="sales" tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                <YAxis yAxisId="cust" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="sales" dataKey="税抜売上" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line yAxisId="cust" type="monotone" dataKey="客数" stroke="#f43f5e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 日別一覧（#7） */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">日付</th>
              <th className="px-3 py-3 font-semibold text-right">税抜売上</th>
              <th className="px-3 py-3 font-semibold text-right">税込売上</th>
              <th className="px-3 py-3 font-semibold text-right">客数</th>
              <th className="px-3 py-3 font-semibold text-right">客単価(税抜)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                  この月の入力データはありません。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.date} className={r.isClosed ? 'bg-slate-50/60' : 'hover:bg-slate-50/60'}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-num text-slate-900">{dayOfMonth(r.date)}日</span>
                    <span className="text-[11px] text-slate-400 ml-1">({weekdayJa(r.date)})</span>
                    {r.isClosed && <span className="ml-2 text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">店休</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-num text-slate-900">{currency}{fmt(r.net)}</td>
                  <td className="px-3 py-2.5 text-right font-num text-slate-600">{currency}{fmt(r.gross)}</td>
                  <td className="px-3 py-2.5 text-right font-num text-slate-600">{fmt(r.customers)}</td>
                  <td className="px-3 py-2.5 text-right font-num text-slate-600">{r.avgNet === null ? '—' : `${currency}${fmt(Math.round(r.avgNet))}`}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-4 py-3">合計 / 平均</td>
                <td className="px-3 py-3 text-right font-num text-slate-900">{currency}{fmt(totals.net)}</td>
                <td className="px-3 py-3 text-right font-num text-slate-900">{currency}{fmt(totals.gross)}</td>
                <td className="px-3 py-3 text-right font-num text-slate-900">{fmt(totals.customers)}</td>
                <td className="px-3 py-3 text-right font-num text-slate-900">{totals.avgNet === null ? '—' : `${currency}${fmt(totals.avgNet)}`}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-4 px-1 text-[11px] text-slate-400">· 金額は税抜・税込ともに現地通貨。客単価は税抜（ネット÷客数）。day_period='all' の入力を対象。</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className="font-num text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm text-xs">
      <div className="font-semibold text-slate-900 mb-1">{label}日</div>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.dataKey}</span>
          <span className="font-num font-semibold text-slate-900">
            {p.dataKey === '税抜売上' ? `${currency}${fmt(Number(p.value))}` : fmt(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}
