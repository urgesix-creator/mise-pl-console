'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { cn } from '@/lib/utils';
import { createStoreGroup, updateStoreGroup } from '../actions';
import type { GroupStore, StoreGroupWithMembers } from './types';

const formSchema = z.object({
  name: z.string().trim().min(1, 'グループ名を入力してください').max(50, '50文字以内で入力してください'),
  display_order: z.number({ invalid_type_error: '数値で入力してください' }).int().min(0, '0以上で入力してください'),
});

type FormValues = z.infer<typeof formSchema>;

type StoreGroupFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  group: StoreGroupWithMembers | null;
  activeStores: GroupStore[];
  nextDisplayOrder: number;
};

export function StoreGroupFormDialog({
  open,
  onOpenChange,
  mode,
  group,
  activeStores,
  nextDisplayOrder,
}: StoreGroupFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const defaultValues: FormValues =
    mode === 'edit' && group
      ? { name: group.name, display_order: group.display_order }
      : { name: '', display_order: nextDisplayOrder };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setSelected(new Set(mode === 'edit' && group ? group.members.map((m) => m.id) : []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id, mode, nextDisplayOrder]);

  const toggle = (storeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        name: values.name,
        display_order: values.display_order,
        store_ids: Array.from(selected),
      };
      const result =
        mode === 'create'
          ? await createStoreGroup(payload)
          : await updateStoreGroup(group!.id, payload);

      if (result.success) {
        toast.success(mode === 'create' ? `「${values.name}」を追加しました` : '変更を保存しました');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            {mode === 'create' ? 'Add Group' : 'Edit Group'}
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === 'create' ? '店舗グループを追加' : '店舗グループを編集'}
          </DialogTitle>
          <DialogDescription>
            グループ名・表示順・所属店舗を設定します。所属の解除・追加は保存時に反映されます。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">
                グループ名 <span className="text-rose-500">*</span>
              </Label>
              <Input id="group-name" placeholder="例：タイ店舗、直営店" maxLength={50} autoFocus {...register('name')} />
              {errors.name && <p className="text-xs text-rose-600 font-medium">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-order">表示順</Label>
              <Input
                id="group-order"
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
          </div>

          <div className="space-y-1.5">
            <Label>
              所属店舗 <span className="text-slate-400 font-normal">（{selected.size}店 選択中）</span>
            </Label>
            {activeStores.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                有効な店舗がありません。
              </p>
            ) : (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {activeStores.map((s) => {
                  const checked = selected.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                        checked ? 'bg-slate-50' : 'hover:bg-slate-50/60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="w-4 h-4 rounded cursor-pointer accent-brand-600"
                      />
                      <span className="font-num text-[11px] font-bold tracking-wider text-slate-900 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                        {String(s.store_no).padStart(3, '0')}
                      </span>
                      <span className="text-sm text-slate-800">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
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
