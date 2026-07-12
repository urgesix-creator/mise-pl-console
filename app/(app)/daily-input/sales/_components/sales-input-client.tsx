'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ChevronRight,
  ClipboardEdit,
  Loader2,
  Save,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StoreDateSelector } from './store-date-selector';
import { SalesInputForm, type SalesFormValues } from './sales-input-form';
import { SalesCalculationPreview } from './sales-calculation-preview';
import {
  DepartmentSalesSection,
  type DepartmentOption,
} from './department-sales-section';
import {
  salesFormSchema,
  type DayPeriod,
} from '../_schemas';
import {
  upsertDailySales,
  setSalesServiceFeeMode,
  type AccessibleStore,
  type DailySalesRow,
} from '../actions';

type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

type SalesInputClientProps = {
  stores: AccessibleStore[];
  selectedStoreId: string | null;
  selectedDate: string;
  selectedDayPeriod: DayPeriod;
  initialRecord: DailySalesRow | null;
  userRole: Role;
  canWrite: boolean;
  departments: DepartmentOption[];
  departmentSales: Record<string, number>;
};

const EMPTY_VALUES: SalesFormValues = {
  day_period: 'all',
  net_sales: 0,
  gross_sales: 0,
  customer_count: 0,
  weather: '',
  event_note: '',
  is_closed: false,
  is_holiday: false,
  holiday_name: '',
};

