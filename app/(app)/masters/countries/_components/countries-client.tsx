'use client';

import { useMemo, useState } from 'react';
import { Globe, Info, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountryFormDialog } from './country-form-dialog';
import { TAX_BASE_LABELS } from '../_schemas';
import type { CountryWithMeta, Role } from './types';

type CountriesClientProps = {
  countries: CountryWithMeta[];
  canWrite: boolean;
};

export function CountriesClient({ countries, canWrite }: CountriesClientProps) {

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<CountryWithMeta | null>(null);

  const nextDisplayOrder = useMemo(
    () => (countries.length > 0 ? Math.max(...countries.map((c) => c.display_order)) + 1 : 1),
    [countries],
  );

  const openCreate = () => {
    setMode('create');
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: CountryWithMeta) => {
    setMode('edit');
    setEditing(c);
    setDialogOpen(true);
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Masters · Countries</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-3">
              <Globe className="w-7 h-7 text-slate-700" />
              国マスタ
            </h1>
            <p className="text-sm text-slate-600">
              各国の税率・課税ベース・課税ラベルを管理します。税率は売上保存時の税計算で参照されます。
            </p>
          </div>
          {canWrite && (
            <Button onClick={openCreate} className="flex-shrink-0">
              <Plus className="w-4 h-4" />
              国を追加
            </Button>
          )}
        </div>
      </div>

      {/* 注意バナー：税率変更の影響範囲 */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] leading-relaxed text-slate-600">
          税率・課税ベースの変更は<strong>今後の売上保存・Excel再取込</strong>に適用されます。
          <strong>過去の保存済みデータ（確定済みの税額）は変わりません</strong>（税額は保存時に固定）。
        </p>
      </div>

      {/* 一覧テーブル */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">国</th>
              <th className="px-3 py-3 font-semibold">コード</th>
              <th className="px-3 py-3 font-semibold text-right">税率</th>
              <th className="px-3 py-3 font-semibold">課税ラベル</th>
              <th className="px-3 py-3 font-semibold">課税ベース</th>
              <th className="px-3 py-3 font-semibold text-right">使用店舗</th>
              <th className="px-3 py-3 font-semibold text-right">表示順</th>
              {canWrite && <th className="px-3 py-3 font-semibold text-right">操作</th>}
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.flag ?? '🏳️'}</span>
                    <span className="font-medium text-slate-900">{c.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-slate-600">{c.code}</td>
                <td className="px-3 py-3 text-right font-num font-semibold text-slate-900">
                  {(c.tax_rate * 100).toFixed(c.tax_rate * 100 % 1 === 0 ? 0 : 2)}%
                </td>
                <td className="px-3 py-3 text-slate-700">{c.tax_label}</td>
                <td className="px-3 py-3 text-[12px] text-slate-600">
                  {TAX_BASE_LABELS[c.tax_base]}
                </td>
                <td className="px-3 py-3 text-right font-num text-slate-600">{c.store_count}</td>
                <td className="px-3 py-3 text-right font-num text-slate-400">{c.display_order}</td>
                {canWrite && (
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      aria-label={`${c.name}を編集`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {countries.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-4 py-12 text-center text-sm text-slate-500">
                  国が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!canWrite && (
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
          閲覧のみ（国マスタの編集は経営層のみ可能です）。
        </div>
      )}

      {canWrite && (
        <CountryFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={mode}
          country={editing}
          nextDisplayOrder={nextDisplayOrder}
        />
      )}
    </div>
  );
}
