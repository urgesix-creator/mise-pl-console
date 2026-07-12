'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Truck,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base64ToUint8Array } from '@/lib/xlsx-utils';
import {
  downloadSupplierTemplate,
  dryRunSupplierImport,
  commitSupplierImport,
  type SupplierImportPreview,
} from '../_lib/supplier-import-actions';

type StoreLite = { id: string; name: string };

function triggerDownload(base64: string, filename: string): void {
  const blob = new Blob([base64ToUint8Array(base64)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SupplierImportCard({ stores }: { stores: StoreLite[] }) {
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'tpl' | 'previewing' | 'committing'>('idle');
  const [preview, setPreview] = useState<SupplierImportPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setDone(null);
  };

  const onTemplate = async () => {
    setPhase('tpl');
    try {
      const res = await downloadSupplierTemplate();
      if (res.ok) triggerDownload(res.base64, '仕入先取込テンプレート.xlsx');
      else toast.error(res.error);
    } finally {
      setPhase('idle');
    }
  };

  const onPreview = async () => {
    if (!file || storeId === '') return;
    setPhase('previewing');
    reset();
    try {
      const fd = new FormData();
      fd.set('storeId', storeId);
      fd.set('file', file);
      const res = await dryRunSupplierImport(fd);
      if (res.ok) setPreview(res.preview);
      else toast.error(res.error);
    } finally {
      setPhase('idle');
    }
  };

  const onCommit = async () => {
    if (!file || storeId === '') return;
    setPhase('committing');
    try {
      const fd = new FormData();
      fd.set('storeId', storeId);
      fd.set('file', file);
      const res = await commitSupplierImport(fd);
      if (res.ok) {
        setDone(
          `取込完了：仕入先 新規${res.createdSuppliers}・更新${res.updatedSuppliers} ／ カテゴリ新規${res.createdCategories}`,
        );
        setPreview(null);
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
        toast.success('仕入先を取り込みました');
      } else {
        toast.error(res.error);
      }
    } finally {
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';
  const writable = preview ? preview.counts.valid : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-600" />
          仕入先・仕入カテゴリの一括取込
        </h2>
        <Link
          href="/masters/suppliers"
          className="text-[12px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5 flex-shrink-0"
        >
          手入力画面 <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
        1シートに「仕入カテゴリ名・仕入先名・原価区分（cogs=売上原価／sga=販管費）」を行ごとに記入し、店舗を選んで取り込みます。
        カテゴリ・仕入先は「店舗×名称」で照合し、無ければ作成・あれば再利用します（削除はしません）。
      </p>

      {/* 店舗選択＋テンプレDL */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600">取込先の店舗</label>
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              reset();
            }}
            className="block w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 outline-none"
          >
            {stores.length === 0 && <option value="">店舗がありません</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={onTemplate} disabled={busy}>
          {phase === 'tpl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          テンプレートDL
        </Button>
      </div>

      {/* ファイル選択 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            reset();
          }}
          className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-100"
        />
        <Button type="button" variant="outline" onClick={onPreview} disabled={busy || !file || storeId === ''}>
          {phase === 'previewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          プレビュー
        </Button>
      </div>

      {/* 完了メッセージ */}
      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {done}
        </div>
      )}

      {/* プレビュー */}
      {preview && (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap gap-2 text-[12px]">
            <Stat label="取込対象" value={preview.counts.valid} tone="slate" />
            <Stat label="仕入先 新規" value={preview.counts.newSuppliers} tone="emerald" />
            <Stat label="仕入先 更新" value={preview.counts.updateSuppliers} tone="sky" />
            <Stat label="カテゴリ新規" value={preview.counts.newCategories} tone="emerald" />
            <Stat label="エラー" value={preview.counts.errors} tone="rose" />
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div className="text-[12px] font-bold text-rose-700 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                エラー行（取り込まれません・修正して再アップロード）
              </div>
              <ul className="text-[12px] text-rose-700 space-y-0.5 max-h-40 overflow-y-auto">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-num font-semibold">{e.row}行目</span>：{e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold">行</th>
                    <th className="px-3 py-2 font-semibold">カテゴリ</th>
                    <th className="px-3 py-2 font-semibold">仕入先</th>
                    <th className="px-3 py-2 font-semibold">原価区分</th>
                    <th className="px-3 py-2 font-semibold">税</th>
                    <th className="px-3 py-2 font-semibold">判定</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-1.5 font-num text-slate-500">{r.row}</td>
                      <td className="px-3 py-1.5 text-slate-700">
                        {r.categoryName}
                        {r.categoryNew && <span className="ml-1 text-[10px] text-emerald-600">＋新規</span>}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">{r.supplierName}</td>
                      <td className="px-3 py-1.5 text-slate-600">{r.costType === 'cogs' ? '売上原価' : '販管費'}</td>
                      <td className="px-3 py-1.5 font-num text-slate-600">
                        {r.isTaxExempt === true
                          ? '非課税'
                          : r.taxRate !== null
                            ? `${r.taxRate}%`
                            : r.status === 'new'
                              ? '店舗標準'
                              : '現状維持'}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            'text-[11px] font-medium px-1.5 py-0.5 rounded ' +
                            (r.status === 'new'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-sky-50 text-sky-700')
                          }
                        >
                          {r.status === 'new' ? '新規' : '更新'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button type="button" onClick={onCommit} disabled={busy || writable === 0}>
            {phase === 'committing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            取込実行（{writable}件）
          </Button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'sky' | 'rose' | 'slate' }) {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone];
  return (
    <span className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ' + cls}>
      {label}
      <span className="font-num font-bold">{value}</span>
    </span>
  );
}
