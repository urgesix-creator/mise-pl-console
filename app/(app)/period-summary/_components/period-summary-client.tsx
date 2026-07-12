'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronRight,
  CalendarRange,
  Coins,
  AlertTriangle,
  Layers,
  Download,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, getAchievementBadgeClass } from '@/lib/business';
import { base64ToUint8Array } from '@/lib/xlsx-utils';
import type { GroupTotal } from '@/lib/period-summary/aggregate';
import type { PeriodSummaryResult, PeriodSummaryRow } from '../actions';
import { exportPeriodSummary } from '../_lib/period-export-actions';
import type { PeriodExportRow, PeriodExportTotal } from '../_lib/period-export';

const GROUP_ALL = '__all__';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** base64(.xlsx) を Blob 化してダウンロード（既存PL/予算エクスポートと同方式・DOM操作） */
function downloadBase64Xlsx(base64: string, filename: string): void {
  const blob = new Blob([base64ToUint8Array(base64)], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type AbsKey = 'netSales' | 'grossProfit' | 'marginProfit' | 'closingInventory';

type Props = {
  start: string;
  end: string;
  rangeError: string | null;
  result: PeriodSummaryResult | null;
  currencySymbols: Record<string, string>;
  groups: { id: string; name: string }[];
  stores: { id: string; name: string }[];
  selectedGroupId: string | null;
  selectedStoreId: string | null;
};

export function PeriodSummaryClient({
  start,
  end,
  rangeError,
  result,
  currencySymbols,
  groups,
  stores,
  selectedGroupId,
  selectedStoreId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jpyMode, setJpyMode] = useState(false);

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
    const q = params.toString();
    router.replace(q ? `?${q}` : '?', { scroll: false });
  };
  const updateRange = (key: 'start' | 'end', value: string) => {
    if (!value) return;
    updateParam(key, value);
  };

  const rows = result && result.success ? result.rows : [];
  const fetchError = result && !result.success ? result.error : null;
  const appliedRates = result && result.success ? result.appliedRates : [];
  const missingRateCurrencies = result && result.success ? result.missingRateCurrencies : [];
  const groupTotal = result && result.success ? result.groupTotal : null;
  const noMembers = selectedGroupId !== null && !rangeError && !fetchError && rows.length === 0;

  const [isExporting, startExport] = useTransition();

  // 画面に表示中の値をそのまま Excel 入力に変換（再クエリ・再計算なし＝画面と完全一致）
  const handleExport = () => {
    if (rows.length === 0) {
      toast.error('出力できるデータがありません');
      return;
    }

    // 各行：通貨モードに応じて画面と同じ値を採用（円換算は画面と同じく Math.round）
    const shown = (localVal: number, jpyVal: number | null): number | null =>
      jpyMode ? (jpyVal === null ? null : Math.round(jpyVal)) : localVal;

    const exportRows: PeriodExportRow[] = rows.map((r) => {
      const m = r.metrics;
      const notes: string[] = [];
      if (!m.hasAnyInventory) notes.push('棚卸未入力（在庫0で計算）');
      if (jpyMode && r.jpy === null) notes.push('レート未登録');
      return {
        storeNo: r.storeNo,
        name: r.name,
        currencySymbol: jpyMode ? '¥' : currencySymbols[r.currencyId] ?? r.currencyId.toUpperCase(),
        netSales: shown(m.netSales, r.jpy?.netSales ?? null),
        budgetPct: m.budgetPct,
        grossMarginPct: m.grossMarginPct,
        marginPct: m.marginPct,
        grossProfit: shown(m.grossProfit, r.jpy?.grossProfit ?? null),
        marginProfit: shown(m.marginProfit, r.jpy?.marginProfit ?? null),
        closingInventory: shown(m.closingInventory, r.jpy?.closingInventory ?? null),
        note: notes.join(' ／ '),
      };
    });

    // グループ合計行（画面の computeGroupTotal 結果をそのまま）
    let total: PeriodExportTotal | null = null;
    if (groupTotal) {
      const tAmt = (key: AbsKey): number | null => {
        if (jpyMode) return groupTotal.jpy ? Math.round(groupTotal.jpy[key]) : null;
        return groupTotal.local ? groupTotal.local[key] : null;
      };
      const note = jpyMode
        ? groupTotal.jpy
          ? ''
          : '一部店舗のレート未登録のため円換算できません'
        : groupTotal.local
          ? ''
          : '通貨が混在するため円換算でご覧ください';
      total = {
        memberCount: groupTotal.memberCount,
        currencySymbol: jpyMode
          ? '¥'
          : groupTotal.sameCurrencyId
            ? currencySymbols[groupTotal.sameCurrencyId] ?? groupTotal.sameCurrencyId.toUpperCase()
            : '',
        netSales: tAmt('netSales'),
        budgetPct: groupTotal.budgetPct,
        grossMarginPct: groupTotal.grossMarginPct,
        marginPct: groupTotal.marginPct,
        grossProfit: tAmt('grossProfit'),
        marginProfit: tAmt('marginProfit'),
        closingInventory: tAmt('closingInventory'),
        note,
      };
    }

    const groupName = selectedStoreId
      ? stores.find((s) => s.id === selectedStoreId)?.name ?? '全店舗'
      : selectedGroupId
        ? groups.find((g) => g.id === selectedGroupId)?.name ?? '全店舗'
        : '全店舗';

    startExport(async () => {
      const res = await exportPeriodSummary({
        rows: exportRows,
        total,
        meta: {
          start,
          end,
          groupName,
          currencyMode: jpyMode ? 'jpy' : 'local',
          appliedRates: appliedRates.map((r) => ({ code: r.currencyId.toUpperCase(), rate: r.rate })),
        },
      });
      if (res.success) {
        downloadBase64Xlsx(res.base64Xlsx, res.filename);
        toast.success('Excelを出力しました');
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">業務</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">期間集計</span>
      </nav>

      {/* Header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Cross-Store · Period Summary</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
          店舗別 期間集計
        </h1>
        <p className="text-sm text-slate-600">
          指定期間の売上・予算比・粗利・差益・棚卸額を店舗横断で一覧（すべて税抜net・月次PLと同じ概念）
        </p>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="start" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CalendarRange className="w-3 h-3" /> 開始日
          </label>
          <input
            id="start"
            type="date"
            value={start}
            max={end}
            onChange={(e) => updateRange('start', e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-num focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
        </div>
        <div className="text-slate-400 pb-2.5">〜</div>
        <div className="space-y-1.5">
          <label htmlFor="end" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            終了日
          </label>
          <input
            id="end"
            type="date"
            value={end}
            min={start}
            onChange={(e) => updateRange('end', e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-num focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
        </div>

        {/* Group filter */}
        <div className="space-y-1.5">
          <label htmlFor="group" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> グループ
          </label>
          <select
            id="group"
            value={selectedStoreId ? `store:${selectedStoreId}` : selectedGroupId ?? GROUP_ALL}
            onChange={(e) => updateParam('group', e.target.value === GROUP_ALL ? null : e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          >
            <option value={GROUP_ALL}>全店舗</option>
            {stores.length > 0 && (
              <optgroup label="各店舗">
                {stores.map((s) => (
                  <option key={s.id} value={`store:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {groups.length > 0 && (
              <optgroup label="グループ">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="flex-1" />

        {/* JPY toggle */}
        <button
          type="button"
          onClick={() => setJpyMode((v) => !v)}
          className={cn(
            'h-10 inline-flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors',
            jpyMode
              ? 'border-slate-900 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
          )}
        >
          <Coins className="w-4 h-4" />
          {jpyMode ? '円換算で表示中' : '円換算で表示'}
        </button>

        {/* Excel export */}
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || rows.length === 0}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Excel出力
        </button>
      </div>

      {/* JPY note */}
      {jpyMode && (
        <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">円換算（最新レート・月末レート方式）：</span>{' '}
          {appliedRates.length > 0
            ? appliedRates.map((r) => `${r.currencyId.toUpperCase()} ¥${r.rate}`).join(' / ')
            : 'レート未登録'}
          {missingRateCurrencies.length > 0 && (
            <span className="text-rose-600">
              {' '}／ レート未登録: {missingRateCurrencies.map((c) => c.toUpperCase()).join(', ')}（該当店は—）
            </span>
          )}
        </div>
      )}

      {/* Errors */}
      {rangeError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {rangeError}
        </div>
      )}
      {fetchError && !rangeError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Table（PC・md以上。表示は従来どおり不変） */}
      {!rangeError && !fetchError && (
        <div className="hidden md:block rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-slate-50 z-10">店舗</th>
                  <th className="text-right font-semibold px-4 py-3">売上額</th>
                  <th className="text-right font-semibold px-4 py-3">予算比</th>
                  <th className="text-right font-semibold px-4 py-3">粗利率</th>
                  <th className="text-right font-semibold px-4 py-3">差益率</th>
                  <th className="text-right font-semibold px-4 py-3">粗利の額</th>
                  <th className="text-right font-semibold px-4 py-3">差益の額</th>
                  <th className="text-right font-semibold px-4 py-3">棚卸の額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      {noMembers ? 'このグループに所属店舗がありません' : '表示できる店舗がありません'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <Row
                      key={row.storeId}
                      row={row}
                      jpyMode={jpyMode}
                      symbol={currencySymbols[row.currencyId] ?? row.currencyId.toUpperCase()}
                    />
                  ))
                )}
                {groupTotal && rows.length > 0 && (
                  <GroupTotalRow
                    total={groupTotal}
                    jpyMode={jpyMode}
                    symbol={
                      groupTotal.sameCurrencyId
                        ? currencySymbols[groupTotal.sameCurrencyId] ??
                          groupTotal.sameCurrencyId.toUpperCase()
                        : ''
                    }
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* カード（スマホ・md未満。PCには出ない） */}
      {!rangeError && !fetchError && (
        <div className="md:hidden space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              {noMembers ? 'このグループに所属店舗がありません' : '表示できる店舗がありません'}
            </div>
          ) : (
            rows.map((row) => (
              <StoreMobileCard
                key={row.storeId}
                row={row}
                jpyMode={jpyMode}
                symbol={currencySymbols[row.currencyId] ?? row.currencyId.toUpperCase()}
              />
            ))
          )}
          {groupTotal && rows.length > 0 && (
            <GroupTotalMobileCard
              total={groupTotal}
              jpyMode={jpyMode}
              symbol={
                groupTotal.sameCurrencyId
                  ? currencySymbols[groupTotal.sameCurrencyId] ?? groupTotal.sameCurrencyId.toUpperCase()
                  : ''
              }
            />
          )}
        </div>
      )}

      {/* Help */}
      <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· すべて税抜（net）ベース。粗利の額＝売上−売上原価（売上原価＝期首在庫＋期間仕入−期末在庫）。差益の額＝売上−期間仕入（棚卸を見ない）</p>
        <p>· 在庫は月次PLと同一ルール：期首在庫＝開始日前日以前の直近値／期末在庫（棚卸の額）＝終了日以前の直近値。棚卸未入力の店は在庫0で計算</p>
        <p>· 比率3列（予算比・粗利率・差益率）は通貨非依存。絶対額は既定で各店の現地通貨。「円換算」で全店をJPY統一表示</p>
        <p>· 「グループ」で店舗グループを選ぶと、所属店舗だけに絞り込み「グループ合計」行を表示します（未選択時は全有効店舗）</p>
        <p>· グループ合計の絶対額は、現地通貨表示なら同一通貨のときのみ・円換算なら全店レートが揃うときのみ算出（不能時は—＋注記）</p>
      </div>
    </div>
  );
}

function Row({
  row,
  jpyMode,
  symbol,
}: {
  row: PeriodSummaryRow;
  jpyMode: boolean;
  symbol: string;
}) {
  const m = row.metrics;
  const noInventory = !m.hasAnyInventory;

  // 絶対額の表示：現地通貨 or 円換算（レート無→—）
  const money = (local: number, jpy: number | null): string => {
    if (jpyMode) {
      return jpy === null ? '—' : `¥${formatNumber(Math.round(jpy))}`;
    }
    return `${symbol}${formatNumber(local)}`;
  };

  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3 sticky left-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <span className="font-num text-[11px] font-bold tracking-wider text-slate-900 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
            {String(row.storeNo).padStart(3, '0')}
          </span>
          <span className="font-medium text-slate-900 truncate max-w-[220px]">{row.name}</span>
          {!jpyMode && (
            <span className="text-[10px] text-slate-400 font-num">{row.currencyId.toUpperCase()}</span>
          )}
        </div>
        {noInventory && (
          <div className="mt-1 text-[10px] text-amber-600 font-medium">棚卸未入力（在庫0で計算）</div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-num text-slate-900">
        {money(m.netSales, row.jpy?.netSales ?? null)}
      </td>
      <td className="px-4 py-3 text-right">
        {m.budgetPct === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span
            className={cn(
              'inline-block font-num text-xs font-semibold px-2 py-0.5 rounded-full',
              getAchievementBadgeClass(m.budgetPct),
            )}
          >
            {formatPercent(m.budgetPct, 1)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-num text-slate-700">
        {m.grossMarginPct === null ? <span className="text-slate-400">—</span> : formatPercent(m.grossMarginPct, 1)}
      </td>
      <td className="px-4 py-3 text-right font-num text-slate-700">
        {m.marginPct === null ? <span className="text-slate-400">—</span> : formatPercent(m.marginPct, 1)}
      </td>
      <td className="px-4 py-3 text-right font-num text-slate-900">
        {money(m.grossProfit, row.jpy?.grossProfit ?? null)}
      </td>
      <td className="px-4 py-3 text-right font-num text-slate-900">
        {money(m.marginProfit, row.jpy?.marginProfit ?? null)}
      </td>
      <td className="px-4 py-3 text-right font-num text-slate-700">
        {money(m.closingInventory, row.jpy?.closingInventory ?? null)}
      </td>
    </tr>
  );
}

function MobItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-900">{children}</div>
    </div>
  );
}

/** スマホ用：1店舗＝1カード（PC表示の表と同じ値・同じ計算） */
function StoreMobileCard({
  row,
  jpyMode,
  symbol,
}: {
  row: PeriodSummaryRow;
  jpyMode: boolean;
  symbol: string;
}) {
  const m = row.metrics;
  const noInventory = !m.hasAnyInventory;
  const money = (local: number, jpy: number | null): string =>
    jpyMode ? (jpy === null ? '—' : `¥${formatNumber(Math.round(jpy))}`) : `${symbol}${formatNumber(local)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-num text-[11px] font-bold tracking-wider text-slate-900 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
          {String(row.storeNo).padStart(3, '0')}
        </span>
        <span className="font-medium text-slate-900 truncate flex-1">{row.name}</span>
        {!jpyMode && <span className="text-[10px] text-slate-400 font-num">{row.currencyId.toUpperCase()}</span>}
      </div>
      {noInventory && (
        <div className="text-[10px] text-amber-600 font-medium mb-2">棚卸未入力（在庫0で計算）</div>
      )}
      <div className="mb-3">
        <div className="text-[11px] text-slate-500">売上額</div>
        <div className="font-num text-xl font-bold text-slate-900">
          {money(m.netSales, row.jpy?.netSales ?? null)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <MobItem label="予算比">
          {m.budgetPct === null ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className={'inline-block font-num text-xs font-semibold px-2 py-0.5 rounded-full ' + getAchievementBadgeClass(m.budgetPct)}>
              {formatPercent(m.budgetPct, 1)}
            </span>
          )}
        </MobItem>
        <MobItem label="粗利率">
          <span className="font-num">{m.grossMarginPct === null ? '—' : formatPercent(m.grossMarginPct, 1)}</span>
        </MobItem>
        <MobItem label="差益率">
          <span className="font-num">{m.marginPct === null ? '—' : formatPercent(m.marginPct, 1)}</span>
        </MobItem>
        <MobItem label="棚卸の額">
          <span className="font-num">{money(m.closingInventory, row.jpy?.closingInventory ?? null)}</span>
        </MobItem>
        <MobItem label="粗利の額">
          <span className="font-num">{money(m.grossProfit, row.jpy?.grossProfit ?? null)}</span>
        </MobItem>
        <MobItem label="差益の額">
          <span className="font-num">{money(m.marginProfit, row.jpy?.marginProfit ?? null)}</span>
        </MobItem>
      </div>
    </div>
  );
}

/** スマホ用：グループ合計カード */
function GroupTotalMobileCard({
  total,
  jpyMode,
  symbol,
}: {
  total: GroupTotal;
  jpyMode: boolean;
  symbol: string;
}) {
  const money = (localVal: number | undefined, jpyVal: number | undefined): string => {
    if (jpyMode) return total.jpy ? `¥${formatNumber(Math.round(jpyVal ?? 0))}` : '—';
    return total.local ? `${symbol}${formatNumber(localVal ?? 0)}` : '—';
  };
  const note = jpyMode
    ? total.jpy
      ? null
      : '一部店舗のレート未登録のため円換算できません'
    : total.local
      ? null
      : '通貨が混在するため円換算でご覧ください';

  return (
    <div className="rounded-2xl bg-brand-600 text-white p-4">
      <div className="font-display font-bold">グループ合計（{total.memberCount}店）</div>
      {note && <div className="text-[10px] text-amber-300 font-medium mt-1">{note}</div>}
      <div className="my-3">
        <div className="text-[11px] text-slate-300">売上額</div>
        <div className="font-num text-xl font-bold">{money(total.local?.netSales, total.jpy?.netSales)}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div>
          <div className="text-[10px] text-slate-300 mb-0.5">予算比</div>
          <div className="font-num">{total.budgetPct === null ? '—' : formatPercent(total.budgetPct, 1)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-300 mb-0.5">粗利率</div>
          <div className="font-num">{total.grossMarginPct === null ? '—' : formatPercent(total.grossMarginPct, 1)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-300 mb-0.5">差益率</div>
          <div className="font-num">{total.marginPct === null ? '—' : formatPercent(total.marginPct, 1)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-300 mb-0.5">棚卸の額</div>
          <div className="font-num">{money(total.local?.closingInventory, total.jpy?.closingInventory)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-300 mb-0.5">粗利の額</div>
          <div className="font-num">{money(total.local?.grossProfit, total.jpy?.grossProfit)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-300 mb-0.5">差益の額</div>
          <div className="font-num">{money(total.local?.marginProfit, total.jpy?.marginProfit)}</div>
        </div>
      </div>
    </div>
  );
}

function GroupTotalRow({
  total,
  jpyMode,
  symbol,
}: {
  total: GroupTotal;
  jpyMode: boolean;
  symbol: string;
}) {
  // 絶対額：現地通貨は同一通貨のときのみ／円換算は全行レート揃いのときのみ。不能は—。
  const money = (localVal: number | undefined, jpyVal: number | undefined): string => {
    if (jpyMode) {
      return total.jpy ? `¥${formatNumber(Math.round(jpyVal ?? 0))}` : '—';
    }
    return total.local ? `${symbol}${formatNumber(localVal ?? 0)}` : '—';
  };

  // 絶対額が—になる理由の注記
  const note = jpyMode
    ? total.jpy
      ? null
      : '一部店舗のレート未登録のため円換算できません'
    : total.local
      ? null
      : '通貨が混在するため円換算でご覧ください';

  return (
    <tr className="bg-brand-600 text-white">
      <td className="px-4 py-3 sticky left-0 bg-brand-600 z-10">
        <div className="font-display font-bold">グループ合計</div>
        <div className="text-[10px] text-slate-300 font-medium">{total.memberCount}店</div>
        {note && <div className="mt-1 text-[10px] text-amber-300 font-medium">{note}</div>}
      </td>
      <td className="px-4 py-3 text-right font-num font-bold">
        {money(total.local?.netSales, total.jpy?.netSales)}
      </td>
      <td className="px-4 py-3 text-right font-num">
        {total.budgetPct === null ? '—' : formatPercent(total.budgetPct, 1)}
      </td>
      <td className="px-4 py-3 text-right font-num">
        {total.grossMarginPct === null ? '—' : formatPercent(total.grossMarginPct, 1)}
      </td>
      <td className="px-4 py-3 text-right font-num">
        {total.marginPct === null ? '—' : formatPercent(total.marginPct, 1)}
      </td>
      <td className="px-4 py-3 text-right font-num font-bold">
        {money(total.local?.grossProfit, total.jpy?.grossProfit)}
      </td>
      <td className="px-4 py-3 text-right font-num font-bold">
        {money(total.local?.marginProfit, total.jpy?.marginProfit)}
      </td>
      <td className="px-4 py-3 text-right font-num">
        {money(total.local?.closingInventory, total.jpy?.closingInventory)}
      </td>
    </tr>
  );
}
