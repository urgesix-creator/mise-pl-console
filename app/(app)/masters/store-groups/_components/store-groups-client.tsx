'use client';

import { useMemo, useState, useTransition } from 'react';
import { Layers, Plus, Pencil, Power, PowerOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StoreGroupFormDialog } from './store-group-form-dialog';
import { setStoreGroupActive } from '../actions';
import type { GroupStore, Role, StoreGroupWithMembers } from './types';

type StoreGroupsClientProps = {
  groups: StoreGroupWithMembers[];
  activeStores: GroupStore[];
  canWrite: boolean;
};

export function StoreGroupsClient({ groups, activeStores, canWrite }: StoreGroupsClientProps) {

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<StoreGroupWithMembers | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isPending, startTransition] = useTransition();

  const nextDisplayOrder = useMemo(
    () => (groups.length > 0 ? Math.max(...groups.map((g) => g.display_order)) + 1 : 1),
    [groups],
  );

  const visible = useMemo(
    () => groups.filter((g) => showInactive || g.is_active),
    [groups, showInactive],
  );

  const openCreate = () => {
    setMode('create');
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (g: StoreGroupWithMembers) => {
    setMode('edit');
    setEditing(g);
    setDialogOpen(true);
  };

  const toggleActive = (g: StoreGroupWithMembers) => {
    startTransition(async () => {
      const result = await setStoreGroupActive(g.id, !g.is_active);
      if (result.success) {
        toast.success(g.is_active ? `「${g.name}」を無効化しました` : `「${g.name}」を有効化しました`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Masters · Store Groups</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-3">
              <Layers className="w-7 h-7 text-slate-700" />
              店舗グループ
            </h1>
            <p className="text-sm text-slate-600">
              複数店舗をまとめるグループを管理します。期間集計ページの絞り込み・合計に使用します。
            </p>
          </div>
          {canWrite && (
            <Button onClick={openCreate} className="flex-shrink-0">
              <Plus className="w-4 h-4" />
              グループを追加
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-end">
        <label className="flex items-center gap-2 cursor-pointer select-none px-1 py-1">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer accent-brand-600"
          />
          <span className="text-sm text-slate-700">無効化されたグループも表示</span>
        </label>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">グループ名</th>
              <th className="px-3 py-3 font-semibold">所属店舗</th>
              <th className="px-3 py-3 font-semibold text-right">店舗数</th>
              <th className="px-3 py-3 font-semibold text-right">表示順</th>
              <th className="px-3 py-3 font-semibold">状態</th>
              {canWrite && <th className="px-3 py-3 font-semibold text-right">操作</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((g) => (
              <tr key={g.id} className={cn('border-b border-slate-100 last:border-0', !g.is_active && 'bg-slate-50/60')}>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{g.name}</span>
                </td>
                <td className="px-3 py-3">
                  {g.members.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {g.members.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                        >
                          <span className="font-num font-bold">{String(m.store_no).padStart(3, '0')}</span>
                          <span className="truncate max-w-[140px]">{m.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-num text-slate-700">{g.members.length}</td>
                <td className="px-3 py-3 text-right font-num text-slate-400">{g.display_order}</td>
                <td className="px-3 py-3">
                  {g.is_active ? (
                    <span className="text-[11px] font-semibold text-emerald-700">有効</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-rose-700">無効</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        aria-label={`${g.name}を編集`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(g)}
                        disabled={isPending}
                        aria-label={g.is_active ? `${g.name}を無効化` : `${g.name}を有効化`}
                        className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100',
                          g.is_active ? 'hover:text-rose-700' : 'hover:text-emerald-700',
                        )}
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : g.is_active ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-12 text-center text-sm text-slate-500">
                  店舗グループが登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!canWrite && (
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
          閲覧のみ（店舗グループの編集は経営層のみ可能です）。
        </div>
      )}

      {canWrite && (
        <StoreGroupFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={mode}
          group={editing}
          activeStores={activeStores}
          nextDisplayOrder={nextDisplayOrder}
        />
      )}
    </div>
  );
}
