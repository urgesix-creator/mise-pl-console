'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ChevronLeft, Store as StoreIcon, Package, Loader2, CalendarDays } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/business';
import type { PurchaseGroup, StoreOption } from './types';
import { getSupplierDailyPurchases, type SupplierDailyResult } from '../actions';

type Props = {
  stores: StoreOption[];
  selectedStoreId: string | null;
  currencyCode: string;
  fyStartYear: number;
  fyLabel: string;
  monthLabels: string[];
  monthKeys: string[];
  groups: PurchaseGroup[];
};

const WEEKDAY_JA = '日月火水木金土';
function weekdayInfo(dateISO: string): { label: string; color: string } {
  const d = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  const color = d === 0 ? 'text-rose-600' : d === 6 ? 'text-blue-600' : 'text-slate-400';
  return { label: WEEKDAY_JA[d], color };
}

const COST_TYPE_LABEL: Record<'cogs' | 'sga', string> = {
  cogs: '売上原価',
  sga: '販管費（PL販管費へ手入力する参考値）',
};

export function PurchaseSummaryClient({
  stores,
  selectedStoreId,
  currencyCode,
  fyStartYear,
  fyLabel,
  monthLabels,
  monthKeys,
  groups,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // 日別内訳ダイアログ：取引先（行）×対象月（列）をクリックで開く
  const [detail, setDetail] = useState<{ supplierName: string; monthLabel: string } | null>(null);
  const [detailData, setDetailData] = useState<SupplierDailyResult | null>(null);
  const [detailPending, startDetail] = useTransition();

  const openDetail = (supplierId: string, supplierName: string, monthIndex: number) => {
    if (!selectedStoreId) return;
    const yearMonth = monthKeys[monthIndex];
    if (!yearMonth) return;
    setDetail({ supplierName, monthLabel: monthLabels[monthIndex] ?? yearMonth });
    setDetailData(null);
    startDetail(async () => {
      const res = await getSupplierDailyPurchases(selectedStoreId, supplierId, yearMonth);
      setDetailData(res);
    });
  };

  if (stores.length === 0 || !selectedStoreId) {
    return (
      <div className="px-5 sm:px-8 py-20 max-w-xl mx-auto text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">仕入先別 仕入集計</h1>
        <p className="text-sm text-slate-600">アクセス可能な店舗がありません。</p>
      </div>
    );
  }

  const monthCount = monthLabels.length;
  const hasAnyRow = groups.some((g) => g.rows.length > 0);

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-[1500px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">業務</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">仕入先別 仕入集計</span>
      </nav>

      {/* Header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Purchases by Supplier</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
          仕入先別 仕入集計
        </h1>
        <p className="text-sm text-slate-600">
          仕入先ごとの月別仕入額（会計年度12ヶ月）。売上原価・販管費の区分でグループ表示します。
        </p>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <StoreIcon className="w-3 h-3" /> 店舗
          </label>
          {stores.length > 1 ? (
            <Select value={selectedStoreId} onValueChange={(v) => updateParam('store', v)}>
              <SelectTrigger className="h-10 w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {String(s.store_no).padStart(3, '0')} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 flex items-center font-display text-base font-bold text-slate-900">
              {stores[0].name}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            会計年度
          </label>
          <div className="h-10 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => updateParam('fy', String(fyStartYear - 1))}
              aria-label="前年度"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-display text-sm font-bold text-slate-900 min-w-[150px] text-center">
              {fyLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => updateParam('fy', String(fyStartYear + 1))}
              aria-label="翌年度"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1" />
        <div className="text-xs text-slate-500 pb-2.5">金額単位：{currencyCode}（現地通貨）</div>
      </div>

      {/* Table */}
      {!hasAnyRow ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Package className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-sm text-slate-500">この年度に仕入先・仕入データがありません</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="sm:hidden px-4 py-2 text-[11px] text-slate-400 border-b border-slate-100">
            ← 横にスクロールできます →
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-semibold px-4 py-3 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                    仕入先
                  </th>
                  <th className="text-left font-semibold px-3 py-3 min-w-[110px]">カテゴリ</th>
                  {monthLabels.map((m) => (
                    <th key={m} className="text-right font-semibold px-3 py-3 font-num min-w-[88px]">
                      {m}
                    </th>
                  ))}
                  <th className="text-right font-semibold px-4 py-3 min-w-[110px]">年間計</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) =>
                  g.rows.length === 0 ? null : (
                    <GroupSection
                      key={g.costType}
                      group={g}
                      monthCount={monthCount}
                      onOpenDetail={openDetail}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· 行＝仕入先（区分でグループ化）・列＝会計年度の各月＋年間計。金額は現地通貨。</p>
        <p>· <strong>売上原価</strong>区分の仕入が粗利・差益・月次PLの売上原価に算入されます。</p>
        <p>· <strong>販管費</strong>区分は売上原価から除外。月次PLの販管費へは自動合算されないため、この<strong>小計（参考値）</strong>を見て月次PLに手入力してください。</p>
        <p>· 区分は「仕入先マスタ」で変更できます。無効化された仕入先も、当年度に仕入があれば表示されます。</p>
        <p>· <strong>月の金額セルをクリック</strong>すると、その仕入先・その月の<strong>日別内訳（1日〜月末）</strong>を表示します。</p>
      </div>

      {/* 日別内訳ダイアログ（取引先×対象月） */}
      <Dialog
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDetail(null);
            setDetailData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Daily Breakdown
            </div>
            <DialogTitle className="font-display text-lg font-bold">
              {detail?.supplierName}
            </DialogTitle>
            <DialogDescription>
              {detail?.monthLabel} の日別仕入額（1日〜月末）・単位 {currencyCode}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {detailPending ? (
              <div className="py-12 flex items-center justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : detailData && detailData.success ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-semibold py-2 w-16">日</th>
                    <th className="text-right font-semibold py-2">仕入額</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.days.map((d) => {
                    const w = weekdayInfo(d.date);
                    return (
                      <tr key={d.date} className="border-b border-slate-100">
                        <td className="py-2 text-slate-700 font-num">
                          {d.day}
                          <span className={cn('ml-1.5 text-xs', w.color)}>{w.label}</span>
                        </td>
                        <td className="py-2 text-right font-num text-slate-800">
                          {d.amount === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            formatNumber(d.amount)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300">
                    <td className="py-2.5 font-bold text-slate-900">月計</td>
                    <td className="py-2.5 text-right font-num font-bold text-slate-900">
                      {detailData.total === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        formatNumber(detailData.total)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : detailData && !detailData.success ? (
              <div className="py-8 text-center text-sm text-rose-600">{detailData.error}</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupSection({
  group,
  monthCount,
  onOpenDetail,
}: {
  group: PurchaseGroup;
  monthCount: number;
  onOpenDetail: (supplierId: string, supplierName: string, monthIndex: number) => void;
}) {
  const isSga = group.costType === 'sga';
  return (
    <>
      {/* Group header */}
      <tr className={cn('border-t border-slate-200', isSga ? 'bg-amber-50/60' : 'bg-slate-100/70')}>
        <td
          colSpan={2 + monthCount + 1}
          className={cn(
            'px-4 py-2 sticky left-0 text-[11px] font-bold uppercase tracking-wider',
            isSga ? 'text-amber-800 bg-amber-50/60' : 'text-slate-700 bg-slate-100/70',
          )}
        >
          {COST_TYPE_LABEL[group.costType]}
        </td>
      </tr>

      {/* Supplier rows */}
      {group.rows.map((r) => (
        <tr key={r.supplierId} className="border-b border-slate-100 hover:bg-slate-50/60">
          <td className="px-4 py-2.5 sticky left-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <span className={cn('font-medium truncate max-w-[200px]', r.isActive ? 'text-slate-900' : 'text-slate-400')}>
                {r.supplierName}
              </span>
              {!r.isActive && <span className="text-[10px] text-rose-600">停止中</span>}
            </div>
          </td>
          <td className="px-3 py-2.5 text-slate-500 text-xs">{r.categoryName}</td>
          {r.monthly.map((v, i) => (
            <td key={i} className="px-1 py-1 text-right">
              <button
                type="button"
                onClick={() => onOpenDetail(r.supplierId, r.supplierName, i)}
                title="日別内訳を見る"
                className="w-full px-2 py-1.5 rounded text-right font-num text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                {v === 0 ? <span className="text-slate-300">—</span> : formatNumber(v)}
              </button>
            </td>
          ))}
          <td className="px-4 py-2.5 text-right font-num font-semibold text-slate-900">
            {r.yearTotal === 0 ? <span className="text-slate-300">—</span> : formatNumber(r.yearTotal)}
          </td>
        </tr>
      ))}

      {/* Subtotal */}
      <tr className={cn('border-b-2', isSga ? 'border-amber-200 bg-amber-50' : 'border-slate-300 bg-slate-50')}>
        <td className={cn('px-4 py-2.5 sticky left-0 font-bold text-slate-900', isSga ? 'bg-amber-50' : 'bg-slate-50')}>
          {isSga ? '小計（販管費・参考値）' : '小計（売上原価）'}
        </td>
        <td className={cn('px-3 py-2.5', isSga ? 'bg-amber-50' : 'bg-slate-50')} />
        {group.monthlySubtotal.map((v, i) => (
          <td key={i} className="px-3 py-2.5 text-right font-num font-semibold text-slate-900">
            {v === 0 ? <span className="text-slate-300">—</span> : formatNumber(v)}
          </td>
        ))}
        <td className="px-4 py-2.5 text-right font-num font-bold text-slate-900">
          {formatNumber(group.yearSubtotal)}
        </td>
      </tr>
    </>
  );
}