export function SalesInputClient({
  stores,
  selectedStoreId,
  selectedDate,
  selectedDayPeriod,
  initialRecord,
  userRole,
  canWrite,
  departments,
  departmentSales,
}: SalesInputClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [modePending, startModeChange] = useTransition();

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  // サービス料の入力モード（店舗単位で共有）。true=込み
  const serviceFeeIncluded = selectedStore?.sales_service_fee_input_mode === 'included';

  // モード切替（店舗共有・保存後リロードでプレビュー/保存を新モードに統一）
  const changeServiceFeeMode = (mode: 'excluded' | 'included') => {
    if (!selectedStoreId || mode === (serviceFeeIncluded ? 'included' : 'excluded')) return;
    startModeChange(async () => {
      const res = await setSalesServiceFeeMode(selectedStoreId, mode);
      if (res.success) {
        toast.success(mode === 'included' ? 'サービス料込みに切り替えました' : 'サービス料別に切り替えました');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  // 全店 day_period='all' 運用。昼夜分離は廃止したため常に 'all'。
  const defaultDayPeriod: DayPeriod = 'all';

  // 税抜欄の初期表示値：
  //  - 「込み」モードでは、保存済み net_sales は「本体（÷(1+料率)後）」のため、そのまま欄に戻すと
  //    上書き保存のたびに本体を再度 ÷(1+料率) して縮んでしまう（往復が非冪等）。
  //    入力時の税込前総額＝ net_sales + service_fee を復元して表示し、保存で ÷(1+料率) すると
  //    元の本体に戻る（冪等）。これにより訂正が正しく反映される。
  //  - 「別」モードでは net_sales がそのまま入力値のため、保存済み net_sales をそのまま表示。
  const netFieldValue = (rec: DailySalesRow): number => {
    const net = Number(rec.net_sales);
    if (!serviceFeeIncluded) return net; // 別：そのまま
    const inclusive = net + Number(rec.service_fee); // 込み：入力時の総額を復元
    return Math.round(inclusive * 100) / 100;
  };

  const initialValues: SalesFormValues = initialRecord
    ? {
        day_period: initialRecord.day_period,
        net_sales: netFieldValue(initialRecord),
        gross_sales: Number(initialRecord.gross_sales),
        customer_count: Number(initialRecord.customer_count),
        weather: initialRecord.weather ?? '',
        event_note: initialRecord.event_note ?? '',
        is_closed: initialRecord.is_closed ?? false,
        is_holiday: initialRecord.is_holiday ?? false,
        holiday_name: initialRecord.holiday_name ?? '',
      }
    : { ...EMPTY_VALUES, day_period: defaultDayPeriod };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: initialValues,
  });

  // 店舗・日付・既存レコード・サービス料モードが変化したらフォームをリセット
  // （モード切替で税抜欄の表現＝込み:総額／別:本体 が変わるため serviceFeeIncluded も依存に含める）
  useEffect(() => {
    reset(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedDate, initialRecord?.id, serviceFeeIncluded]);

  // （昼夜分離は廃止。day_period の補正effect・URL period 反映は撤去。常に 'all'）

  const watchedNet = watch('net_sales');
  const watchedGross = watch('gross_sales');
  const watchedCount = watch('customer_count');
  const watchedClosed = watch('is_closed');

  // 店休日に切り替えたら売上系を0にクリア（無効化と整合・保存値も0になる）
  useEffect(() => {
    if (watchedClosed) {
      setValue('net_sales', 0, { shouldDirty: true });
      setValue('gross_sales', 0, { shouldDirty: true });
      setValue('customer_count', 0, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedClosed]);

  const onSubmit = (values: SalesFormValues) => {
    if (!selectedStoreId || !selectedStore) {
      toast.error('店舗を選択してください');
      return;
    }
    // 店休日は売上0で送信（サーバ側でも0を強制する）
    const closed = values.is_closed;
    startTransition(async () => {
      const result = await upsertDailySales({
        store_id: selectedStoreId,
        business_date: selectedDate,
        day_period: values.day_period,
        net_sales: closed ? 0 : values.net_sales,
        gross_sales: closed ? 0 : values.gross_sales,
        customer_count: closed ? 0 : values.customer_count,
        weather: values.weather ? values.weather : null,
        event_note: values.event_note ? values.event_note : null,
        is_closed: closed,
        is_holiday: values.is_holiday ?? false,
        holiday_name: values.is_holiday && values.holiday_name ? values.holiday_name : null,
      });
      if (result.success) {
        toast.success(initialRecord ? '上書き保存しました' : '保存しました');
        // ページを再フェッチして isExisting バッジ等を反映
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1.5 text-xs text-slate-500 mb-4"
        aria-label="パンくず"
      >
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">日次入力</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">売上</span>
      </nav>

      {/* Header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Daily Entry · Sales</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-3">
              <ClipboardEdit className="w-7 h-7 text-slate-700" />
              日次売上入力
            </h1>
            <p className="text-sm text-slate-600">
              税抜売上（ネット）を主入力。サービス料・税額・客単価は自動計算。総売上（税込）は独立入力です。
            </p>
          </div>
          {initialRecord && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
              <RefreshCw className="w-3 h-3" />
              既存レコード · 上書きモード
            </span>
          )}
        </div>
      </div>

      {!canWrite && (
        <div className="mb-5 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 text-slate-500 flex-shrink-0" />
          <span>
            あなたのロール（<strong>{userRole}</strong>）では日次売上の入力ができません。閲覧モードで表示しています。
          </span>
        </div>
      )}

      {/* Store / Date selector */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <StoreDateSelector
          stores={stores}
          selectedStoreId={selectedStoreId}
          selectedDate={selectedDate}
        />
      </div>

      {!selectedStore ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="text-sm text-slate-500">
            {stores.length === 0
              ? 'アクセス可能な店舗がありません。管理者にお問い合わせください。'
              : '上のセレクタから店舗を選択してください。'}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* サービス料の入力モード（税抜売上に対する扱い・店舗単位で共有） */}
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  税抜売上の入力方法
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    disabled={!canWrite || modePending}
                    onClick={() => changeServiceFeeMode('excluded')}
                    className={cn(
                      'px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60',
                      !serviceFeeIncluded ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    サービス料別
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite || modePending}
                    onClick={() => changeServiceFeeMode('included')}
                    className={cn(
                      'px-3 py-1.5 text-sm font-semibold border-l border-slate-200 transition-colors disabled:opacity-60',
                      serviceFeeIncluded ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    サービス料込み
                  </button>
                </div>
              </div>
              {modePending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {serviceFeeIncluded
                ? '「込み」：入力した税抜売上にサービス料が含まれます。本体（÷(1+料率)）を売上(net)として保存し、差額をサービス料として分離します。'
                : '「別」：入力した税抜売上をそのまま売上(net)とし、サービス料（売上×料率）は別途算出します。'}
              {' '}店舗共通の設定です（全員に反映・売上(net)はサービス料を含みません）。
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            {/* 入力フォーム */}
            <SalesInputForm
              store={selectedStore}
              register={register}
              control={control}
              errors={errors}
              canWrite={canWrite}
              isClosed={watchedClosed}
            />

            {/* 計算プレビュー（店休日は0表示）＋保存ボタン（客単価の直下に配置） */}
            <div className="space-y-4">
              <SalesCalculationPreview
                netSales={watchedClosed ? 0 : Number(watchedNet) || 0}
                grossSales={watchedClosed ? 0 : Number(watchedGross) || 0}
                customerCount={watchedClosed ? 0 : Number(watchedCount) || 0}
                serviceFeeRate={selectedStore.service_fee_rate}
                taxRate={selectedStore.tax_rate}
                taxBase={selectedStore.tax_base}
                taxLabel={selectedStore.tax_label}
                currencyCode={selectedStore.currency_id.toUpperCase()}
                serviceFeeIncluded={serviceFeeIncluded}
              />

              {/* 保存ボタン：客単価のすぐ下（押し忘れ防止）。機能・ラベル・disabled条件は従来どおり */}
              {canWrite && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {isDirty ? (
                      <span className="text-amber-700 font-semibold">未保存の変更があります</span>
                    ) : initialRecord ? (
                      '既存レコードを表示中'
                    ) : (
                      '新規入力'
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isPending || !canWrite}
                    className="bg-brand-600 hover:bg-brand-700"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {initialRecord ? '上書き保存' : '保存'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* 部門別売上（参考データ）：経営売上フォームの外側に独立配置。
          専用の保存ボタンを持ち、上の売上保存（daily_sales）とは互いに影響しない。 */}
      {selectedStore && (
        <div className="mt-6">
          <DepartmentSalesSection
            storeId={selectedStore.id}
            businessDate={selectedDate}
            currencyCode={selectedStore.currency_id.toUpperCase()}
            departments={departments}
            initialValues={departmentSales}
            canWrite={canWrite}
          />
        </div>
      )}
    </div>
  );
}
