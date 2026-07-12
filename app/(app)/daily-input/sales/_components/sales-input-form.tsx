'use client';

import { Controller, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DAY_PERIODS, WEATHER_LABEL, WEATHER_OPTIONS, type DayPeriod } from '../_schemas';
import type { AccessibleStore } from '../actions';
import { AmountInput } from './amount-input';

export type SalesFormValues = {
  day_period: DayPeriod;
  net_sales: number; // 主入力（税抜）
  gross_sales?: number; // 独立入力（税込）。net から自動算出しない
  customer_count: number;
  weather?: string | null;
  event_note?: string | null;
  is_closed: boolean; // 店休日フラグ
  is_holiday?: boolean; // 祝日フラグ（#9）
  holiday_name?: string | null; // 祝日名（任意）
};

type SalesInputFormProps = {
  store: AccessibleStore;
  register: UseFormRegister<SalesFormValues>;
  control: Control<SalesFormValues>;
  errors: FieldErrors<SalesFormValues>;
  canWrite: boolean;
  /** 店休日（true のとき売上欄を無効化） */
  isClosed: boolean;
};

export function SalesInputForm({
  store,
  register,
  control,
  errors,
  canWrite,
  isClosed,
}: SalesInputFormProps) {
  // 店休日のときは売上系（税抜・税込・客数）を無効化（0固定で保存される）
  const salesDisabled = !canWrite || isClosed;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
        <div className="w-6 h-px bg-slate-300" />
        <span>Sales Entry</span>
      </div>

      {/* 店休日トグル */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
          isClosed ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50/40',
        )}
      >
        <div className="flex items-center gap-2">
          <Moon className={cn('w-4 h-4', isClosed ? 'text-slate-700' : 'text-slate-400')} />
          <div>
            <Label htmlFor="is_closed" className="text-sm font-semibold text-slate-800 cursor-pointer">
              店休日
            </Label>
            <p className="text-[11px] text-slate-500">
              ONにすると売上・客数は0で保存されます（税額も自動的に0）。
            </p>
          </div>
        </div>
        <Controller
          control={control}
          name="is_closed"
          render={({ field }) => (
            <Switch
              id="is_closed"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={!canWrite}
            />
          )}
        />
      </div>

      {/* 時間帯セレクタは廃止（全店 day_period='all' 運用）。day_period は常に 'all' で保存される */}

      {/* 税抜売上（主入力） */}
      <div className="space-y-1.5">
        <Label htmlFor="net_sales" className="text-xs text-slate-700 font-semibold">
          税抜売上（net_sales） <span className="text-rose-500">*</span>
        </Label>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="net_sales"
            render={({ field }) => (
              <AmountInput
                id="net_sales"
                disabled={salesDisabled}
                placeholder="0"
                className="font-num text-right text-lg"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <span className="text-sm text-slate-500 font-num whitespace-nowrap">
            {store.currency_id.toUpperCase()}
          </span>
        </div>
        {errors.net_sales && (
          <p className="text-xs text-rose-600 font-medium">{errors.net_sales.message}</p>
        )}
        <p className="text-[11px] text-slate-500">
          ネットセールス（税抜）を入力。予算・粗利の基準。サービス料・税額は自動計算されます。
        </p>
      </div>

      {/* 総売上（税込・独立入力） */}
      <div className="space-y-1.5">
        <Label htmlFor="gross_sales" className="text-xs text-slate-700 font-semibold">
          総売上（税込・gross_sales）
        </Label>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="gross_sales"
            render={({ field }) => (
              <AmountInput
                id="gross_sales"
                disabled={salesDisabled}
                placeholder="0"
                className="font-num text-right text-lg"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <span className="text-sm text-slate-500 font-num whitespace-nowrap">
            {store.currency_id.toUpperCase()}
          </span>
        </div>
        {errors.gross_sales && (
          <p className="text-xs text-rose-600 font-medium">{errors.gross_sales.message}</p>
        )}
        <p className="text-[11px] text-slate-500">
          POS の税込売上を独立して入力（税抜からは自動算出しません）。客単価の分子に使用します。
        </p>
      </div>

      {/* 客数 */}
      <div className="space-y-1.5">
        <Label htmlFor="customer_count" className="text-xs text-slate-700 font-semibold">
          客数（customer_count） <span className="text-rose-500">*</span>
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="customer_count"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            disabled={salesDisabled}
            placeholder="0"
            className="font-num text-right text-lg"
            {...register('customer_count', { valueAsNumber: true })}
          />
          <span className="text-sm text-slate-500 whitespace-nowrap">人</span>
        </div>
        {errors.customer_count && (
          <p className="text-xs text-rose-600 font-medium">{errors.customer_count.message}</p>
        )}
      </div>

      {/* 天候（is_weather_enabled の場合のみ） */}
      {store.is_weather_enabled && (
        <div className="space-y-1.5">
          <Label htmlFor="weather" className="text-xs text-slate-700 font-semibold">
            天候
          </Label>
          <Controller
            control={control}
            name="weather"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => field.onChange(v || null)}
                disabled={!canWrite}
              >
                <SelectTrigger id="weather">
                  <SelectValue placeholder="選択..." />
                </SelectTrigger>
                <SelectContent>
                  {WEATHER_OPTIONS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {WEATHER_LABEL[w]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* イベントメモ（is_event_enabled の場合のみ） */}
      {store.is_event_enabled && (
        <div className="space-y-1.5">
          <Label htmlFor="event_note" className="text-xs text-slate-700 font-semibold">
            イベントメモ
          </Label>
          <textarea
            id="event_note"
            disabled={!canWrite}
            rows={3}
            maxLength={500}
            placeholder="例：開店記念キャンペーン、団体予約20名等"
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 resize-y"
            {...register('event_note')}
          />
          {errors.event_note && (
            <p className="text-xs text-rose-600 font-medium">{errors.event_note.message}</p>
          )}
        </div>
      )}

      {/* 祝日（#9）。店休とは独立。集計・税計算には不使用 */}
      <div className="space-y-1.5">
        <Controller
          control={control}
          name="is_holiday"
          render={({ field }) => (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={!canWrite} />
                <span className="text-xs text-slate-700 font-semibold">祝日</span>
              </label>
              {field.value && (
                <input
                  id="holiday_name"
                  disabled={!canWrite}
                  maxLength={100}
                  placeholder="祝日名（任意・例：ニュピ、レバラン 等）"
                  className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
                  {...register('holiday_name')}
                />
              )}
            </div>
          )}
        />
        {errors.holiday_name && (
          <p className="text-xs text-rose-600 font-medium">{errors.holiday_name.message}</p>
        )}
      </div>
    </div>
  );
}

export { DAY_PERIODS };
