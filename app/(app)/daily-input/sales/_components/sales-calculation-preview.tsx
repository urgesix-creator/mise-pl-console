'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { calculateSales, grossNetDigitWarning, calcAvgPerCustomer } from '../_schemas';
import type { TaxBase } from '@/types/database';

type SalesCalculationPreviewProps = {
  netSales: number; // 主入力（税抜）
  grossSales: number; // 独立入力（税込）
  customerCount: number;
  serviceFeeRate: number;
  taxRate: number;
  taxBase: TaxBase;
  taxLabel: string;
  currencyCode: string;
  /** サービス料込みモード（true=込み）。プレビュー計算を保存時と一致させる */
  serviceFeeIncluded?: boolean;
};

function formatMoney(n: number, decimals = 0): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(rate: number): string {
  return (rate * 100).toFixed(rate < 0.1 ? 2 : 1);
}

export function SalesCalculationPreview({
  netSales,
  grossSales,
  customerCount,
  serviceFeeRate,
  taxRate,
  taxBase,
  taxLabel,
  currencyCode,
  serviceFeeIncluded = false,
}: SalesCalculationPreviewProps) {
  const calc = useMemo(
    () =>
      calculateSales({
        netSales,
        grossSales,
        serviceFeeRate,
        taxRate,
        taxBase,
        customerCount,
        serviceFeeIncluded,
      }),
    [netSales, grossSales, serviceFeeRate, taxRate, taxBase, customerCount, serviceFeeIncluded],
  );

  // 客単価（参考・表示のみ）。
  //   税込：総売上（税込）÷ 客数（calculateSales が算出済み）
  //   税抜：ネットセールス（税抜）÷ 客数（メニュー表が税抜表示のため併記）
  const avgPerCustomer = calc.avg_per_customer;
  const avgPerCustomerNet = calcAvgPerCustomer(netSales, customerCount);

  // 整合性は「桁違い警告」のみ（data_model_v1.7 §8.1.1）。保存はブロックしない
  const digitWarning = useMemo(
    () => grossNetDigitWarning(grossSales, netSales),
    [grossSales, netSales],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
        <div className="w-6 h-px bg-slate-300" />
        <span>Real-time Calculation Preview</span>
      </div>

      <Row
        label="税抜売上（主入力）"
        labelEn="Net Sales"
        value={formatMoney(calc.net_sales)}
        unit={currencyCode}
        tone="primary"
      />

      <Row
        label="サービス料"
        labelEn={`Service ${formatPercent(serviceFeeRate)}%`}
        value={formatMoney(calc.service_fee)}
        unit={currencyCode}
        tone="secondary"
      />

      <Row
        label={taxLabel || '税額'}
        labelEn={`Tax ${formatPercent(taxRate)}%`}
        value={formatMoney(calc.tax_amount)}
        unit={currencyCode}
        tone="secondary"
      />

      <div className="h-px bg-slate-200" />

      <Row
        label="総売上（税込・入力値）"
        labelEn="Gross Sales (input)"
        value={formatMoney(calc.gross_sales)}
        unit={currencyCode}
        tone="total"
      />

      {digitWarning.warn && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 font-medium">
          ⚠️ {digitWarning.message}
        </div>
      )}

      {avgPerCustomer !== null && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 mt-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            参考 · 客単価
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-slate-500">税込（総売上÷客数）</span>
            <span className="font-num font-bold text-lg text-slate-900">
              {formatMoney(avgPerCustomer, 0)}
              <span className="text-xs text-slate-500 font-normal ml-1">{currencyCode}/人</span>
            </span>
          </div>
          {avgPerCustomerNet !== null && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-500">税抜（ネット÷客数）</span>
              <span className="font-num font-bold text-lg text-slate-900">
                {formatMoney(avgPerCustomerNet, 0)}
                <span className="text-xs text-slate-500 font-normal ml-1">{currencyCode}/人</span>
              </span>
            </div>
          )}
          <div className="text-[10px] text-slate-400">
            ※ 表示のみ。DBには保存しません。メニュー表は税抜表示のため税抜客単価も併記。
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  labelEn,
  value,
  unit,
  tone,
}: {
  label: string;
  labelEn: string;
  value: string;
  unit: string;
  tone: 'primary' | 'secondary' | 'total';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div
          className={cn(
            'text-sm',
            tone === 'total' ? 'font-bold text-slate-900' : 'text-slate-700',
          )}
        >
          {label}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {labelEn}
        </div>
      </div>
      <div className="text-right">
        <span
          className={cn(
            'font-num font-bold',
            tone === 'total'
              ? 'text-2xl text-slate-900'
              : tone === 'primary'
                ? 'text-xl text-slate-900'
                : 'text-base text-slate-700',
          )}
        >
          {value}
        </span>
        <span className="text-xs text-slate-500 ml-1.5">{unit}</span>
      </div>
    </div>
  );
}
