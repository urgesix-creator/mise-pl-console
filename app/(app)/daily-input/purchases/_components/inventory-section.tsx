'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Boxes, Info, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AmountInput } from '../../sales/_components/amount-input';
import { upsertInventoryEstimate, type InventorySnapshot } from '../actions';
import { useGridNavigation } from '@/hooks/use-grid-navigation';

type InventorySectionProps = {
  storeId: string;
  businessDate: string;
  currencyCode: string;
  /** 選択中の店舗・日付の既存在庫額（無ければ null） */
  initialAmount: number | null;
  /** 直近の棚卸し履歴（参考表示） */
  recent: InventorySnapshot[];
  canWrite: boolean;
};

/**
 * 棚卸し（在庫合計額）セクション。
 * 仕入の保存とは完全に独立した経路（専用の保存ボタン）。仕入保存に影響しない。
 * 空欄は記録しない（保存しない・DELETEもしない）。
 */
export function InventorySection({
  storeId,
  businessDate,
  currencyCode,
  initialAmount,
  recent,
  canWrite,
}: InventorySectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState<number | undefined>(initialAmount ?? undefined);

  // 移動時保存（onBlur）の dirty 判定用「保存済み値」
  const savedRef = useRef<number | undefined>(initialAmount ?? undefined);

  // キー移動の共通フック（棚卸は1欄のため移動先は無いが、他グリッドと方式を統一）
  const gridNav = useGridNavigation();

  // 店舗・日付の切替（＝初期値の変化）でローカル状態を再同期
  useEffect(() => {
    setAmount(initialAmount ?? undefined);
    savedRef.current = initialAmount ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, businessDate]);

  // 移動時保存：値が変化した時だけ保存（既存ボタンと同じ Action）。空欄は記録しない（サーバもスキップ）。
  const saveOnBlur = () => {
    if (!canWrite) return;
    const val = amount;
    const prev = savedRef.current;
    if ((val ?? null) === (prev ?? null)) return; // 変化なし
    if (val === undefined) {
      savedRef.current = undefined; // 空欄＝記録を作らない（DELETEもしない・サーバ側でスキップ）
      return;
    }
    savedRef.current = val;
    void (async () => {
      const result = await upsertInventoryEstimate({
        store_id: storeId,
        business_date: businessDate,
        amount: val,
      });
      if (!result.success) {
        savedRef.current = prev;
        toast.error(result.error);
      }
    })();
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertInventoryEstimate({
        store_id: storeId,
        business_date: businessDate,
        amount, // undefined はサーバ側でスキップ（記録を作らない）
      });
      if (result.success) {
        toast.success(
          (result.data?.saved ?? 0) > 0
            ? '棚卸し（在庫）を保存しました'
            : '在庫の入力なし（記録は作成されません）',
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 mt-5">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-slate-600" />
          棚卸し（在庫合計額）
        </h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-600">
            棚卸しをした日だけ、在庫の合計額を1つ入力してください（品目別の内訳は不要）。空欄の日は記録されません（しない日は直近の値が引き継がれます）。
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-[1fr_180px] items-center gap-3"
        data-nav-row={0}
        data-nav-col={0}
        onKeyDown={gridNav.onKeyDown}
      >
        <Label htmlFor="inventory-amount" className="text-sm text-slate-700 font-medium">
          在庫合計額
        </Label>
        <div className="flex items-center gap-2">
          <AmountInput
            id="inventory-amount"
            disabled={!canWrite}
            placeholder="（棚卸ししない日は空欄）"
            className="font-num text-right"
            value={amount}
            onChange={setAmount}
            onBlur={saveOnBlur}
          />
          <span className="text-xs text-slate-500 font-num whitespace-nowrap w-10">
            {currencyCode}
          </span>
        </div>
      </div>

      {/* 直近の棚卸し履歴（参考） */}
      {recent.length > 0 && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">
            直近の棚卸し
          </div>
          <ul className="space-y-1">
            {recent.map((r) => (
              <li
                key={r.business_date}
                className="flex items-center justify-between text-xs text-slate-600"
              >
                <span className="font-num">{r.business_date}</span>
                <span className="font-num font-semibold text-slate-800">
                  {r.amount.toLocaleString('ja-JP')}
                  <span className="text-slate-400 ml-1">{currencyCode}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canWrite && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            仕入とは別に保存されます（この保存は仕入の保存に影響しません）。
          </p>
          <Button type="button" onClick={handleSave} disabled={isPending} variant="outline">
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            棚卸しを保存
          </Button>
        </div>
      )}
    </div>
  );
}
