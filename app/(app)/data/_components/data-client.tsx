'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  FileSearch,
  Store as StoreIcon,
  Calendar as CalendarIcon,
  Info,
  LayoutGrid,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DepartmentSalesChart, type ColoredSummaryRow } from './department-sales-chart';
import { DepartmentSalesTable } from './department-sales-table';
import { ExportMenu } from './export-menu';
import { DailySalesExportSection } from './daily-sales-export-section';
import { IntegratedImportPanel } from './IntegratedImportPanel';
import type {
  Store,
  Role,
  DepartmentSalesSummary,
  DepartmentSaleDetailRow,
} from './types';

// 構成比グラフ・一覧で共有する配色（display_order 順に割当。グラフと表で同色）
const CHART_COLORS = [
  '#0f172a', // slate-900
  '#10b981', // emerald-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
  '#ec4899', // pink-500
  '#64748b', // slate-500
  '#84cc16', // lime-500
];

type DataClientProps = {
  stores: Store[];
  selectedStoreId: string | null;
  fromDate: string;
  toDate: string;
  userRole: Role;
  summary: DepartmentSalesSummary;
  detailRows: DepartmentSaleDetailRow[];
};

export function DataClient({
  stores,
  selectedStoreId,
  fromDate,
  toDate,
  userRole,
  summary,
  detailRows,
}: DataClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  };

  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;
  const currencyCode = selectedStore?.currency_id.toUpperCase() ?? '';

  // display_order 順（集計済み）に配色を割当。グラフ・表で同色を共有
  const coloredRows: ColoredSummaryRow[] = summary.rows.map((r, i) => ({
    ...r,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">データ閲覧</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">部門別売上</span>
      </nav>

      {/* Header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Data · Department Sales</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-3">
          <FileSearch className="w-7 h-7 text-slate-700" />
          部門別売上（参考）
        </h1>
        <p className="text-sm text-slate-600">
          部門別の税込売上と構成比（部門内シェア）を期間で集計します。
        </p>
      </div>

      {/* 参考データの注記 */}
      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-sky-900">
          参考データです。<span className="font-medium">経営計算（損益・予算比・原価率）には反映されません。</span>
          構成比は「部門内シェア（部門別売上の累計合計に占める割合・合計100%）」で、1日合計とは独立した参考値です。
        </div>
      </div>

      {/* コントロール：店舗・期間 */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="data-store" className="text-xs text-slate-600">
              <StoreIcon className="w-3 h-3 inline mr-1" />
              店舗
            </Label>
            <Select
              value={selectedStoreId ?? ''}
              onValueChange={(v) => updateParam('store', v)}
            >
              <SelectTrigger id="data-store">
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

          <div className="space-y-1.5">
            <Label htmlFor="data-from" className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              開始日
            </Label>
            <Input
              id="data-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => updateParam('from', e.target.value)}
              className="font-num"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-to" className="text-xs text-slate-600">
              <CalendarIcon className="w-3 h-3 inline mr-1" />
              終了日
            </Label>
            <Input
              id="data-to"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => updateParam('to', e.target.value)}
              className="font-num"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-slate-500">
            期間の既定は「当月初〜今日」です。開始日・終了日で変更できます。
          </p>
          {selectedStore && (
            <ExportMenu
              summary={summary}
              detailRows={detailRows}
              storeName={selectedStore.name}
              fromDate={fromDate}
              toDate={toDate}
              disabled={!summary.hasData}
            />
          )}
        </div>
      </div>

      {/* 集計結果の表示エリア */}
      {!selectedStore ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="text-sm text-slate-500">
            {stores.length === 0
              ? 'アクセス可能な店舗がありません。管理者にお問い合わせください。'
              : '上のセレクタから店舗を選択してください。'}
          </div>
        </div>
      ) : !summary.hasData ? (
        /* 期間内にデータがない（分母0）→ 空状態 */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <LayoutGrid className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-sm font-medium text-slate-700 mb-1">対象期間にデータがありません</div>
          <div className="text-xs text-slate-500">
            選択中の店舗・期間に部門別売上の入力がありません。期間を変更するか、日次入力から登録してください。
          </div>
          <div className="mt-3 text-[11px] text-slate-400 font-num">
            {selectedStore.name} ／ {fromDate} 〜 {toDate}
          </div>
        </div>
      ) : (
        /* 構成比ドーナツ＋金額一覧（2カラム／モバイル縦積み）。
           日別推移・CSVは将来このグリッドに追加できるよう各部品を分離している。 */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DepartmentSalesChart rows={coloredRows} total={summary.total} currencyCode={currencyCode} />
          <DepartmentSalesTable rows={coloredRows} total={summary.total} currencyCode={currencyCode} />
        </div>
      )}

      {/* 日次売上エクスポート（経営データ）：上の部門別売上（参考）とは独立した別セクション */}
      <DailySalesExportSection
        stores={stores}
        userRole={userRole}
        defaultFrom={fromDate}
        defaultTo={toDate}
        defaultStoreId={selectedStoreId}
      />

      {/* 日次売上インポート（統合）：プレビューまで・書き込みなし。staff には非表示（自己ガード） */}
      <div className="mt-10">
        <IntegratedImportPanel
          stores={stores}
          selectedStoreId={selectedStoreId}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
