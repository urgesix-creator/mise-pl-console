'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  summaryToTable,
  detailToTable,
  buildFilename,
  downloadCsv,
  downloadXlsxFromBase64,
  type ExportKind,
  type ExportFormat,
} from '../_lib/export';
import { buildDepartmentXlsx } from '../_lib/export-actions';
import type { DepartmentSalesSummary, DepartmentSaleDetailRow } from './types';

type ExportMenuProps = {
  summary: DepartmentSalesSummary;
  detailRows: DepartmentSaleDetailRow[];
  storeName: string;
  fromDate: string;
  toDate: string;
  disabled?: boolean;
};

export function ExportMenu({
  summary,
  detailRows,
  storeName,
  fromDate,
  toDate,
  disabled,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  const runExport = async (kind: ExportKind, format: ExportFormat) => {
    const table = kind === 'summary' ? summaryToTable(summary) : detailToTable(detailRows);
    const filename = buildFilename(kind, storeName, fromDate, toDate, format);
    const sheetName = kind === 'summary' ? '集計' : '明細';
    setOpen(false);
    if (format === 'csv') {
      downloadCsv(filename, table);
      return;
    }
    try {
      const { base64 } = await buildDepartmentXlsx(sheetName, table);
      downloadXlsxFromBase64(filename, base64);
    } catch {
      toast.error('Excelの出力に失敗しました');
    }
  };

  const options: { kind: ExportKind; format: ExportFormat; label: string; icon: typeof FileText }[] =
    [
      { kind: 'summary', format: 'csv', label: '集計を CSV', icon: FileText },
      { kind: 'summary', format: 'xlsx', label: '集計を Excel', icon: FileSpreadsheet },
      { kind: 'detail', format: 'csv', label: '明細を CSV', icon: FileText },
      { kind: 'detail', format: 'xlsx', label: '明細を Excel', icon: FileSpreadsheet },
    ];

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="h-9"
      >
        <Download className="w-4 h-4" />
        エクスポート
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </Button>

      {open && !disabled && (
        <>
          {/* クリックアウトで閉じる透明オーバーレイ */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg py-1.5">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              出力（{fromDate}〜{toDate}）
            </div>
            {options.map((o) => (
              <button
                key={`${o.kind}-${o.format}`}
                type="button"
                onClick={() => runExport(o.kind, o.format)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <o.icon className="w-3.5 h-3.5 text-slate-400" />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
