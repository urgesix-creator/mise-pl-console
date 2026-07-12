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
import { createDepartment, updateDepartment } from '../actions';
import type { SalesDepartment } from './types';

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '部門名を入力してください')
    .max(50, '部門名は50文字以内で入力してください'),
  display_order: z
    .number({ invalid_type_error: '数値で入力してください' })
    .int('整数で入力してください')
    .min(0, '0以上で入力してください'),
});

type FormValues = z.infer<typeof formSchema>;

type DepartmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  storeId: string;
  storeName: string;
  department: SalesDepartment | null;
  nextDisplayOrder: number;
};

export function DepartmentFormDialog({
  open,
  onOpenChange,
  mode,
  storeId,
  storeName,
  department,
  nextDisplayOrder,
}: DepartmentFormDialogProps) {
  const [isPending, startTransition] = useTransition();

  const defaultValues: FormValues =
    mode === 'edit' && department
      ? { name: department.name, display_order: department.display_order }
      : { name: '', display_order: nextDisplayOrder };

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
  }, [open, department?.id, mode, nextDisplayOrder]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        store_id: storeId,
        name: values.name,
        display_order: values.display_order,
      };

      const result =
        mode === 'create'
          ? await createDepartment(payload)
          : await updateDepartment(department!.id, payload);

      if (result.success) {
        toast.success(
          mode === 'create' ? `「${values.name}」を追加しました` : '変更を保存しました',
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
            {mode === 'create' ? 'Add Department' : 'Edit Department'}
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === 'create' ? '新規部門追加' : '部門編集'}
          </DialogTitle>
          <DialogDescription>
            対象店舗: <span className="font-medium text-slate-700">{storeName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="department-name">
              部門名 <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="department-name"
              {...register('name')}
              placeholder="例：朝食、昼食、夕食、デリバリー"
              autoFocus
              maxLength={50}
            />
            {errors.name && (
              <p className="text-xs text-rose-600 font-medium">{errors.name.message}</p>
            )}
            <p className="text-[11px] text-slate-500">
              登録例：朝食／昼食／夕食／デリバリー など。同一店舗内で部門名は重複できません
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department-order">表示順</Label>
            <Input
              id="department-order"
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
      </DialogContent>
    </Dialog>
  );
}
