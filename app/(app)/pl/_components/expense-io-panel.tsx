'use client';

// ====================================================================
// 月次PL 販管費 Excel入出力パネル（/pl 内・折りたたみ）
//
//   - エクスポート：店舗・決算期の記入済みテンプレートをダウンロード（読み取り専用）。
//   - インポート（2段階）：ファイル選択 → プレビュー（dryRun・書込なし）→ 確認 → commit
//     （サーバ再検証 → monthly_expenses へ UPSERT）。
//   - 空欄の月は取り込まない（既存を変更しない）。DELETE はしない。
//   - 共通の base64→Blob ダウンロードは売上予算と同方式（コピー流用）。
// ====================================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { base64ToUint8Array } from '@/lib/xlsx-utils';
import { TAG_LABELS } from '../_lib/expense-constants';
import { exportExpenseTemplate } from '../_lib/expense-export-actions';
import { dryRunExpenseImport, commitExpenseImport } from '../_lib/expense-import-actions';
import type { ExpenseImportPreview, ExpenseRowStatus } from '../_lib/expense-import-types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function downloadBase64Xlsx(base64: string, filename: string): void {
  const blob = new Blob([base64ToUint8Array(base64)], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STATUS_LABEL: Record<ExpenseRowStatus, string> = {
  new: '新規',
  update: '更新',
  unchanged: '変更なし',
  error: 'エラー',
  skip: '対象外',
};
const STATUS_CLASS: Record<ExpenseRowStatus, string> = {
  new: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-amber-50 text-amber-700 border-amber-200',
  unchanged: 'bg-slate-50 text-slate-500 border-slate-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
  skip: 'bg-slate-50 text-slate-400 border-slate-200',
};

type Props = {
  storeId: string;
  fyStartYear: number;
  currencyCode: string;
};

export function ExpenseIoPanel({ storeId, fyStartYear, currencyCode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExpenseImportPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<'idle' | 'previewing' | 'committing'>('idle');

  const resetImport = () => {
    setFile(null);
    setPreview(null);
    setPhase('idle');
  };

  const handleExport = () => {
    setExporting(true);
    startTransition(async () => {
      const result = await exportExpenseTemplate(storeId, fyStartYear, currencyCode);
      setExporting(false);
      if (result.success) {
        downloadBase64Xlsx(result.base64Xlsx, result.filename);
        toast.success(`販管費テンプレートを出力しました（${result.accountCount}科目）`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setPhase('idle');
  };

  const handlePreview = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set('storeId', storeId);
    fd.set('file', file);
    setPhase('previewing');
    startTransition(async () => {
      const result = await dryRunExpenseImport(fd);
      setPhase('idle');
      if (result.success) {
        setPreview(result.preview);
      } else {
        setPreview(null);
        toast.error(result.error);
      }
    });
  };

  const handleCommit = () => {
    if (!file || !preview) return;
    const fd = new FormData();
    fd.set('storeId', storeId);
    fd.set('file', file);
    setPhase('committing');
    startTransition(async () => {
      const result = await commitExpenseImport(fd);
      setPhase('idle');
      if (result.success) {
        const r = result.report;
        toast.success(
          `取り込み完了：新規${r.accountsNew}・更新${r.accountsUpdate}科目／${r.cellsWritten}セル（対象外${r.skippedRows}・エラー${r.errorRows}）`,
        );
        resetImport();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const busy = isPending || exporting;
  const canCommit =
    preview !== null && preview.summary.cellsToWrite > 0 && preview.summary.errorRows === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white mb-5">
      {/* 見出し（トグル） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-slate-50/60 transition-colors rounded-2xl"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
        <FileSpreadsheet className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-800">販管費の入出力（Excel）</span>
        <span className="text-[11px] text-slate-400 ml-1">
          テンプレート出力 → 記入 → プレビュー → 取り込み（UPSERT）
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-slate-100">
          {/* エクスポート */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600">1. テンプレートを出力</div>
            <p className="text-[11px] text-slate-500">
              既存の販管費を記入済みのテンプレート（科目 × 12ヶ月）を出力します。区分はドロップダウンです。
            </p>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={busy} className="gap-1.5">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              テンプレートをダウンロード
            </Button>
          </div>

          {/* インポート */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">2. 記入したファイルを取り込む</div>
            <p className="text-[11px] text-slate-500">
              空欄の月は取り込みません（既存を変更しません）。まずプレビューで内容を確認してください。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                disabled={busy}
                className="text-xs file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-2.5 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-100"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={busy || !file}
                className="gap-1.5"
              >
                {phase === 'previewing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                プレビュー（書き込みなし）
              </Button>
            </div>
          </div>

          {/* プレビュー結果 */}
          {preview && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {/* サマリー */}
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="font-semibold text-slate-700">プレビュー</span>
                <span className="text-emerald-700">新規 {preview.summary.accountsNew}</span>
                <span className="text-amber-700">更新 {preview.summary.accountsUpdate}</span>
                <span className="text-slate-500">変更なし {preview.summary.accountsUnchanged}</span>
                <span className="text-slate-400">対象外 {preview.summary.skipRows}</span>
                <span className={cn(preview.summary.errorRows > 0 ? 'text-rose-700 font-semibold' : 'text-slate-400')}>
                  エラー {preview.summary.errorRows}
                </span>
                <span className="ml-auto text-slate-700 font-medium">
                  書き込みセル数：{preview.summary.cellsToWrite}
                </span>
              </div>

              {/* 行テーブル */}
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white sticky top-0 border-b border-slate-100">
                    <tr className="text-slate-500">
                      <th className="text-left px-3 py-1.5 font-medium">行</th>
                      <th className="text-left px-3 py-1.5 font-medium">科目名</th>
                      <th className="text-left px-3 py-1.5 font-medium">区分</th>
                      <th className="text-left px-3 py-1.5 font-medium">状態</th>
                      <th className="text-right px-3 py-1.5 font-medium">対象セル</th>
                      <th className="text-left px-3 py-1.5 font-medium">メッセージ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.excelRow} className="border-b border-slate-50 align-top">
                        <td className="px-3 py-1.5 text-slate-400 font-num">{row.excelRow}</td>
                        <td className="px-3 py-1.5 text-slate-800">{row.accountName ?? '—'}</td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {row.categoryTag ? TAG_LABELS[row.categoryTag] : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', STATUS_CLASS[row.status])}>
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-num text-slate-600">
                          {row.upsertCells.length || ''}
                        </td>
                        <td className="px-3 py-1.5 text-[11px]">
                          {row.errors.map((e, i) => (
                            <div key={`e${i}`} className="text-rose-600 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              {e}
                            </div>
                          ))}
                          {row.warnings.map((w, i) => (
                            <div key={`w${i}`} className="text-amber-600">{w}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 確認バー */}
              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-end gap-2">
                {preview.summary.errorRows > 0 && (
                  <span className="text-[11px] text-rose-600 mr-auto">
                    エラー行があります。修正してから取り込んでください（エラー行は取り込まれません）。
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={resetImport} disabled={busy}>
                  クリア
                </Button>
                <Button size="sm" onClick={handleCommit} disabled={busy || !canCommit} className="gap-1.5">
                  {phase === 'committing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  取り込む（{preview.summary.cellsToWrite}セルを保存）
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
