'use client';

import Link from 'next/link';
import { ChevronRight, ScrollText } from 'lucide-react';
import { AUDIT_ACTION_LABELS } from '@/lib/audit/constants';

export type AuditLogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  details: unknown;
  created_at: string;
};

/** ISO日時を日本時間で表示 */
function formatJst(iso: string): string {
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

function summarizeDetails(details: unknown): string {
  if (details === null || details === undefined) return '';
  if (typeof details !== 'object') return String(details);
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' / ');
}

export function AuditClient({ logs }: { logs: AuditLogRow[] }) {
  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">監査ログ</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <ScrollText className="w-7 h-7 text-slate-700" />
          監査ログ
        </h1>
        <p className="text-sm text-slate-600">
          権限変更・ユーザー管理などの操作履歴（直近200件・新しい順）。記録は追記専用です。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold min-w-[140px]">日時（JST）</th>
              <th className="px-3 py-3 font-semibold">操作者</th>
              <th className="px-3 py-3 font-semibold">操作</th>
              <th className="px-3 py-3 font-semibold">対象</th>
              <th className="px-3 py-3 font-semibold">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/60 align-top">
                <td className="px-4 py-2.5 font-num text-xs text-slate-600 whitespace-nowrap">
                  {formatJst(l.created_at)}
                </td>
                <td className="px-3 py-2.5 text-slate-700 text-xs break-all">{l.actor_email ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-block text-[11px] font-medium bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 text-slate-700 whitespace-nowrap">
                    {AUDIT_ACTION_LABELS[l.action] ?? l.action}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-700 text-xs break-all">{l.target_label ?? '—'}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs break-all">{summarizeDetails(l.details) || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                  記録はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-slate-500">· ログは改ざん防止のため更新・削除できません（追記専用）。</div>
    </div>
  );
}
