'use client';

// ====================================================================
// 売上予算（日次目標）エクスポートセクション
//   店舗＋期間（当月初〜今日が既定）を選び、テンプレ Excel をダウンロード。
//   読み取りのみ。権限は店長以上（サーバ側でも拒否）。
// ====================================================================

import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Store as StoreIcon,
  Calendar as CalendarIcon,
  Loader2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { base64ToUint8Array } from '@/lib/xlsx-utils';
import { exportSalesTargets } from '../_lib/target-export-actions';
import type { StoreLite } from './types';

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

type TargetExportSectionProps = {
  stores: StoreLite[];
  defaultFrom: string;
  defaultTo: string;
  defaultStoreId: string | null;
};

export function TargetExportSection({
  stores,
  defaultFrom,
  defaultTo,
  defaultStoreId,
}: TargetExportSectionProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [storeId, setStoreId] = useState<string>(defaultStoreId ?? stores[0]?.id ?? '');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'done' | 'error'; text: string } | null>(null);

  const invalidRange = from > to;
  const canExport = !isExporting && !invalidRange && storeId !== '';

  const handleExport = async () => {
    if (!canExport) return;
    setStatus(null);
    setIsExporting(true);
    try {
      const result = await exportSalesTargets(storeId, from, to);
      if (!result.success) {
        setStatus({ kind: 'error', text: result.error });
        toast.error(result.error);
        return;
      }
      downloadBase64Xlsx(result.base64Xlsx, result.filename);
      setStatus({ kind: 'done', text: `${result.rowCount}日分を出力しました（${result.filename}）` });
      toast.success(`売上予算テンプレートを出力しました（${result.rowCount}日分）`);
    } catch {
      const msg = 'エクスポートに失敗しました';
      setStatus({ kind: 'error', text: msg });
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-slate-900 leading-tight flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-slate-700" />
          売上予算 テンプレート出力
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          対象月の全日付が並んだ Excel(.xlsx) を店舗ごとに出力します。予算額を記入して取込に使えます（読み取りのみ）。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tx-store" className="text-xs text-slate-600">
              <StoreIcon className="w-3 h-3 inline mr-1" />
              店舗（必須）
            </Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger id="tx-store">
                <SelectValue placeholder="店舗を選択..." />
              </SelectTrigger>
              <SelectContent>
                {stores.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">アクセス可能な店舗がありません</div>
                ) : (
                  stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-from" className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              開始日
            </Label>
            <Input id="tx-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="font-num" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-to" className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              終了日
            </Label>
            <Input id="tx-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="font-num" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-slate-500">期間の既定は「当月初〜今日」です。1店舗＝1ファイル。</p>
          <Button type="button" onClick={handleExport} disabled={!canExport} className="h-9">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? '出力中…' : '予算テンプレートを出力（Excel）'}
          </Button>
        </div>

        {invalidRange && <p className="mt-2 text-[11px] text-rose-600">開始日が終了日より後になっています。</p>}
        {status && (
          <div
            className={[
              'mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-2',
              status.kind === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200',
            ].join(' ')}
          >
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="font-num">{status.text}</span>
          </div>
        )}
      </div>
    </section>
  );
}
