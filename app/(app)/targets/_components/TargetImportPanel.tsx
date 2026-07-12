'use client';

// ====================================================================
// 売上予算（日次目標）インポートパネル（2段階：ファイル選択→プレビュー→確認→取込）
//   - dryRunTargetImport でプレビュー（書込なし）→ 確認 → commitTargetImport で実書込。
//   - サーバ側で再検証・再パースするため、クライアント値は信用しない。
//   - 権限は店長以上（サーバ側でも拒否）。
// ====================================================================

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dryRunTargetImport, commitTargetImport } from '../_lib/target-import-actions';
import type {
  TargetImportPreview,
  TargetCommitReport,
} from '../_lib/target-import-types';
import type { StoreLite } from './types';

type TargetImportPanelProps = {
  stores: StoreLite[];
  defaultStoreId: string | null;
};

function fmt(n: number): string {
  return n.toLocaleString('ja-JP');
}

export function TargetImportPanel({ stores, defaultStoreId }: TargetImportPanelProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [storeId, setStoreId] = useState<string>(defaultStoreId ?? stores[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TargetImportPreview | null>(null);
  const [report, setReport] = useState<TargetCommitReport | null>(null);
  const [phase, setPhase] = useState<'idle' | 'previewing' | 'previewed' | 'committing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    setError(null);
    setPhase('idle');
    if (fileRef.current) fileRef.current.value = '';
  };

  const buildFormData = (): FormData | null => {
    if (!file || storeId === '') return null;
    const fd = new FormData();
    fd.set('storeId', storeId);
    fd.set('file', file);
    return fd;
  };

  const handlePreview = async () => {
    const fd = buildFormData();
    if (!fd) {
      toast.error('店舗とファイルを指定してください');
      return;
    }
    setError(null);
    setReport(null);
    setPhase('previewing');
    try {
      const result = await dryRunTargetImport(fd);
      if (!result.success) {
        setError(result.error);
        setPhase('idle');
        toast.error(result.error);
        return;
      }
      setPreview(result.preview);
      setPhase('previewed');
    } catch {
      setError('プレビューに失敗しました');
      setPhase('idle');
    }
  };

  const handleCommit = async () => {
    const fd = buildFormData();
    if (!fd) return;
    setPhase('committing');
    try {
      const result = await commitTargetImport(fd);
      if (!result.success) {
        setError(result.error);
        setPhase('previewed');
        toast.error(result.error);
        return;
      }
      setReport(result.report);
      setPreview(null);
      setPhase('idle');
      toast.success(`取込完了：新規 ${result.report.inserted} / 上書き ${result.report.updated}`);
      router.refresh();
    } catch {
      setError('取込に失敗しました');
      setPhase('previewed');
    }
  };

  const writableCount = preview ? preview.summary.newCount + preview.summary.updateCount : 0;

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-slate-900 leading-tight flex items-center gap-2.5">
          <FileUp className="w-5 h-5 text-slate-700" />
          売上予算 Excel取り込み
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          記入した予算テンプレートを取り込みます。まずプレビューで内容を確認し、確認後に書き込みます（常に上書き・削除はしません）。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        {/* 店舗・ファイル選択 */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ti-store" className="text-xs text-slate-600">
              取込先店舗（必須）
            </Label>
            <Select
              value={storeId}
              onValueChange={(v) => {
                setStoreId(v);
                setPreview(null);
                setReport(null);
                setError(null);
                setPhase('idle');
                if (fileRef.current) fileRef.current.value = '';
                setFile(null);
              }}
            >
              <SelectTrigger id="ti-store">
                <SelectValue placeholder="店舗を選択..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ti-file" className="text-xs text-slate-600">
              ファイル（.xlsx）
            </Label>
            <input
              ref={fileRef}
              id="ti-file"
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setReport(null);
                setError(null);
                setPhase('idle');
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-white file:text-xs hover:file:bg-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!file || storeId === '' || phase === 'previewing' || phase === 'committing'}
          >
            {phase === 'previewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            プレビュー（書き込まない）
          </Button>
          {(preview || report) && (
            <Button type="button" variant="ghost" onClick={reset}>
              <X className="w-4 h-4" />
              クリア
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* プレビュー結果 */}
        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SummaryCard label="新規" value={preview.summary.newCount} tone="emerald" />
              <SummaryCard label="上書き" value={preview.summary.updateCount} tone="sky" />
              <SummaryCard label="エラー" value={preview.summary.errorCount} tone="rose" />
              <SummaryCard label="スキップ" value={preview.summary.skipCount} tone="slate" />
            </div>

            {preview.summary.errorCount > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                エラー行は取込対象外です（他の行は取り込めます）。下の一覧で理由を確認してください。
              </div>
            )}

            {/* 行一覧（先頭50件） */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-slate-500">
                    <th className="text-left px-3 py-1.5 font-semibold">日付</th>
                    <th className="text-left px-3 py-1.5 font-semibold">判定</th>
                    <th className="text-right px-3 py-1.5 font-semibold">予算額</th>
                    <th className="text-left px-3 py-1.5 font-semibold">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.slice(0, 50).map((r) => (
                    <tr key={r.excelRow} className={r.status === 'error' ? 'bg-rose-50/40' : ''}>
                      <td className="px-3 py-1.5 font-num">{r.key?.targetDate ?? '—'}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-num">
                        {r.targetSales !== null ? fmt(r.targetSales) : '—'}
                        {r.diff && (
                          <span className="text-slate-400"> ← {fmt(r.diff.current)}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {[...r.errors, ...r.warnings].join(' / ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 50 && (
                <div className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50">
                  …ほか {preview.rows.length - 50} 行（全 {preview.rows.length} 行）
                </div>
              )}
            </div>

            {/* 確認＋実書き込み */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                書き込み対象は <span className="font-bold font-num">{writableCount}</span> 行（新規＋上書き）。
                これらを daily_targets に上書き保存します。
              </p>
              <Button
                type="button"
                onClick={handleCommit}
                disabled={writableCount === 0 || phase === 'committing'}
              >
                {phase === 'committing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                取込を実行（上書き）
              </Button>
            </div>
          </div>
        )}

        {/* 取込完了レポート */}
        {report && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
            <div className="font-semibold flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              取込が完了しました
            </div>
            <div className="text-xs font-num">
              新規 {report.inserted} 件 / 上書き {report.updated} 件 / スキップ {report.skippedRows} 件 / エラー {report.errorRows} 件
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'sky' | 'rose' | 'slate';
}) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold">{label}</div>
      <div className="font-num text-lg font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'new' | 'update' | 'error' | 'skip' }) {
  const map = {
    new: { label: '新規', cls: 'bg-emerald-100 text-emerald-700' },
    update: { label: '上書き', cls: 'bg-sky-100 text-sky-700' },
    error: { label: 'エラー', cls: 'bg-rose-100 text-rose-700' },
    skip: { label: 'スキップ', cls: 'bg-slate-100 text-slate-600' },
  }[status];
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${map.cls}`}>
      {map.label}
    </span>
  );
}
