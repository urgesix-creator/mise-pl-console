'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Sun, CloudSun, Sparkles, Copy } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { createStore, updateStore, getStoreCopyPreview, type CopyPreview } from '../actions';
import type { Country, Currency, Store } from './types';

const COPY_NONE = '__none__';

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Bangkok', label: 'バンコク (UTC+7)' },
  { value: 'Asia/Jakarta', label: 'ジャカルタ (UTC+7)' },
  { value: 'Asia/Tokyo', label: '東京 (UTC+9)' },
  { value: 'Asia/Taipei', label: '台北 (UTC+8)' },
];

const COUNTRY_DEFAULTS: Record<string, { currencyId: string; timezone: string }> = {
  th: { currencyId: 'thb', timezone: 'Asia/Bangkok' },
  id: { currencyId: 'idr', timezone: 'Asia/Jakarta' },
  jp: { currencyId: 'jpy', timezone: 'Asia/Tokyo' },
  tw: { currencyId: 'twd', timezone: 'Asia/Taipei' },
  vn: { currencyId: 'vnd', timezone: 'Asia/Ho_Chi_Minh' },
  us: { currencyId: 'usd', timezone: 'America/Los_Angeles' },
};

const formSchema = z.object({
  name: z.string().trim().min(1, '店舗名を入力してください').max(100),
  country_id: z.string().min(1, '国を選択してください'),
  currency_id: z.string().min(1, '通貨を選択してください'),
  timezone: z.string().min(1, 'タイムゾーンを選択してください'),
  service_fee_rate_pct: z
    .number({ invalid_type_error: '数値で入力してください' })
    .min(0, '0以上で入力してください')
    .max(100, '100以下で入力してください'),
  employee_rebate_rate_pct: z
    .number({ invalid_type_error: '数値で入力してください' })
    .min(0, '0以上で入力してください')
    .max(100, '100以下で入力してください'),
  fiscal_year_start_month: z
    .number({ invalid_type_error: '期首月を選択してください' })
    .int()
    .min(1, '1〜12で指定してください')
    .max(12, '1〜12で指定してください'),
  display_order: z
    .number({ invalid_type_error: '数値で入力してください' })
    .int()
    .min(0),
  is_weather_enabled: z.boolean(),
  is_event_enabled: z.boolean(),
  established_date: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type StoreFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  store: Store | null;
  stores: Store[];
  countries: Country[];
  currencies: Currency[];
};

export function StoreFormDialog({
  open,
  onOpenChange,
  mode,
  store,
  stores,
  countries,
  currencies,
}: StoreFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [copySourceId, setCopySourceId] = useState<string>(COPY_NONE);
  const [preview, setPreview] = useState<CopyPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const defaultValues: FormValues =
    mode === 'edit' && store
      ? {
          name: store.name,
          country_id: store.country_id,
          currency_id: store.currency_id,
          timezone: store.timezone,
          service_fee_rate_pct: Math.round(store.service_fee_rate * 1000) / 10,
          employee_rebate_rate_pct: Math.round(store.employee_rebate_rate * 1000) / 10,
          fiscal_year_start_month: store.fiscal_year_start_month,
          display_order: store.display_order,
          is_weather_enabled: store.is_weather_enabled,
          is_event_enabled: store.is_event_enabled,
          established_date: store.established_date ?? '',
        }
      : {
          name: '',
          country_id: 'jp',
          currency_id: 'jpy',
          timezone: 'Asia/Tokyo',
          service_fee_rate_pct: 0,
          employee_rebate_rate_pct: 0,
          fiscal_year_start_month: 1,
          display_order: 0,
          is_weather_enabled: false,
          is_event_enabled: false,
          established_date: '',
        };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Reset form when dialog opens with new store
  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setCopySourceId(COPY_NONE);
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, store?.id, mode]);

  // コピー元選択：基本設定をフォームへ反映し、複製件数のプレビューを取得
  const handleCopySourceChange = (value: string) => {
    setCopySourceId(value);
    if (value === COPY_NONE) {
      setPreview(null);
      return;
    }
    const src = stores.find((s) => s.id === value);
    if (src) {
      setValue('country_id', src.country_id, { shouldDirty: true });
      setValue('currency_id', src.currency_id, { shouldDirty: true });
      setValue('timezone', src.timezone, { shouldDirty: true });
      setValue('service_fee_rate_pct', Math.round(src.service_fee_rate * 1000) / 10, { shouldDirty: true });
      setValue('employee_rebate_rate_pct', Math.round(src.employee_rebate_rate * 1000) / 10, { shouldDirty: true });
      setValue('fiscal_year_start_month', src.fiscal_year_start_month, { shouldDirty: true });
      setValue('is_weather_enabled', src.is_weather_enabled, { shouldDirty: true });
      setValue('is_event_enabled', src.is_event_enabled, { shouldDirty: true });
      // 店舗名・設立日はコピーしない（手入力のまま）
    }
    setPreview(null);
    setIsPreviewLoading(true);
    startTransition(async () => {
      const result = await getStoreCopyPreview(value);
      setIsPreviewLoading(false);
      if (result.success) setPreview(result.preview);
    });
  };

  const watchedCountry = watch('country_id');
  const watchedCurrency = watch('currency_id');
  const country = countries.find((c) => c.id === watchedCountry);
  const currency = currencies.find((c) => c.id === watchedCurrency);

  // Auto-update currency & timezone when country changes
  const handleCountryChange = (value: string) => {
    setValue('country_id', value, { shouldDirty: true });
    const defaults = COUNTRY_DEFAULTS[value];
    if (defaults) {
      const hasCurrency = currencies.some((c) => c.id === defaults.currencyId);
      if (hasCurrency) {
        setValue('currency_id', defaults.currencyId, { shouldDirty: true });
      }
      setValue('timezone', defaults.timezone, { shouldDirty: true });
    }
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        name: values.name,
        country_id: values.country_id,
        currency_id: values.currency_id,
        timezone: values.timezone,
        service_fee_rate: values.service_fee_rate_pct / 100,
        employee_rebate_rate: values.employee_rebate_rate_pct / 100,
        fiscal_year_start_month: values.fiscal_year_start_month,
        display_order: values.display_order,
        is_weather_enabled: values.is_weather_enabled,
        is_event_enabled: values.is_event_enabled,
        established_date: values.established_date?.trim() ? values.established_date : null,
      };

      const result =
        mode === 'create'
          ? await createStore(payload, copySourceId === COPY_NONE ? null : copySourceId)
          : await updateStore(store!.id, payload);

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            {mode === 'create' ? 'Add Store' : 'Edit Store'}
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === 'create' ? '新規店舗を追加' : '店舗を編集'}
          </DialogTitle>
          <DialogDescription>
            店舗の基本情報・通貨・税制・表示設定を管理します
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          {/* 本文だけをスクロールさせ、フッター（保存ボタン）は常に下部に固定する */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6">
          {mode === 'create' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Copy className="w-4 h-4 text-slate-500" />
                <h4 className="font-display text-sm font-bold text-slate-900">設定のコピー元</h4>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                既存店を選ぶと基本設定が下のフォームに自動入力され、保存時に仕入先・部門・計算式・科目の枠を複製します。
                店舗名・設立日・実績データ・金額は複製しません。
              </p>
              <Select value={copySourceId} onValueChange={handleCopySourceChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COPY_NONE}>コピーしない（白紙で登録）</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {String(s.store_no).padStart(3, '0')} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {copySourceId !== COPY_NONE && (
                <div className="mt-3 rounded-lg bg-white border border-slate-200 px-3 py-2.5">
                  {isPreviewLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      複製内容を確認中...
                    </div>
                  ) : preview ? (
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-500">保存時に複製：</span>{' '}
                      仕入先 <CopyCount n={preview.suppliers} />・カテゴリ{' '}
                      <CopyCount n={preview.purchase_categories} />・部門{' '}
                      <CopyCount n={preview.sales_departments} />・計算式{' '}
                      <CopyCount n={preview.expense_formulas} />・販管費科目の枠{' '}
                      <CopyCount n={preview.monthly_expense_frames} />
                      <div className="text-[10px] text-slate-400 mt-1">
                        ※ 科目の枠は金額0で当年度の期首月に作成（実績金額は複製しません）
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <FormSection number="01" title="基本情報">
            <FieldGroup>
              <Label>店舗番号</Label>
              {mode === 'edit' && store ? (
                <div className="flex items-center gap-2">
                  <span className="font-num text-lg font-bold tracking-wider text-slate-900 bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1">
                    {String(store.store_no).padStart(3, '0')}
                  </span>
                  <span className="text-[11px] text-slate-500">採番後は変更できません</span>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500">
                  保存時に次の空き番号を<span className="font-medium text-slate-700">自動採番</span>します（例：004）。採番後は変更できません。
                </div>
              )}
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="name">
                店舗名 <RequiredMark />
              </Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="例：みせPL 渋谷店、居酒屋 まる"
                autoFocus={mode === 'create'}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </FieldGroup>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup>
                <Label htmlFor="country">
                  国 <RequiredMark />
                </Label>
                <Controller
                  control={control}
                  name="country_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={handleCountryChange}>
                      <SelectTrigger id="country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.country_id && <FieldError>{errors.country_id.message}</FieldError>}
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="currency">
                  通貨 <RequiredMark />
                </Label>
                <Controller
                  control={control}
                  name="currency_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.symbol} {c.code} ({c.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.currency_id && <FieldError>{errors.currency_id.message}</FieldError>}
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label htmlFor="timezone">
                タイムゾーン <RequiredMark />
              </Label>
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.timezone && <FieldError>{errors.timezone.message}</FieldError>}
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="established_date">設立日（任意）</Label>
              <Input id="established_date" type="date" {...register('established_date')} />
              {errors.established_date && (
                <FieldError>{errors.established_date.message}</FieldError>
              )}
            </FieldGroup>
          </FormSection>

          <FormSection number="02" title="売上計算・月次PL設定">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup>
                <Label htmlFor="service_fee_rate_pct">
                  サービス料率（%） <RequiredMark />
                </Label>
                <div className="relative">
                  <Input
                    id="service_fee_rate_pct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="pr-10 text-right font-num"
                    {...register('service_fee_rate_pct', { valueAsNumber: true })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>
                {errors.service_fee_rate_pct && (
                  <FieldError>{errors.service_fee_rate_pct.message}</FieldError>
                )}
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="employee_rebate_rate_pct">
                  社員還付金率（%） <RequiredMark />
                </Label>
                <div className="relative">
                  <Input
                    id="employee_rebate_rate_pct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="pr-10 text-right font-num"
                    {...register('employee_rebate_rate_pct', { valueAsNumber: true })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">社員還付金 = 売上 × この率（月次PL用）</p>
                {errors.employee_rebate_rate_pct && (
                  <FieldError>{errors.employee_rebate_rate_pct.message}</FieldError>
                )}
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup>
                <Label htmlFor="fiscal_year_start_month">
                  決算期の期首月 <RequiredMark />
                </Label>
                <Controller
                  control={control}
                  name="fiscal_year_start_month"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger id="fiscal_year_start_month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {m}月始まり
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-[11px] text-slate-500">12ヶ月横並びPLの起点</p>
                {errors.fiscal_year_start_month && (
                  <FieldError>{errors.fiscal_year_start_month.message}</FieldError>
                )}
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="display_order">表示順</Label>
                <Input
                  id="display_order"
                  type="number"
                  step="1"
                  min="0"
                  className="text-right font-num"
                  {...register('display_order', { valueAsNumber: true })}
                />
                {errors.display_order && (
                  <FieldError>{errors.display_order.message}</FieldError>
                )}
              </FieldGroup>
            </div>

            {country && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">
                  {country.name}の税制（自動設定）
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-display text-base font-bold text-slate-900">
                    {country.tax_label} {(country.tax_rate * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-600">
                    {country.tax_base === 'net_plus_service'
                      ? '税抜売上＋サービス料に課税'
                      : '税抜売上のみに課税'}
                  </div>
                </div>
                {currency && (
                  <div className="text-xs text-slate-500 mt-1.5">
                    通貨: {currency.symbol} {currency.code} ({currency.name})
                  </div>
                )}
              </div>
            )}
          </FormSection>

          <FormSection number="03" title="機能フラグ">
            <Controller
              control={control}
              name="is_weather_enabled"
              render={({ field }) => (
                <ToggleRow
                  icon={CloudSun}
                  title="天気を記録する"
                  description="日次入力で天気欄を表示（売上分析用）"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="is_event_enabled"
              render={({ field }) => (
                <ToggleRow
                  icon={Sparkles}
                  title="イベントを記録する"
                  description="日次入力でメモ欄を表示（プロモ・特殊事象の記録用）"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </FormSection>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 gap-2">
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

function FormSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-num text-[10px] font-bold tracking-widest text-slate-400">
          {number}
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <h4 className="font-display text-sm font-bold text-slate-900">{title}</h4>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function CopyCount({ n }: { n: number }) {
  return (
    <span className="font-num font-bold text-slate-900">
      {n}
      <span className="text-slate-400 font-normal">件</span>
    </span>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-rose-600 font-medium">{children}</p>;
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Sun;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors',
        checked ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
          checked ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400',
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-1.5" />
    </label>
  );
}
