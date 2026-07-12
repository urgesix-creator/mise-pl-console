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
import { cn } from '@/lib/utils';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/permissions/constants';
import { createUser, updateUser } from '../actions';
import type { CountryOption, StoreOption, UserRow } from './types';

// 全店アクセス（割当不要）のロール。割当UIの注記用（既定値準拠）
const ALL_ACCESS_ROLES: Role[] = ['executive', 'accounting'];

const formSchema = z.object({
  email: z.string().trim().email('メールアドレスが正しくありません').max(200),
  display_name: z.string().trim().min(1, '氏名を入力してください').max(100),
  role: z.enum(ROLES),
  country_id: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  user: UserRow | null;
  stores: StoreOption[];
  countries: CountryOption[];
  /** 作成成功時、仮パスワードを親へ通知（1回表示用） */
  onCreated: (tempPassword: string, name: string) => void;
};

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  user,
  stores,
  countries,
  onCreated,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<'email' | 'password'>('email');

  const defaultValues: FormValues =
    mode === 'edit' && user
      ? {
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          country_id: user.country_id ?? '',
        }
      : { email: '', display_name: '', role: 'staff', country_id: '' };

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setSelectedStores(new Set(mode === 'edit' && user ? user.store_ids : []));
      setMethod('email');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, mode]);

  const watchedRole = watch('role');
  const isAllAccess = ALL_ACCESS_ROLES.includes(watchedRole);
  const needsCountry = watchedRole === 'country_rep';

  const toggleStore = (id: string) => {
    setSelectedStores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        email: values.email,
        display_name: values.display_name,
        role: values.role,
        country_id: needsCountry ? (values.country_id || null) : null,
        store_ids: isAllAccess ? [] : Array.from(selectedStores),
      };

      if (mode === 'create') {
        const res = await createUser({ ...payload, method });
        if (res.success) {
          onOpenChange(false);
          if (res.method === 'password') {
            onCreated(res.tempPassword, values.display_name);
          } else {
            toast.success(`${values.display_name} さんに招待メールを送信しました`);
          }
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await updateUser(user!.id, {
          display_name: payload.display_name,
          role: payload.role,
          country_id: payload.country_id,
          store_ids: payload.store_ids,
        });
        if (res.success) {
          toast.success('ユーザー情報を更新しました');
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
            {mode === 'create' ? 'Invite User' : 'Edit User'}
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === 'create' ? 'ユーザーを招待' : 'ユーザーを編集'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '認証アカウントを作成し、仮パスワードを発行します（メールは送信しません）。'
              : '氏名・ロール・担当国・割当店舗を変更します。'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label>招待方式</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('email')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors',
                    method === 'email'
                      ? 'border-slate-900 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  )}
                >
                  メール招待
                  <span className={cn('block text-[10px] font-normal mt-0.5', method === 'email' ? 'text-slate-300' : 'text-slate-400')}>
                    リンクで本人が設定
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('password')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors',
                    method === 'password'
                      ? 'border-slate-900 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  )}
                >
                  仮パスワード
                  <span className={cn('block text-[10px] font-normal mt-0.5', method === 'password' ? 'text-slate-300' : 'text-slate-400')}>
                    メール不要・画面に表示
                  </span>
                </button>
              </div>
              {method === 'email' && (
                <p className="text-[11px] text-amber-600">
                  ※ メール送信には Supabase 側の SMTP・リダイレクトURL設定が必要です（未設定だと送信に失敗します）。
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="user-email">
              メールアドレス <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="user-email"
              type="email"
              {...register('email')}
              disabled={mode === 'edit'}
              placeholder="user@example.com"
              autoFocus={mode === 'create'}
            />
            {mode === 'edit' && (
              <p className="text-[11px] text-slate-500">メールアドレスは作成後に変更できません</p>
            )}
            {errors.email && <p className="text-xs text-rose-600 font-medium">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-name">
              氏名 <span className="text-rose-500">*</span>
            </Label>
            <Input id="user-name" {...register('display_name')} placeholder="例：山田 太郎" maxLength={100} />
            {errors.display_name && (
              <p className="text-xs text-rose-600 font-medium">{errors.display_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                ロール <span className="text-rose-500">*</span>
              </Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>担当国 {needsCountry && <span className="text-rose-500">*</span>}</Label>
              <Controller
                control={control}
                name="country_id"
                render={({ field }) => (
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    disabled={!needsCountry}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">指定なし</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {needsCountry && (
            <p className="text-[11px] text-slate-500 -mt-2">各国代表は担当国の店舗にアクセスできます。</p>
          )}

          {/* 店舗割当 */}
          <div className="space-y-1.5">
            <Label>担当店舗</Label>
            {isAllAccess ? (
              <p className="text-sm text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                このロールは全店アクセスのため、店舗割当は不要です。
              </p>
            ) : stores.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                有効な店舗がありません。
              </p>
            ) : (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {stores.map((s) => {
                  const checked = selectedStores.has(s.id);
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
                        onChange={() => toggleStore(s.id)}
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
            {needsCountry && (
              <p className="text-[11px] text-slate-500">
                各国代表は担当国で自動的にアクセスできます（個別割当は任意）。
              </p>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'create' ? '招待する' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
