'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, UserCircle, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateMyName, updateMyPassword } from '../actions';

type Props = {
  displayName: string;
  email: string;
  roleLabel: string;
  countryLabel: string | null;
  storeLabels: string[];
};

export function ProfileClient({ displayName, email, roleLabel, countryLabel, storeLabels }: Props) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [savingName, startName] = useTransition();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, startPw] = useTransition();

  const saveName = () => {
    startName(async () => {
      const res = await updateMyName(name);
      if (res.success) {
        toast.success('氏名を更新しました');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const savePassword = () => {
    if (newPw !== confirmPw) {
      toast.error('新しいパスワードが一致しません');
      return;
    }
    startPw(async () => {
      const res = await updateMyPassword(currentPw, newPw);
      if (res.success) {
        toast.success('パスワードを変更しました');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">プロフィール</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <UserCircle className="w-7 h-7 text-slate-700" />
          プロフィール
        </h1>
        <p className="text-sm text-slate-600">氏名とパスワードを変更できます。ロール・担当・割当は管理者が設定します。</p>
      </div>

      {/* アカウント情報（読み取り） */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">アカウント情報</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Info label="メールアドレス" value={email} mono />
          <Info
            label="ロール"
            value={<span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-slate-400" />{roleLabel}</span>}
          />
          <Info label="担当国" value={countryLabel ?? '—'} />
          <Info label="割当店舗" value={storeLabels.length > 0 ? storeLabels.join(' / ') : '—'} />
        </dl>
      </div>

      {/* 氏名変更 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">氏名</div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="name">表示名</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <Button onClick={saveName} disabled={savingName || name.trim() === '' || name === displayName}>
            {savingName && <Loader2 className="w-4 h-4 animate-spin" />}
            保存
          </Button>
        </div>
      </div>

      {/* パスワード変更 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" /> パスワード変更
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur">現在のパスワード</Label>
            <Input id="cur" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new">新しいパスワード</Label>
              <Input id="new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conf">新しいパスワード（確認）</Label>
              <Input id="conf" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">8文字以上・英字と数字を含めてください。</p>
          <div className="flex justify-end">
            <Button
              onClick={savePassword}
              disabled={savingPw || !currentPw || !newPw || !confirmPw}
            >
              {savingPw && <Loader2 className="w-4 h-4 animate-spin" />}
              パスワードを変更
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={mono ? 'text-slate-900 font-num break-all' : 'text-slate-900'}>{value}</dd>
    </div>
  );
}
