'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { upsertExchangeRate } from '../actions';
import type { Currency, RatePairWithMeta } from './types';

const formSchema = z.object({
  from_currency_id: z.string().min(1, '元通貨を選択してください'),
  to_currency_id: z.string().min(1, '換算先通貨を選択してください'),
  rate: z
    .number({ invalid_type_error: 'レートを数値で入力してください' })
    .positive('レートは正の数で入力してください'),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください'),
  notes: z.string().max(500).nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type RateFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  pair: RatePairWithMeta | null;
  currencies: Currency[];
};

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(4);
  return rate.toFixed(6);
}

export function RateFormDialog({
  open,
  onOpenChange,
  mode,
  pair,
  currencies,
}: RateFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  const defaultValues: FormValues = pair
    ? {
        from_currency_id: pair.from_currency.id,
        to_currency_id: pair.to_currency.id,
        rate: pair.rate ?? 0,
        effective_date: pair.effective_date ?? todayISO(),
        notes: pair.notes ?? '',
      }
    : {
        from_currency_id: '',
        to_currency_id: 'jpy',
        rate: 0,
        effective_date: todayISO(),
        notes: '',
      };

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setPendingValues(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pair?.rate_id]);

  const watchedFrom = watch('from_currency_id');
  const watchedTo = watch('to_currency_id');

  const onPrepareConfirm = (values: FormValues) => {
    setPendingValues(values);
  };

  const onConfirmSave = () => {
    if (!pendingValues) return;
    startTransition(async () => {
      const result = await upsertExchangeRate(pendingValues);
      if (result.success) {
        toast.success(mode === 'create' ? '為替レートを登録しました' : '為替レートを更新しました');
        onOpenChange(false);
        setPendingValues(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const fromCurrency = currencies.find((c) => c.id === watchedFrom);
  const toCurrency = currencies.find((c) => c.id === watchedTo);
  const currentRate = pair?.rate ?? null;
  const newRate = pendingValues?.rate ?? null;

  const diffPercent =
    currentRate !== null && newRate !== null && currentRate > 0
      ? ((newRate - currentRate) / currentRate) * 100
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && isPending) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {!pendingValues ? (
          <>
            <DialogHeader>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
                {mode === 'create' ? 'Add Exchange Rate' : 'Update Exchange Rate'}
              </div>
              <DialogTitle className="font-display text-xl font-bold">
                {mode === 'create' ? '為替レート設定' : '為替レート更新'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'edit' && pair && pair.rate !== null
                  ? `現在のレート: 1 ${pair.from_currency.code} = ${formatRate(pair.rate)} ${pair.to_currency.code}`
                  : '新しい通貨ペアのレートを設定します'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onPrepareConfirm)} className="space-y-4 pt-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rate-from">
                    元通貨 <span className="text-rose-500">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="from_currency_id"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={mode === 'edit'}
                      >
                        <SelectTrigger id="rate-from">
                          <SelectValue placeholder="選択..." />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} ({c.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="text-slate-400 pb-2.5">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-to">
                    換算先 <span className="text-rose-500">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="to_currency_id"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={mode === 'edit'}
                      >
                        <SelectTrigger id="rate-to">
                          <SelectValue placeholder="選択..." />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              {(errors.from_currency_id || errors.to_currency_id) && (
                <p className="text-xs text-rose-600 font-medium">
                  {errors.from_currency_id?.message || errors.to_currency_id?.message}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="rate-value">
                  レート <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-slate-500 font-num whitespace-nowrap">
                    1 {fromCurrency?.code ?? '???'} =
                  </div>
                  <Input
                    id="rate-value"
                    type="number"
                    step="0.00000001"
                    min="0"
                    className="text-right font-num"
                    {...register('rate', { valueAsNumber: true })}
                    autoFocus
                  />
                  <div className="text-sm text-slate-500 font-num whitespace-nowrap">
                    {toCurrency?.code ?? '???'}
                  </div>
                </div>
                {errors.rate && (
                  <p className="text-xs text-rose-600 font-medium">{errors.rate.message}</p>
                )}
                <p className="text-[11px] text-slate-500">
                  小数点 8 桁まで対応（例: 0.00980000）
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rate-effective">
                  基準日 <span className="text-rose-500">*</span>
                </Label>
                <Input id="rate-effective" type="date" {...register('effective_date')} />
                {errors.effective_date && (
                  <p className="text-xs text-rose-600 font-medium">
                    {errors.effective_date.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  メタ情報。計算には使用しないが、「いつ時点のレートか」の管理用。30日超で要更新アラート対象
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rate-notes">メモ（任意）</Label>
                <Input
                  id="rate-notes"
                  placeholder="例：月初の三菱UFJ TTM、Google参考"
                  maxLength={500}
                  {...register('notes')}
                />
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isPending}>
                  確認に進む
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-semibold mb-1">
                Confirm Update
              </div>
              <DialogTitle className="font-display text-xl font-bold">最終確認</DialogTitle>
              <DialogDescription>
                {mode === 'edit'
                  ? '為替レートを更新します。月末レート方式のため過去データも遡って再計算されます。'
                  : '為替レートを新規登録します。'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 leading-relaxed">
                  <p className="font-bold mb-1">月末レート方式の影響</p>
                  <p>
                    このペアを使用する<span className="font-bold">過去の全データ</span>（売上・仕入・販管費）が、新しいレートで JPY 換算され直します。
                    PL の数字が動きます。
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
                  Comparison
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">変更前</div>
                    <div className="font-num font-bold text-slate-500 text-lg">
                      {currentRate !== null ? formatRate(currentRate) : '— 未設定'}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-xs text-slate-500 mb-1">変更後</div>
                    <div className="font-num font-bold text-slate-900 text-lg">
                      {newRate !== null ? formatRate(newRate) : '—'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-center">
                  1 {fromCurrency?.code} → {toCurrency?.code}
                </div>
                {diffPercent !== null && Math.abs(diffPercent) > 0.001 && (
                  <div className="text-center">
                    <span
                      className={`inline-block text-xs font-semibold font-num px-2 py-0.5 rounded ${
                        Math.abs(diffPercent) > 5
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {diffPercent > 0 ? '+' : ''}
                      {diffPercent.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500">
                基準日: <span className="font-num">{pendingValues.effective_date}</span>
                {pendingValues.notes && (
                  <>
                    {' · '}メモ:{' '}
                    <span className="text-slate-700">{pendingValues.notes}</span>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingValues(null)}
                disabled={isPending}
              >
                戻る
              </Button>
              <Button onClick={onConfirmSave} disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                了解して更新する
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
