'use client';

import { useEffect, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCountry, updateCountry } from '../actions';
import { TAX_BASES, TAX_BASE_LABELS, type CountryFormData } from '../_schemas';
import type { Country } from './types';

// フォーム内部値：税率は「％」で扱う（保存時に小数へ変換）
const formSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, '国IDは2文字以上')
    .max(8, '国IDは8文字以内')
    .regex(/^[a-z][a-z0-9_]*$/, '小文字英字で始まる英数字・アンダースコアのみ'),
  code: z
    .string()
    .trim()
    .min(2, 'コードは2文字以上')
    .max(8, 'コードは8文字以内')
    .regex(/^[A-Z][A-Z0-9]*$/, '大文字英字と数字のみ'),
  name: z.string().trim().min(1, '国名を入力').max(50, '50文字以内'),
  flag: z.string().trim().max(8, '8文字以内').optional(),
  tax_rate_pct: z
    .number({ invalid_type_error: '税率を数値で入力' })
    .min(0, '0以上')
    .max(100, '100以下'),
  tax_base: z.enum(['net_sales', 'net_plus_service'], {
    errorMap: () => ({ message: '課税ベースを選択' }),
  }),
  tax_label: z.string().trim().min(1, '課税ラベルを入力').max(20, '20文字以内'),
  display_order: z.number({ invalid_type_error: '数値で入力' }).int('整数').min(0, '0以上'),
});

type FormValues = z.infer<typeof formSchema>;

type CountryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  country: Country | null;
  nextDisplayOrder: number;
};

/** 小数税率（0.07）→ ％（7）。NUMERIC(5,4) の最大4桁を保つ */
function toPct(rate: number): number {
  return Number((rate * 100).toFixed(4));
}
function fmtPct(pct: number): string {
  return `${pct}%`;
}

export function CountryFormDialog({
  open,
  onOpenChange,
  mode,
  country,
  nextDisplayOrder,
}: CountryFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  // 税率・課税ベース変更時の確認ステップ（編集時のみ）
  const [pending, setPending] = useState<{ values: FormValues; changes: string[] } | null>(null);

  const defaultValues: FormValues =
    mode === 'edit' && country
      ? {
          id: country.id,
          code: country.code,
          name: country.name,
          flag: country.flag ?? '',
          tax_rate_pct: toPct(country.tax_rate),
          tax_base: country.tax_base,
          tax_label: country.tax_label,
          display_order: country.display_order,
        }
      : {
          id: '',
          code: '',
          name: '',
          flag: '',
          tax_rate_pct: 0,
          tax_base: 'net_plus_service',
          tax_label: '',
          display_order: nextDisplayOrder,
        };

  const {
    register,
    control,
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
      setPending(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, country?.id, mode, nextDisplayOrder]);

  // 実際の保存（確認後 or 確認不要時）
  const doSave = (values: FormValues) => {
    startTransition(async () => {
      const payload: CountryFormData = {
        id: values.id,
        code: values.code,
        name: values.name,
        flag: values.flag?.trim() ? values.flag.trim() : null,
        tax_rate: Number((values.tax_rate_pct / 100).toFixed(6)),
        tax_base: values.tax_base,
        tax_label: values.tax_label,
        display_order: values.display_order,
      };
      const result =
        mode === 'create' ? await createCountry(payload) : await updateCountry(country!.id, payload);

      if (result.success) {
        toast.success(
          mode === 'create' ? `国「${values.name}」を追加しました` : '国マスタを更新しました',
        );
        setPending(null);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  // submit：編集で税率・課税ベースが変わる場合は確認ステップへ
  const onSubmit = (values: FormValues) => {
    if (mode === 'edit' && country) {
      const changes: string[] = [];
      const origPct = toPct(country.tax_rate);
      if (values.tax_rate_pct !== origPct) {
        changes.push(`税率：${fmtPct(origPct)} → ${fmtPct(values.tax_rate_pct)}`);
      }
      if (values.tax_base !== country.tax_base) {
        changes.push(
          `課税ベース：${TAX_BASE_LABELS[country.tax_base]} → ${TAX_BASE_LABELS[values.tax_base]}`,
        );
      }
      if (changes.length > 0) {
        setPending({ values, changes });
        return;
      }
    }
    doSave(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {pending ? (
          // ── 確認ステップ（税率・課税ベースの変更） ──────────────────
          <>
            <DialogHeader>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-semibold mb-1">
                Confirm Tax Change
              </div>
              <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                税制の変更を確認
              </DialogTitle>
              <DialogDescription>
                「{country?.name}」の税制を次のとおり変更します。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                {pending.changes.map((c, i) => (
                  <li key={i} className="text-sm font-medium text-amber-900">
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-600 leading-relaxed">
                この変更は<strong>今後の売上保存・Excel再取込</strong>に適用されます。
                <strong>過去の保存済みデータ（確定済みの税額）は変わりません</strong>
                （税額は保存時に固定されています）。よろしいですか？
              </p>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPending(null)}
                disabled={isPending}
              >
                戻る
              </Button>
              <Button
                type="button"
                onClick={() => doSave(pending.values)}
                disabled={isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                変更する
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ── 入力フォーム ──────────────────────────────────────────
          <>
            <DialogHeader>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
                {mode === 'create' ? 'Add Country' : 'Edit Country'}
              </div>
              <DialogTitle className="font-display text-xl font-bold">
                {mode === 'create' ? '国を追加' : '国を編集'}
              </DialogTitle>
              <DialogDescription>
                国マスタを追加・編集します。税率・課税ベースは税計算（売上保存時）で参照されます。
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-[1fr_1fr_80px] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="country-id">
                    国ID <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="country-id"
                    placeholder="例：us"
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
                  <Label htmlFor="country-code">
                    国コード <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="country-code"
                    placeholder="例：US"
                    className="font-mono"
                    maxLength={8}
                    {...register('code')}
                  />
                  {errors.code && (
                    <p className="text-xs text-rose-600 font-medium">{errors.code.message}</p>
                  )}
                  <p className="text-[11px] text-slate-500">大文字（ISO）</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country-flag">国旗</Label>
                  <Input
                    id="country-flag"
                    placeholder="🇺🇸"
                    className="text-center text-lg"
                    maxLength={8}
                    {...register('flag')}
                  />
                  {errors.flag && (
                    <p className="text-xs text-rose-600 font-medium">{errors.flag.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country-name">
                  国名 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="country-name"
                  placeholder="例：アメリカ"
                  maxLength={50}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-rose-600 font-medium">{errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="country-tax-rate">
                    税率（%） <span className="text-rose-500">*</span>
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="country-tax-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="text-right font-num"
                      {...register('tax_rate_pct', { valueAsNumber: true })}
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  {errors.tax_rate_pct && (
                    <p className="text-xs text-rose-600 font-medium">
                      {errors.tax_rate_pct.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country-tax-label">
                    課税ラベル <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="country-tax-label"
                    placeholder="例：VAT / Sales Tax"
                    maxLength={20}
                    {...register('tax_label')}
                  />
                  {errors.tax_label && (
                    <p className="text-xs text-rose-600 font-medium">{errors.tax_label.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country-tax-base">
                  課税ベース <span className="text-rose-500">*</span>
                </Label>
                <Controller
                  control={control}
                  name="tax_base"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="country-tax-base">
                        <SelectValue placeholder="課税ベースを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {TAX_BASES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {TAX_BASE_LABELS[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.tax_base && (
                  <p className="text-xs text-rose-600 font-medium">{errors.tax_base.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country-order">表示順</Label>
                <Input
                  id="country-order"
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
