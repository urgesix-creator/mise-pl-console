'use client';

// ====================================================================
// 日次売上エクスポート（統合：経営データ＋部門別）セクション
//
//   - データ画面（/data）の「部門別売上（参考）」とは独立した別セクション。
//   - 期間（当月初〜今日が既定）＋店舗（統合版は 1店舗1ファイルのため店舗必須）を選び、
//     Server Action exportIntegratedDailySales を呼んで色付き .xlsx をダウンロードする。
//   - 読み取りのみ（DB へは書き込まない）。生成・権限判定・色付けはサーバ側／純粋関数。
//   - staff（現場社員）にはこのセクション自体を表示しない（サーバ側でも拒否される）。
//   - 旧「単純版（SheetJS・日次売上のみ）」UI からの置き換え（単純版のボタンは残さない）。
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
import { exportIntegratedDailySales } from '../_lib/integrated-export-actions';
import type { Role, Store } from './types';

// 出力可能ロール（サーバ側 EXPORT_ROLES と一致。UI でも staff を見せない）
const EXPORT_ROLES: readonly Role[] = ['executive', 'country_rep', 'accounting', 'store_manager'];

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** base64 の xlsx をブラウザでダウンロード（triggerBlobDownload 相当） */
function downloadBase64Xlsx(base64: string, filename: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type DailySalesExportSectionProps = {
  stores: Store[];
  userRole: Role;
  defaultFrom: string;
  defaultTo: string;
  defaultStoreId: string | null;
};

export function DailySalesExportSection({
  stores,
  userRole,
  defaultFrom,
  defaultTo,
  defaultStoreId,
}: DailySalesExportSectionProps) {
  // staff 等はセクションごと非表示（最終防御はサーバ側 exportIntegratedDailySales）
  if (!EXPORT_ROLES.includes(userRole)) return null;

  return (
    <DailySalesExportSectionInner
      stores={stores}
      defaultFrom={defaultFrom}
      defaultTo={defaultTo}
      defaultStoreId={defaultStoreId}
    />
  );
}

function DailySalesExportSectionInner({
  stores,
  defaultFrom,
  defaultTo,
  defaultStoreId,
}: {
  stores: Store[];
  defaultFrom: string;
  defaultTo: string;
  defaultStoreId: string | null;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  // 統合版は店舗必須（全店は廃止）。既定は選択中店舗 → 先頭店舗
  const [storeId, setStoreId] = useState<string>(defaultStoreId ?? stores[0]?.id ?? '');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'empty' | 'done' | 'error'; text: string } | null>(
    null,
  );

  const invalidRange = from > to;
  const noStore = storeId === '';
  const canExport = !isExporting && !invalidRange && !noStore;

  const handleExport = async () => {
    if (!canExport) return;
    setStatus(null);
    setIsExporting(true);
    try {
      const result = await exportIntegratedDailySales(storeId, from, to);

      if (!result.success) {
        setStatus({ kind: 'error', text: result.error });
        toast.error(result.error);
        return;
      }
      // データ0件でも from〜to の全日付テンプレートを必ず出力する（空ファイルガードは廃止）。
      downloadBase64Xlsx(result.base64Xlsx, result.filename);
      setStatus({ kind: 'done', text: `${result.rowCount}日分を出力しました（${result.filename}）` });
      toast.success(`日次売上（統合）を出力しました（${result.rowCount}日分）`);
    } catch {
      const msg = 'エクスポートに失敗しました';
      setStatus({ kind: 'error', text: msg });
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="mt-10">
      {/* 見出し */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-2">
          <div className="w-8 h-px bg-slate-300" />
          <span>Data · Daily Sales Export</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900 leading-tight flex items-center gap-2.5">
          <FileSpreadsheet className="w-6 h-6 text-slate-700" />
          日次売上エクスポート（統合・経営データ＋部門別）
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          経営データ（税抜・税込・客数・天気・備考）に部門別売上を横統合した Excel(.xlsx) を、店舗ごとに出力します。
          読み取りのみで、データは変更されません。
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          色：<span className="px-1 rounded bg-[#E5E7EB]">グレー＝必須</span>{' '}
          <span className="px-1 rounded bg-[#DBEAFE]">薄ブルー＝自動計算（入力不要）</span>{' '}
          色なし＝任意。見出しにも【必須】【任意】【自動】を併記しています。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px] gap-3">
          {/* 店舗（必須） */}
          <div className="space-y-1.5">
            <Label htmlFor="dsx-store" className="text-xs text-slate-600">
              <StoreIcon className="w-3 h-3 inline mr-1" />
              店舗（必須）
            </Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger id="dsx-store">
                <SelectValue placeholder="店舗を選択..." />
              </SelectTrigger>
              <SelectContent>
                {stores.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    アクセス可能な店舗がありません
                  </div>
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

          {/* 開始日 */}
          <div className="space-y-1.5">
            <Label htmlFor="dsx-from" className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              開始日
            </Label>
            <Input
              id="dsx-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="font-num"
            />
          </div>

          {/* 終了日 */}
          <div className="space-y-1.5">
            <Label htmlFor="dsx-to" className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              終了日
            </Label>
            <Input
              id="dsx-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="font-num"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-slate-500">
            期間の既定は「当月初〜今日」です。1店舗＝1ファイル（ローカル通貨）で出力します。
          </p>
          <Button type="button" onClick={handleExport} disabled={!canExport} className="h-9">
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? '出力中…' : '日次売上を出力（統合・Excel）'}
          </Button>
        </div>

        {/* バリデーション・結果表示 */}
        {invalidRange && (
          <p className="mt-2 text-[11px] text-rose-600">開始日が終了日より後になっています。</p>
        )}
        {status && (
          <div
            className={[
              'mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-2',
              status.kind === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : status.kind === 'empty'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
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
