import { base64ToUint8Array } from '@/lib/xlsx-utils';
import type { DepartmentSalesSummary, DepartmentSaleDetailRow } from '../_components/types';

// ====================================================================
// 部門別売上のエクスポート（CSV / Excel）ユーティリティ
//
//   - 集計結果（部門名・累計税込売上・構成比%＋合計行）と明細（日付・部門名・税込売上）を出力。
//   - CSV は BOM付きUTF-8（Excelで日本語が文字化けしないように）。
//   - Excel は exceljs を使用（サーバアクション buildDepartmentXlsx で生成→base64→当ファイルでDL）。
//   - 金額はカンマなしの数値（数値セルとして扱える）。構成比は%値（数値）。
//   - 集計ロジックには関与しない（既に算出済みの summary / detail を整形して出力するだけ）。
//   - daily_sales（経営データ）は一切参照しない。
// ====================================================================

export type ExportKind = 'summary' | 'detail';
export type ExportFormat = 'csv' | 'xlsx';

type TableData = {
  headers: string[];
  rows: (string | number)[][];
};

/** 集計結果 → 表データ（合計行を含む） */
export function summaryToTable(summary: DepartmentSalesSummary): TableData {
  const headers = ['部門名', '累計税込売上', '構成比(%)'];
  const rows: (string | number)[][] = summary.rows.map((r) => [
    r.name,
    r.cumulative_gross,
    r.share_pct,
  ]);
  rows.push(['合計', summary.total, 100]);
  return { headers, rows };
}

/** 明細 → 表データ（display_order/日付順は呼び出し側で整列済み） */
export function detailToTable(detail: DepartmentSaleDetailRow[]): TableData {
  const headers = ['日付', '部門名', '税込売上'];
  const rows: (string | number)[][] = detail.map((r) => [
    r.business_date,
    r.name,
    r.gross_sales,
  ]);
  return { headers, rows };
}

/** ファイル名に使えない文字を除去 */
function sanitizeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').trim();
}

/** 例：部門別売上_集計_あお季タイ_2026-05-01_2026-05-30.csv */
export function buildFilename(
  kind: ExportKind,
  storeName: string,
  from: string,
  to: string,
  ext: ExportFormat,
): string {
  const kindLabel = kind === 'summary' ? '集計' : '明細';
  return `部門別売上_${kindLabel}_${sanitizeFilenamePart(storeName)}_${from}_${to}.${ext}`;
}

/** CSV 1フィールドのエスケープ（カンマ・引用符・改行を含む場合は引用符で囲む） */
function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** CSV ダウンロード（BOM付きUTF-8・CRLF改行） */
export function downloadCsv(filename: string, table: TableData): void {
  const lines = [table.headers, ...table.rows].map((row) =>
    row.map(escapeCsvField).join(','),
  );
  const BOM = String.fromCharCode(0xfeff); // UTF-8 BOM（Excelで日本語が文字化けしないように先頭へ付与）
  const content = BOM + lines.join('\r\n'); // CRLF 改行
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename);
}

/** base64(xlsx) をブラウザでダウンロード（生成はサーバアクション buildDepartmentXlsx 側） */
export function downloadXlsxFromBase64(filename: string, base64: string): void {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, filename);
}

// ====================================================================
// 日次売上（daily_sales）エクスポート 共有型
//
//   - 統合フォーマット（integrated-export.ts / integrated-export-actions.ts）が受け取る
//     daily_sales 1行の型のみをここに残す（型定義のみ・DB非依存）。
//   - 単純版（SheetJS・日次売上のみ）の純粋関数・Action は統合版へ置換済みのため削除した。
// ====================================================================

/** 統合エクスポートが受け取る daily_sales の1行（実DBカラム基準・値は変換済み） */
export type DailySalesExportRow = {
  store_id: string;
  business_date: string;
  day_period: string;
  net_sales: number;
  gross_sales: number;
  customer_count: number;
  weather: string | null;
  event_note: string | null;
  service_fee: number;
  tax_amount: number;
};
