'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Users as UsersIcon,
  Plus,
  Pencil,
  Power,
  PowerOff,
  KeyRound,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, type Role } from '@/lib/permissions/constants';
import { UserFormDialog } from './user-form-dialog';
import { setUserActive, resetUserPassword, deleteUser } from '../actions';
import type { CountryOption, StoreOption, UserRow } from './types';

type DialogState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; user: UserRow };
type Secret = { title: string; name: string; password: string };

export function UsersClient({
  users,
  stores,
  countries,
  currentUserId,
}: {
  users: UserRow[];
  stores: StoreOption[];
  countries: CountryOption[];
  currentUserId: string;
}) {
  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' });
  const [secret, setSecret] = useState<Secret | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();

  const countryById = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const storeNoById = useMemo(() => new Map(stores.map((s) => [s.id, s.store_no])), [stores]);

  const toggleActive = (u: UserRow) => {
    setPendingId(u.id);
    startTransition(async () => {
      const res = await setUserActive(u.id, !u.is_active);
      setPendingId(null);
      if (res.success) toast.success(u.is_active ? `${u.display_name} を無効化しました` : `${u.display_name} を有効化しました`);
      else toast.error(res.error);
    });
  };

  const resetPassword = (u: UserRow) => {
    setPendingId(u.id);
    startTransition(async () => {
      const res = await resetUserPassword(u.id);
      setPendingId(null);
      if (res.success) {
        setCopied(false);
        setSecret({ title: 'パスワードを再発行しました', name: u.display_name, password: res.tempPassword });
      } else {
        toast.error(res.error);
      }
    });
  };

  const doDelete = () => {
    const u = deleteTarget;
    if (!u) return;
    setPendingId(u.id);
    startTransition(async () => {
      const res = await deleteUser(u.id);
      setPendingId(null);
      setDeleteTarget(null);
      if (res.success) toast.success(`${u.display_name} を削除しました`);
      else toast.error(res.error);
    });
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopied(true);
    } catch {
      toast.error('コピーに失敗しました。手動で選択してください');
    }
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">ユーザー管理</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Admin · Users</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
            <UsersIcon className="w-7 h-7 text-slate-700" />
            ユーザー管理
          </h1>
          <p className="text-sm text-slate-600">
            ユーザーの招待・ロール付与・店舗割当・有効化を管理します（権限は「権限設定」で定義）。
          </p>
        </div>
        <Button onClick={() => setDialogState({ mode: 'create' })} className="flex-shrink-0">
          <Plus className="w-4 h-4" />
          ユーザーを招待
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">ユーザー</th>
              <th className="px-3 py-3 font-semibold">ロール</th>
              <th className="px-3 py-3 font-semibold">担当国</th>
              <th className="px-3 py-3 font-semibold">割当店舗</th>
              <th className="px-3 py-3 font-semibold">状態</th>
              <th className="px-3 py-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const country = u.country_id ? countryById.get(u.country_id) : null;
              const busy = pendingId === u.id;
              return (
                <tr key={u.id} className={cn('hover:bg-slate-50/60', !u.is_active && 'bg-slate-50/60')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 flex items-center gap-1.5">
                      {u.display_name}
                      {u.id === currentUserId && (
                        <span className="text-[10px] text-slate-400">（あなた）</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 text-slate-700">
                      <ShieldCheck className="w-3 h-3 text-slate-400" />
                      {ROLE_LABELS[u.role as Role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {country ? `${country.flag ?? ''} ${country.name}` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {u.store_ids.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="font-num text-xs text-slate-600">
                        {u.store_ids
                          .map((id) => storeNoById.get(id))
                          .filter((n): n is number => n !== undefined)
                          .sort((a, b) => a - b)
                          .map((n) => String(n).padStart(3, '0'))
                          .join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {u.is_active ? (
                      <span className="text-[11px] font-semibold text-emerald-700">有効</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-rose-700">無効</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDialogState({ mode: 'edit', user: u })}
                        aria-label="編集"
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(u)}
                        disabled={busy}
                        aria-label="パスワード再発行"
                        title="パスワード再発行"
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={busy || u.id === currentUserId}
                        aria-label={u.is_active ? '無効化' : '有効化'}
                        title={u.id === currentUserId ? '自分自身は無効化できません' : u.is_active ? '無効化' : '有効化'}
                        className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed',
                          u.is_active ? 'hover:text-rose-700' : 'hover:text-emerald-700',
                        )}
                      >
                        {u.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(u)}
                        disabled={busy || u.id === currentUserId}
                        aria-label="削除"
                        title={u.id === currentUserId ? '自分自身は削除できません' : '完全に削除'}
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                  ユーザーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· 招待は「メール招待」（リンクで本人がパスワード設定）か「仮パスワード」（メール不要・画面に表示し本人へ手動連絡）を選べます。メール招待には Supabase 側のメール(SMTP)・リダイレクトURL設定が必要です。</p>
        <p>· 各ロールの「できること」は「権限設定」で定義されます。店舗の閲覧範囲は、各国代表＝担当国／店長・現場＝割当店舗です。</p>
        <p>· 退職等は通常「無効化」（ソフト削除）で記録を残します。誤った招待など不要なユーザーは「削除」（ゴミ箱）で完全に削除できます（取り消し不可・自分自身は無効化/削除不可）。</p>
      </div>

      {/* Form dialog */}
      <UserFormDialog
        open={dialogState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setDialogState({ mode: 'closed' });
        }}
        mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
        user={dialogState.mode === 'edit' ? dialogState.user : null}
        stores={stores}
        countries={countries}
        onCreated={(password, name) => {
          setCopied(false);
          setSecret({ title: 'ユーザーを招待しました', name, password });
        }}
      />

      {/* 仮パスワード表示（1回） */}
      <Dialog open={secret !== null} onOpenChange={(o) => { if (!o) setSecret(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-slate-700" />
              {secret?.title}
            </DialogTitle>
            <DialogDescription>
              {secret?.name} さんの仮パスワードです。<strong>この画面でしか表示されません。</strong>本人に安全な方法で伝えてください。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 font-num text-base bg-brand-600 text-white rounded-lg px-3 py-2.5 tracking-wider break-all">
                {secret?.password}
              </code>
              <Button type="button" variant="outline" onClick={copy} className="flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'コピー済' : 'コピー'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              初回ログイン後、本人にパスワード変更（プロフィール画面）を促してください。
            </p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSecret(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除の確認 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              ユーザーを削除しますか？
            </DialogTitle>
            <DialogDescription>
              <strong className="text-slate-900">{deleteTarget?.display_name}</strong>（{deleteTarget?.email}）を
              <strong>完全に削除</strong>します。アカウント・店舗割当も消え、<strong>取り消しできません</strong>。
              （操作履歴は監査ログに残ります）
            </DialogDescription>
          </DialogHeader>
          <p className="text-[12px] text-slate-500 py-1">
            退職など記録を残したい場合は、削除ではなく「無効化」をご利用ください。
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={doDelete}
              disabled={pendingId === deleteTarget?.id}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {pendingId === deleteTarget?.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              完全に削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
