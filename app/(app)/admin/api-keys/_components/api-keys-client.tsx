'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  KeyRound,
  Plus,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Ban,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createApiKey, revokeApiKey } from '../actions';

export type ApiKeyRow = {
  id: string;
  label: string;
  key_prefix: string;
  scope: 'read' | 'read_write';
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ApiKeysClient({ keys }: { keys: ApiKeyRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      toast.error('コピーに失敗しました。手動で選択してください');
    }
  };

  const doRevoke = () => {
    if (!revokeTarget) return;
    const t = revokeTarget;
    startTransition(async () => {
      const res = await revokeApiKey(t.id);
      if (res.success) {
        toast.success(`「${t.label}」を失効しました`);
        setRevokeTarget(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">APIキー</span>
      </nav>

      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
            <KeyRound className="w-7 h-7 text-slate-700" />
            APIキー
          </h1>
          <p className="text-sm text-slate-600">
            外部AI・ツール連携用の REST API キーを発行・失効します（<code className="text-xs">/api/v1</code>）。
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex-shrink-0">
          <Plus className="w-4 h-4" />
          キーを発行
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
        キーは <code>Authorization: Bearer &lt;APIキー&gt;</code> で送ります。平文は発行時にのみ表示され、再表示できません。
        AI に渡したデータは外部AI事業者側にも渡る点にご注意ください（機微な財務データの取り扱い）。
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">ラベル</th>
              <th className="px-3 py-3 font-semibold">キー</th>
              <th className="px-3 py-3 font-semibold">権限</th>
              <th className="px-3 py-3 font-semibold">最終利用</th>
              <th className="px-3 py-3 font-semibold">状態</th>
              <th className="px-3 py-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {keys.map((k) => (
              <tr key={k.id} className={cn('hover:bg-slate-50/60', !k.is_active && 'bg-slate-50/60 opacity-70')}>
                <td className="px-4 py-3 font-medium text-slate-900">{k.label}</td>
                <td className="px-3 py-3 font-num text-xs text-slate-500">{k.key_prefix}…</td>
                <td className="px-3 py-3">
                  {k.scope === 'read_write' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-2 py-0.5">
                      <AlertTriangle className="w-3 h-3" /> 読み書き
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
                      読み取り専用
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 font-num text-xs text-slate-600 whitespace-nowrap">{fmt(k.last_used_at)}</td>
                <td className="px-3 py-3">
                  {k.is_active ? (
                    <span className="text-[11px] font-semibold text-emerald-700">有効</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-rose-700">失効</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {k.is_active && (
                    <Button variant="outline" size="sm" onClick={() => setRevokeTarget(k)} className="h-8">
                      <Ban className="w-3.5 h-3.5" />
                      失効
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">APIキーはまだありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(raw) => {
          setCopied(false);
          setSecret(raw);
        }}
      />

      {/* 発行されたキー（1回表示） */}
      <Dialog open={secret !== null} onOpenChange={(o) => { if (!o) setSecret(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-slate-700" /> APIキーを発行しました
            </DialogTitle>
            <DialogDescription>
              <strong>この画面でしか表示されません。</strong>安全な場所に保管してください。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex items-center gap-2">
            <code className="flex-1 font-num text-sm bg-brand-600 text-white rounded-lg px-3 py-2.5 break-all">{secret}</code>
            <Button type="button" variant="outline" onClick={copy} className="flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'コピー済' : 'コピー'}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSecret(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 失効確認 */}
      <Dialog open={revokeTarget !== null} onOpenChange={(o) => { if (!o && !pending) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">APIキーを失効</DialogTitle>
            <DialogDescription>
              「{revokeTarget?.label}」を失効します。このキーを使う連携は直ちに利用できなくなります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={pending}>キャンセル</Button>
            <Button variant="destructive" onClick={doRevoke} disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              失効する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (rawKey: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<'read' | 'read_write'>('read');
  const [ack, setAck] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setLabel('');
      setScope('read');
      setAck(false);
    }
  }, [open]);

  const canSubmit = label.trim() !== '' && (scope === 'read' || ack);

  const submit = () => {
    startTransition(async () => {
      const res = await createApiKey({ label, scope, acknowledged: ack });
      if (res.success) {
        onOpenChange(false);
        onCreated(res.rawKey);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">APIキーを発行</DialogTitle>
          <DialogDescription>外部AI・ツールからの利用に使います。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="key-label">ラベル（用途）</Label>
            <Input id="key-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例：Claude連携（読み取り）" maxLength={100} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>権限</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('read')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors',
                  scope === 'read' ? 'border-slate-900 bg-brand-600 text-white' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                読み取り専用
                <span className={cn('block text-[10px] font-normal mt-0.5', scope === 'read' ? 'text-slate-300' : 'text-slate-400')}>推奨・安全</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('read_write')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors',
                  scope === 'read_write' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                読み書き
                <span className={cn('block text-[10px] font-normal mt-0.5', scope === 'read_write' ? 'text-rose-100' : 'text-slate-400')}>強力・要注意</span>
              </button>
            </div>
          </div>

          {scope === 'read_write' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" /> 書き込み可キーのリスク
              </div>
              <ul className="text-[12px] text-rose-900/90 leading-relaxed list-disc pl-5 space-y-1">
                <li>このキーを持つ相手は、API 経由で<strong>売上などのデータを変更/上書き</strong>できます。</li>
                <li>キーが漏えいすると、第三者にデータを改ざんされる恐れがあります。</li>
                <li>外部AI（Claude/OpenAI等）に渡すと、データはそのAI事業者側にも渡ります。</li>
                <li>用途が「参照のみ」なら<strong>読み取り専用</strong>を選んでください。書き込みは必要な場合のみ。</li>
              </ul>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-rose-600" />
                <span className="text-[12px] text-rose-900 font-medium">上記リスクを理解し、書き込み可キーの発行に同意します。</span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>キャンセル</Button>
          <Button type="button" onClick={submit} disabled={pending || !canSubmit}>
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            発行する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
