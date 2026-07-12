'use client';

import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import { createCurrency, updateCurrency } from '../actions';
import type { Currency } from './types';

const formSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, '通貨IDは2文字以上')
    .max(8, '通貨IDは8文字以内')
    .regex(/^[a-z][a-z0-9_]*$/, '小文字英字で始まる英数字・アンダースコアのみ'),
  code: z
    .string()
    .trim()
    .min(2, 'コードは2文字以上')
    .max(8, 'コードは8文字以内')
    .regex(/^[A-Z][A-Z0-9]*$/, '大文字英字と数字のみ'),
  symbol: z.string().trim().min(1, '記号を入力').max(8, '8文字以内'),
  name: z.string().trim().min(1, '通貨名を入力').max(50, '50文字以内'),
  display_order: z
    .number({ invalid_type_error: '数値で入力' })
    .int('整数')
    .min(0, '0以上'),
});

type FormValues = z.infer<typeof formSchema>;

type CurrencyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  currency: Currency | null;
  nextDisplayOrder: number;
};

export function CurrencyFormDialog({
  open,
  onOpenChange,
  mode,
  currency,
  nextDisplayOrder,
}: CurrencyFormDialogProps) {
  const [isPending, startTransition] = useTransition();

  const defaultValues: FormValues =
    mode === 'edit' && currency
      ? {
          id: currency.id,
          code: currency.code,
          symbol: currency.symbol,
          name: currency.name,
          display_order: currency.display_order,
        }
      : {
          id: '',
          code: '',
          symbol: '',
          name: '',
          display_order: nextDisplayOrder,
        };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currency?.id, mode, nextDisplayOrder]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCurrency(values)
          : await updateCurrency(currency!.id, values);

      if (result.success) {
        toast.success(
          mode === 'create' ? `通貨「${values.code}」を追加しました` : '通貨を更新しました',
        );
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            {mode === 'create' ? 'Add Currency' : 'Edit Currency'}
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === 'create' ? '通貨を追加' : '通貨を編集'}
          </DialogTitle>
          <DialogDescription>
            通貨マスタを追加・編集します。為替レート設定で参照する通貨をここで管理します。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency-id">
                通貨ID <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="currency-id"
                placeholder="例：thb"
                className="font-mono"
                disabled={mode === 'edit'}
                maxLength={8}
                {...register('id')}
              />
              {errors.id && (
                <p className="text-xs text-rose-600 font-medium">{errors.id.message}</p>
              )}
              <p className="text-[11px] text-slate-500">小文字、作成後変更不可</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency-code">
                通貨コード <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="currency-code"
                placeholder="例：THB"
                className="font-mono"
                maxLength={8}
                {...register('code')}
              />
              {errors.code && (
                <p className="text-xs text-rose-600 font-medium">{errors.code.message}</p>
              )}
              <p className="text-[11px] text-slate-500">ISO 4217 大文字</p>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency-symbol">
                記号 <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="currency-symbol"
                placeholder="例：฿"
                className="text-center text-lg font-display"
                maxLength={8}
                {...register('symbol')}
              />
              {errors.symbol && (
                <p className="text-xs text-rose-600 font-medium">{errors.symbol.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency-name">
                通貨名 <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="currency-name"
                placeholder="例：タイバーツ"
                maxLength={50}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-rose-600 font-medium">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency-order">表示順</Label>
            <Input
              id="currency-order"
              type="number"
              step="1"
              min="0"
              className="text-right font-num"
              {...register('display_order', { valueAsNumber: true })}
            />
            {errors.display_order && (
              <p className="text-xs text-rose-600 font-medium">{errors.display_order.message}</p>
            )}
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
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'create' ? '追加する' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
