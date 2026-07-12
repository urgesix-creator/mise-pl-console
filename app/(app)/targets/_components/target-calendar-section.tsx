'use client';

// ====================================================================
// 売上予算 カレンダー手入力セクション
//
//   - 店舗×月を選び、その月の日別予算（税抜）をカレンダー型で表示・入力。
//   - 既存 daily_targets の値を全日にプリフィル（1日だけ直して保存しても他日は消えない）。
//   - 保存：その月の全日を upsertMonthlyTargets で UPSERT（空欄=0・上書き・DELETEなし）。
//   - 店舗/月は URL state（?store, ?month）で保持。0 の日は視覚区別（表示のみ）。
// ====================================================================

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Moon,
  Save,
  Store as StoreIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AmountInput } from '@/app/(app)/daily-input/sales/_components/amount-input';
import { useGridNavigation } from '@/hooks/use-grid-navigation';
import { cn } from '@/lib/utils';
import { upsertMonthlyTargets } from '../_lib/target-input-actions';
import { setClosedDay } from '../_lib/target-closed-actions';
import type { StoreLite } from './types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type TargetCalendarSectionProps = {
  stores: StoreLite[];
  selectedStoreId: string | null;
  /** 'YYYY-MM' */
  yearMonth: string;
  /** 既存予算：'YYYY-MM-DD' → target_sales */
  initialValues: Record<string, number>;
  /** 店休日（daily_sales.is_closed=true）：'YYYY-MM-DD' → true */
  initialClosed: Record<string, boolean>;
  canWrite: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM' を1か月ずらした 'YYYY-MM' を返す */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${pad(nm)}`;
}

