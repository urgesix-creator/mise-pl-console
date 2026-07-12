'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createSupplier, updateSupplier, findSimilarSuppliers } from '../actions';
import type { SupplierCategoryOption, Supplier } from './types';

const formSchema = z.object({
  category_id: z.string().uuid('カテゴリを選択してください'),
  name: z
    .string()
    .trim()
    .min(1, '仕入先名を入力してください')
    .max(100, '仕入先名は100文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '数値で入力してください' })
    .int('整数で入力してください')
    .min(0, '0以上で入力してください'),
  cost_type: z.enum(['cogs', 'sga']),
  tax_rate: z
    .number({ invalid_type_error: '税率は数値で入力してください' })
    .min(0, '0以上で入力してください')
    .max(100, '100以下で入力してください'),
  is_tax_exempt: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type SupplierFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  storeId: string;
  storeName: string;
  supplier: Supplier | null;
  activeCategories: SupplierCategoryOption[];
  nextDisplayOrder: number;
  /** 新規作成時の税率(%)既定（店舗標準＝stores.purchase_tax_rate_default） */
  defaultTaxRate?: number;
  /** 登録成功時の通知（任意・仕入入力画面で再取得に使う等） */
  onSuccess?: () => void;
};

export function SupplierFormDialog({
  open,
  onOpenChange,
  mode,
  storeId,
  storeName,
  supplier,
  activeCategories,
  nextDisplayOrder,
  defaultTaxRate = 0,
  onSuccess,
}: SupplierFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  // 類似名の確認待ち（新規登録時のみ）。null=確認不要、配列あり=確認ダイアログ表示
  const [pendingConfirm, setPendingConfirm] = useState<{ values: FormValues; names: string[] } | null>(null);

  const defaultCategoryId =
    mode === 'edit' && supplier
      ? supplier.category_id
      : activeCategories[0]?.id ?? '';

  const defaultValues: FormValues =
    mode === 'edit' && supplier
      ? {
          category_id: supplier.category_id,
          name: supplier.name,
          display_order: supplier.display_order,
          cost_type: supplier.cost_type,
          tax_rate: Number(supplier.tax_rate ?? 0),
          is_tax_exempt: !!supplier.is_tax_exempt,
        }
      : {
          category_id: defaultCategoryId,
          name: '',
          display_order: nextDisplayOrder,
          cost_type: 'cogs',
          tax_rate: defaultTaxRate,
          is_tax_exempt: false,
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
  const isExempt = watch('is_tax_exempt');

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier?.id, mode, nextDisplayOrder]);

  // 実際の保存（skipSimilar=true で類似名チェックを飛ばす＝確認後の続行）
  const doSave = (values: FormValues, skipSimilar: boolean) => {
    startTransition(async () => {
      // 新規登録は、似た名前が既にあれば確認をはさむ（ブロックはしない）
      if (mode === 'create' && !skipSimilar) {
        const { names } = await findSimilarSuppliers(storeId, values.name);
        if (names.length > 0) {
          setPendingConfirm({ values, names });
          return;
        }
      }

      const payload = {
        store_id: storeId,
        category_id: values.category_id,
        name: values.name,
        display_order: values.display_order,
        cost_type: values.cost_type,
        tax_rate: values.tax_rate,
        is_tax_exempt: values.is_tax_exempt,
      };

      const result =
        mode === 'create'
          ? await createSupplier(payload)
          : await updateSupplier(supplier!.id, payload);

      if (result.success) {
        toast.success(
          mode === 'create' ? `「${values.name}」を追加しました` : '変更を保存しました',
        );
        setPendingConfirm(null);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  };

  const onSubmit = (values: FormValues) => doSave(values, false);

  const noCategories = activeCategories.length === 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            {mode === 'create' ? 'Add Supplier' : 'Edit Supplier'}
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === 'create' ? '新規仕入先追加' : '仕入先編集'}
          </DialogTitle>
          <DialogDescription>
            対象店舗: <span className="font-medium text-slate-700">{storeName}</span>
          </DialogDescription>
        </DialogHeader>

        {noCategories ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            この店舗には有効な仕入カテゴリがまだ登録されていません。先に「仕入カテゴリ」マスタでカテゴリを追加してください。
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">
                仕入先名 <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="supplier-name"
                {...register('name')}
                placeholder="例：Bacchus Global、Kingdom Organic"
                autoFocus
                maxLength={100}
              />
              {errors.name && (
                <p className="text-xs text-rose-600 font-medium">{errors.name.message}</p>
              )}
              <p className="text-[11px] text-slate-500">
                同一店舗内で重複する仕入先名は登録できません
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-category">
                カテゴリ <span className="text-rose-500">*</span>
              </Label>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="supplier-category">
                      <SelectValue placeholder="カテゴリを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category_id && (
                <p className="text-xs text-rose-600 font-medium">{errors.category_id.message}</p>
              )}
              <p className="text-[11px] text-slate-500">
                有効化されたカテゴリのみ選択できます
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-cost-type">
                原価区分 <span className="text-rose-500">*</span>
              </Label>
              <Controller
                control={control}
                name="cost_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="supplier-cost-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cogs">売上原価（粗利・差益・PL原価に算入）</SelectItem>
                      <SelectItem value="sga">販管費（売上原価から除外）</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cost_type && (
                <p className="text-xs text-rose-600 font-medium">{errors.cost_type.message}</p>
              )}
              <p className="text-[11px] text-slate-500">
                販管費を選ぶと売上原価・差益から除外されます（月次PLの販管費へは仕入先別集計の参考値を見て手入力）
              </p>
            </div>

            {/* 仕入税率（%）と非課税。仕入のみに使用・売上の税計算には不使用 */}
            <div className="space-y-1.5">
              <Label htmlFor="supplier-tax-rate">仕入税率（%）</Label>
              <Input
                id="supplier-tax-rate"
                type="number"
                step="0.001"
                min="0"
                max="100"
                inputMode="decimal"
                className="text-right font-num"
                disabled={isExempt}
                {...register('tax_rate', { valueAsNumber: true })}
              />
              {errors.tax_rate && (
                <p className="text-xs text-rose-600 font-medium">{errors.tax_rate.message}</p>
              )}
              <p className="text-[11px] text-slate-500">
                仕入入力でこの取引先を選ぶと自動適用されます（入力画面での上書き不可）。売上の税率とは別管理です。
              </p>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded cursor-pointer accent-brand-600"
                  {...register('is_tax_exempt')}
                />
                <span className="text-sm text-slate-700">非課税（税額0・税込＝税抜。税率は無視）</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-order">表示順</Label>
              <Input
                id="supplier-order"
                type="number"
                step="1"
                min="0"
                className="text-right font-num"
                {...register('display_order', { valueAsNumber: true })}
              />
              {errors.display_order && (
                <p className="text-xs text-rose-600 font-medium">
                  {errors.display_order.message}
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                小さい数字が上に表示されます。並び替えボタンでも調整可能
              </p>
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
        )}
      </DialogContent>
    </Dialog>

    {/* 類似名の確認（ブロックせず人に最終判断を委ねる） */}
    <Dialog
      open={!!pendingConfirm}
      onOpenChange={(o) => {
        if (!o) setPendingConfirm(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">似た名前の仕入先があります</DialogTitle>
          <DialogDescription>
            同じ取引先を二重登録していないか、ご確認ください。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="text-[11px] font-semibold text-amber-800 mb-1.5">既存の似た名前</div>
            <ul className="space-y-1">
              {(pendingConfirm?.names ?? []).map((n) => (
                <li key={n} className="text-sm text-amber-900 font-medium">
                  ・{n}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-slate-600">
            「<span className="font-medium text-slate-900">{pendingConfirm?.values.name}</span>」を
            それでも新規登録しますか？
          </p>
        </div>
        <DialogFooter className="pt-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setPendingConfirm(null)} disabled={isPending}>
            いいえ（やめる）
          </Button>
          <Button
            type="button"
            onClick={() => pendingConfirm && doSave(pendingConfirm.values, true)}
            disabled={isPending}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            はい、新規登録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
