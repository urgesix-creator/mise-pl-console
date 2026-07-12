'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight, ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLES,
  ROLE_LABELS,
  LOCKED_PERMISSION,
  type Capability,
  type Role,
} from '@/lib/permissions/constants';
import { updateRolePermission } from '../actions';

type Matrix = Record<string, Record<string, boolean>>;

export function PermissionsClient({ matrix }: { matrix: Matrix }) {
  // ローカル state（楽観更新）。matrix[cap][role] が無ければ false。
  const [state, setState] = useState<Matrix>(() => {
    const m: Matrix = {};
    for (const cap of CAPABILITIES) {
      m[cap] = {};
      for (const role of ROLES) m[cap][role] = matrix[cap]?.[role] ?? false;
    }
    return m;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isLocked = (cap: Capability, role: Role) =>
    cap === LOCKED_PERMISSION.capability && role === LOCKED_PERMISSION.role;

  const toggle = (cap: Capability, role: Role) => {
    if (isLocked(cap, role)) return;
    const next = !state[cap][role];
    const key = `${cap}:${role}`;
    // 楽観更新
    setState((prev) => ({ ...prev, [cap]: { ...prev[cap], [role]: next } }));
    setPendingKey(key);
    startTransition(async () => {
      const res = await updateRolePermission(cap, role, next);
      setPendingKey(null);
      if (!res.success) {
        // 失敗：元に戻す
        setState((prev) => ({ ...prev, [cap]: { ...prev[cap], [role]: !next } }));
        toast.error(res.error);
      } else {
        toast.success('権限を更新しました');
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">権限設定</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Admin · Permissions</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <ShieldCheck className="w-7 h-7 text-slate-700" />
          権限設定
        </h1>
        <p className="text-sm text-slate-600">
          ロールごとの「できること（能力）」を切り替えます。変更は保存と同時に各画面・DB（RLS）へ反映されます。
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
        チェックを入れると、そのロールに能力が付与されます。
        <span className="inline-flex items-center gap-1 mx-1 text-slate-500"><Lock className="w-3 h-3" />鍵</span>
        の項目（経営層の「経営マスタ編集」）は、ロックアウト防止のため無効化できません。
        店舗の閲覧範囲（自国・割当）は別途固定です（「全店データ閲覧」のみ設定対象）。
      </div>

      {/* Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left font-semibold px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                能力
              </th>
              {ROLES.map((role) => (
                <th key={role} className="px-3 py-3 text-center text-[11px] font-semibold text-slate-600 min-w-[92px]">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {CAPABILITIES.map((cap) => (
              <tr key={cap} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <div className="font-medium text-slate-900">{CAPABILITY_LABELS[cap].title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{CAPABILITY_LABELS[cap].desc}</div>
                </td>
                {ROLES.map((role) => {
                  const locked = isLocked(cap, role);
                  const checked = state[cap][role];
                  const key = `${cap}:${role}`;
                  return (
                    <td key={role} className="px-3 py-3 text-center">
                      <label className="inline-flex items-center justify-center">
                        {pendingKey === key ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : locked ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-600 text-white"
                            title="ロックアウト防止のため変更不可"
                          >
                            <Lock className="w-3 h-3" />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(cap, role)}
                            className={cn(
                              'w-4 h-4 rounded cursor-pointer accent-brand-600',
                            )}
                          />
                        )}
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· 変更はその場で保存され、RLS（DB）・Server Action・画面の出し分けに即反映されます。</p>
        <p>· 既定値（現状の標準設定）に戻したい場合は、各セルを手動で調整してください。</p>
        <p>· ロールを実際に運用するには、ユーザー管理（招待・ロール付与・店舗割当）が別途必要です（準備中）。</p>
      </div>
    </div>
  );
}