export function TargetCalendarSection({
  stores,
  selectedStoreId,
  yearMonth,
  initialValues,
  initialClosed,
  canWrite,
}: TargetCalendarSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // 店休日トグルの保存中（即時保存）。日付単位でローディング表示するための識別
  const [closingDate, setClosingDate] = useState<string | null>(null);

  // 'YYYY-MM-DD' → 入力値。空欄は undefined（保存時 0）
  const [amounts, setAmounts] = useState<Record<string, number | undefined>>(initialValues);
  // 'YYYY-MM-DD' → 店休日か（daily_sales.is_closed）
  const [closed, setClosed] = useState<Record<string, boolean>>(initialClosed);

  // 店舗・月の切替（＝初期値の変化）でローカル状態を再同期
  useEffect(() => {
    setAmounts(initialValues);
    setClosed(initialClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, yearMonth]);

  const [year, month] = yearMonth.split('-').map(Number); // month: 1-12

  // 月内の日付配列と先頭曜日
  const { days, firstWeekday } = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=日
    const days = Array.from({ length: daysInMonth }, (_, i) => `${yearMonth}-${pad(i + 1)}`);
    return { days, firstWeekday };
  }, [year, month, yearMonth]);

  // 月合計（税抜）。店休日（is_closed=true）の日は合計から除外（予算値は保持）。
  const monthTotal = useMemo(
    () => days.reduce((sum, d) => sum + (closed[d] ? 0 : (amounts[d] ?? 0)), 0),
    [days, amounts, closed],
  );
  const closedCount = useMemo(() => days.filter((d) => closed[d]).length, [days, closed]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSave = () => {
    if (!selectedStoreId) return;
    startTransition(async () => {
      // その月の全日を送る（空欄=0）。プリフィル済みの未編集日は既存値のまま再保存される。
      const entries = days.map((d) => ({ target_date: d, target_sales: amounts[d] ?? 0 }));
      const result = await upsertMonthlyTargets({
        store_id: selectedStoreId,
        year_month: yearMonth,
        entries,
      });
      if (result.success) {
        toast.success(`${month}月の売上予算を保存しました（${result.data?.saved ?? 0}日分）`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // 店休日トグル（即時保存・予算の月一括保存とは別経路）
  const handleToggleClosed = (date: string) => {
    if (!selectedStoreId || !canWrite) return;
    const next = !closed[date];
    setClosingDate(date);
    startTransition(async () => {
      const result = await setClosedDay({
        store_id: selectedStoreId,
        business_date: date,
        is_closed: next,
      });
      setClosingDate(null);
      if (result.success) {
        setClosed((prev) => ({ ...prev, [date]: next }));
        toast.success(next ? `${date} を店休日にしました` : `${date} の店休日を解除しました`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // グリッド先頭の空セル（先頭曜日ぶん）
  const leadingBlanks = Array.from({ length: firstWeekday });

  // カレンダーの Excel風フォーカス移動（Enter=下＝翌週同曜日／Tab=右＝翌日）。値・保存には非干渉。
  const gridNav = useGridNavigation();

  return (
    <section className="space-y-5">
      {/* 店舗・月セレクタ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="cal-store" className="text-xs text-slate-600">
              <StoreIcon className="w-3 h-3 inline mr-1" />
              店舗
            </Label>
            <Select value={selectedStoreId ?? ''} onValueChange={(v) => updateParam('store', v)}>
              <SelectTrigger id="cal-store">
                <SelectValue placeholder="店舗を選択..." />
              </SelectTrigger>
              <SelectContent>
                {stores.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">アクセス可能な店舗がありません</div>
                ) : (
                  stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              対象月
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="前月"
                onClick={() => updateParam('month', shiftMonth(yearMonth, -1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="font-display font-bold text-slate-900 w-28 text-center">
                {year}年{month}月
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="翌月"
                onClick={() => updateParam('month', shiftMonth(yearMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!selectedStoreId ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-10 text-center text-sm text-slate-500">
          店舗を選択してください
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-[11px] text-slate-500 mb-3">
            日別の売上予算（税抜・ネットセールス基準）を入力します。空欄の日は 0 として保存されます。既存の予算は読み込んで表示しています。
          </p>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={cn(
                  'text-center text-[11px] font-semibold py-1',
                  i === 0 ? 'text-rose-600' : i === 6 ? 'text-sky-600' : 'text-slate-500',
                )}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 日セル */}
          <div className="grid grid-cols-7 gap-1.5" onKeyDown={gridNav.onKeyDown}>
            {leadingBlanks.map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((d, idx) => {
              const gridPos = firstWeekday + idx;
              const dow = gridPos % 7; // 曜日index（0=日〜6=土）＝ data-nav-col
              const weekIndex = Math.floor(gridPos / 7); // 週index ＝ data-nav-row
              const value = amounts[d];
              const isClosed = closed[d] ?? false;
              const isZero = !isClosed && value === 0;
              const isSavingThis = closingDate === d;
              return (
                <div
                  key={d}
                  data-nav-row={weekIndex}
                  data-nav-col={dow}
                  className={cn(
                    'rounded-lg border p-1.5 min-h-[78px] flex flex-col',
                    isClosed
                      ? 'border-slate-300 bg-slate-200/60'
                      : dow === 0
                        ? 'border-rose-100 bg-rose-50/30'
                        : dow === 6
                          ? 'border-sky-100 bg-sky-50/30'
                          : 'border-slate-200',
                    isZero && 'bg-slate-100/70',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-[11px] font-num font-semibold',
                        isClosed
                          ? 'text-slate-500'
                          : dow === 0
                            ? 'text-rose-600'
                            : dow === 6
                              ? 'text-sky-600'
                              : 'text-slate-600',
                      )}
                    >
                      {idx + 1}
                    </span>
                    {/* 店休日トグル（即時保存・daily_sales.is_closed） */}
                    {canWrite ? (
                      <button
                        type="button"
                        aria-label={isClosed ? '店休日を解除' : '店休日にする'}
                        aria-pressed={isClosed}
                        disabled={isPending}
                        onClick={() => handleToggleClosed(d)}
                        className={cn(
                          'inline-flex items-center justify-center w-5 h-5 rounded transition-colors',
                          isClosed
                            ? 'text-slate-700 bg-slate-300/70 hover:bg-slate-300'
                            : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100',
                          isPending && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        {isSavingThis ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Moon className="w-3 h-3" />
                        )}
                      </button>
                    ) : (
                      isClosed && <Moon className="w-3 h-3 text-slate-500" />
                    )}
                  </div>

                  {isClosed ? (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-slate-500">店休日</span>
                    </div>
                  ) : (
                    <AmountInput
                      disabled={!canWrite}
                      placeholder="0"
                      className="font-num text-right text-xs h-7 px-1.5"
                      value={value}
                      onChange={(v) => setAmounts((prev) => ({ ...prev, [d]: v }))}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 月合計＋保存 */}
          <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-slate-200 flex-wrap">
            <div className="text-sm">
              <span className="text-slate-600">月合計（税抜・店休日除く）：</span>
              <span className="font-num text-lg font-bold text-slate-900 ml-1">
                {monthTotal.toLocaleString('ja-JP')}
              </span>
              {closedCount > 0 && (
                <span className="text-[11px] text-slate-500 ml-2 font-num">店休日 {closedCount}日</span>
              )}
            </div>
            {canWrite && (
              <Button type="button" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                この月を保存（全日上書き）
              </Button>
            )}
          </div>

          {!canWrite && (
            <p className="mt-2 text-[11px] text-slate-500">閲覧のみ（編集権限がありません）。</p>
          )}
        </div>
      )}
    </section>
  );
}
