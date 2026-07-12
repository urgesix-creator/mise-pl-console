'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Info, Loader2, Save, LayoutGrid, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AmountInput } from './amount-input';
import { upsertDailyDepartmentSales } from '../department-sales-actions';

export type DepartmentOption = {
  id: string;
  name: string;
  display_order: number;
};

type DepartmentSalesSectionProps = {
  storeId: string;
  businessDate: string;
  currencyCode: string;
  departments: DepartmentOption[];
  /** 既存値（department_id → 税込売上）。当日・当店の保存済み値 */
  initialValues: Record<string, number>;
  canWrite: boolean;
};

export function DepartmentSalesSection({
  storeId,
  businessDate,
  currencyCode,
  departments,
  initialValues,
  canWrite,
}: DepartmentSalesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // department_id → 入力値（税込）。空欄は undefined
  const [amounts, setAmounts] = useState<Record<string, number | undefined>>(initialValues);

  // 店舗・日付の切替（＝初期値の変化）でローカル状態を再同期
  useEffect(() => {
    setAmounts(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, businessDate]);

  const handleSave = () => {
    startTransition(async () => {
      const entries = departments.map((d) => ({
        department_id: d.id,
        gross_sales: amounts[d.id], // undefined はサーバ側でスキップ（任意入力）
      }));
      const result = await upsertDailyDepartmentSales({
        store_id: storeId,
        business_date: businessDate,
        entries,
      });
      if (result.success) {
        const saved = result.data?.saved ?? 0;
        toast.success(
          saved > 0 ? `部門別売上を保存しました（${saved}件）` : '部門別売上（入力なし）',
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
        <div className="w-6 h-px bg-slate-300" />
        <span>Department Sales · Reference</span>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-slate-600" />
          部門別売上（参考）
        </h2>
        {/* 参考データの注記 */}
        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-sky-900">
            参考データです。経営計算（損益・予算比・原価率）には反映されません。各部門の税込売上を任意で入力できます（空欄可）。
          </p>
        </div>
      </div>

      {departments.length === 0 ? (
        /* 部門マスタ未登録 */
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center">
          <div className="text-sm text-slate-600 mb-3">この店舗には部門が未登録です</div>
          <Link
            href={`/masters/departments?store=${storeId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:underline"
          >
            部門マスタで部門を登録する
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {departments.map((dept) => (
              <div key={dept.id} className="space-y-1.5">
                <Label
                  htmlFor={`dept-${dept.id}`}
                  className="text-xs text-slate-700 font-semibold"
                >
                  {dept.name}（税込）
                </Label>
                <div className="flex items-center gap-2">
                  <AmountInput
                    id={`dept-${dept.id}`}
                    disabled={!canWrite}
                    placeholder="0"
                    className="font-num text-right text-base"
                    value={amounts[dept.id]}
                    onChange={(v) =>
                      setAmounts((prev) => ({ ...prev, [dept.id]: v }))
                    }
                  />
                  <span className="text-sm text-slate-500 font-num whitespace-nowrap">
                    {currencyCode}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {canWrite && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-500">
                経営売上とは別に保存されます（この保存は上の売上保存に影響しません）。
              </p>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                variant="outline"
                className="flex-shrink-0"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                部門別売上を保存
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
