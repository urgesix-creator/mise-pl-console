// ====================================================================
// 店舗別 期間集計 エクスポート 純粋関数（ExcelJS・DB非依存）
//
//   - 画面（期間集計ページ）に表示中の状態を「見たまま」1シートに組み立てる純粋関数。
//     DB には一切アクセスしない・再計算もしない（数値はクライアントが描画に使った値を
//     そのまま受け取る＝画面とExcelの完全一致を保証）。
//   - 金額は数値型で出力し、行ごとの通貨記号付き #,##0（円換算時は ¥ 統一）で表示。
//     比率は %（小数1桁）。算出不能（画面が「—」）の値は文字列 '—' を出力する。
//   - 既存の月次PLエクスポート（pl/_lib/pl-export.ts）の作法・スタイルを踏襲（コピー思想）。
//     既存の出力コードには触れない。
// ====================================================================

import { Workbook } from 'exceljs';
import type { CellValue, Fill, Row } from 'exceljs';

/** 金額セル：number=数値出力（記号付き #,##0）／null='—'（画面の「—」に対応） */
export type PeriodExportAmount = number | null;

/** 1店舗行（画面の1行に対応・指定中の通貨モードで解決済みの値） */
export type PeriodExportRow = {
  storeNo: number;
  name: string;
  /** この行の通貨記号（現地通貨記号 or 円換算時は '¥'） */
  currencySymbol: string;
  netSales: PeriodExportAmount;
  budgetPct: number | null;
  grossMarginPct: number | null;
  marginPct: number | null;
  grossProfit: PeriodExportAmount;
  marginProfit: PeriodExportAmount;
  closingInventory: PeriodExportAmount;
  /** 備考（「棚卸未入力（在庫0で計算）」「レート未登録」等・画面の注記） */
  note: string;
};

/** グループ合計行（グループ選択時のみ・画面の computeGroupTotal 結果） */
export type PeriodExportTotal = {
  memberCount: number;
  currencySymbol: string;
  netSales: PeriodExportAmount;
  budgetPct: number | null;
  grossMarginPct: number | null;
  marginPct: number | null;
  grossProfit: PeriodExportAmount;
  marginProfit: PeriodExportAmount;
  closingInventory: PeriodExportAmount;
  note: string;
};

/** 見出しブロック用メタ */
export type PeriodExportMeta = {
  /** 期間（YYYY-MM-DD） */
  start: string;
  end: string;
  /** グループ名（'全店舗' or グループ名） */
  groupName: string;
  /** 通貨モード */
  currencyMode: 'local' | 'jpy';
  /** 円換算時の適用レート（例：[{ code:'THB', rate:4.87 }]） */
  appliedRates: { code: string; rate: number }[];
  /** 出力日時（呼び出し側＝サーバで文字列化して渡す。例：'2026-06-11 14:30'） */
  generatedAt: string;
};

const TITLE = '店舗別 期間集計';
const PCT_FMT = '0.0"%"';
const DASH = '—';
const FILL_HEADER = 'FFF1F5F9'; // slate-100（ヘッダー帯）
const FILL_TOTAL = 'FF0F172A'; // slate-900（合計行）

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** YYYY-MM-DD → YYYY/MM/DD */
function slashDate(iso: string): string {
  return iso.replace(/-/g, '/');
}

/** 金額の numFmt（記号付き #,##0）。記号はリテラルとして埋め込む */
function amountFmt(symbol: string): string {
  return `"${symbol}"#,##0`;
}

/** 金額セルを設定（number=数値＋記号書式／null='—' 文字列） */
function setAmountCell(
  row: Row,
  col: number,
  value: PeriodExportAmount,
  symbol: string,
): void {
  const cell = row.getCell(col);
  if (value === null || value === undefined) {
    cell.value = DASH;
    cell.alignment = { horizontal: 'right' };
    return;
  }
  cell.value = value;
  cell.numFmt = amountFmt(symbol);
  cell.alignment = { horizontal: 'right' };
}

/** 比率セルを設定（number=%（小数1桁）／null='—'） */
function setPctCell(row: Row, col: number, value: number | null): void {
  const cell = row.getCell(col);
  if (value === null || value === undefined) {
    cell.value = DASH;
    cell.alignment = { horizontal: 'right' };
    return;
  }
  cell.value = value;
  cell.numFmt = PCT_FMT;
  cell.alignment = { horizontal: 'right' };
}

const COLS = 10; // 店舗番号・店舗名・売上額・予算比・粗利率・差益率・粗利額・差益額・棚卸額・備考

/**
 * 期間集計の Workbook を組み立てる純粋関数。
 * 列＝[店舗番号, 店舗名, 売上額, 予算比, 粗利率, 差益率, 粗利の額, 差益の額, 棚卸の額, 備考]。
 */
export function buildPeriodSummaryWorkbook(
  rows: PeriodExportRow[],
  total: PeriodExportTotal | null,
  meta: PeriodExportMeta,
): Workbook {
  const wb = new Workbook();
  const ws = wb.addWorksheet('期間集計');

  const modeLabel = meta.currencyMode === 'jpy' ? '円換算' : '現地通貨';

  // 見出しブロック
  ws.addRow([TITLE]).font = { bold: true, size: 14 };
  ws.addRow([`期間：${slashDate(meta.start)}〜${slashDate(meta.end)}`]);
  ws.addRow([`グループ：${meta.groupName}`]);
  ws.addRow([`通貨：${modeLabel}`]);
  if (meta.currencyMode === 'jpy') {
    const rateText =
      meta.appliedRates.length > 0
        ? meta.appliedRates.map((r) => `${r.code}→JPY ${r.rate}`).join(' / ')
        : 'レート未登録';
    ws.addRow([`適用レート：${rateText}`]);
  }
  ws.addRow([`出力日時：${meta.generatedAt}`]);
  ws.addRow(['※ すべて税抜（net）ベース。「—」＝算出不能（予算0・売上0・レート未登録・通貨混在等）。']);
  ws.addRow([]); // 区切り空行

  // データ部ヘッダー行
  const headers: CellValue[] = [
    '店舗番号',
    '店舗名',
    '売上額',
    '予算比',
    '粗利率',
    '差益率',
    '粗利の額',
    '差益の額',
    '棚卸の額',
    '備考',
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  for (let c = 1; c <= COLS; c++) headerRow.getCell(c).fill = solidFill(FILL_HEADER);

  // データ行（画面の各行をそのまま）
  for (const r of rows) {
    const row = ws.addRow(new Array(COLS).fill(null) as CellValue[]);
    const noCell = row.getCell(1);
    noCell.value = r.storeNo;
    noCell.numFmt = '000'; // 001 形式
    noCell.alignment = { horizontal: 'center' };
    row.getCell(2).value = r.name;
    setAmountCell(row, 3, r.netSales, r.currencySymbol);
    setPctCell(row, 4, r.budgetPct);
    setPctCell(row, 5, r.grossMarginPct);
    setPctCell(row, 6, r.marginPct);
    setAmountCell(row, 7, r.grossProfit, r.currencySymbol);
    setAmountCell(row, 8, r.marginProfit, r.currencySymbol);
    setAmountCell(row, 9, r.closingInventory, r.currencySymbol);
    row.getCell(10).value = r.note || null;
  }

  // グループ合計行（グループ選択時のみ）
  if (total) {
    const row = ws.addRow(new Array(COLS).fill(null) as CellValue[]);
    const labelCell = row.getCell(2);
    labelCell.value = `グループ合計（${total.memberCount}店）`;
    setAmountCell(row, 3, total.netSales, total.currencySymbol);
    setPctCell(row, 4, total.budgetPct);
    setPctCell(row, 5, total.grossMarginPct);
    setPctCell(row, 6, total.marginPct);
    setAmountCell(row, 7, total.grossProfit, total.currencySymbol);
    setAmountCell(row, 8, total.marginProfit, total.currencySymbol);
    setAmountCell(row, 9, total.closingInventory, total.currencySymbol);
    row.getCell(10).value = total.note || null;
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    for (let c = 1; c <= COLS; c++) row.getCell(c).fill = solidFill(FILL_TOTAL);
  }

  // 列幅
  ws.getColumn(1).width = 9; // 店舗番号
  ws.getColumn(2).width = 24; // 店舗名
  ws.getColumn(3).width = 16; // 売上額
  ws.getColumn(4).width = 9; // 予算比
  ws.getColumn(5).width = 9; // 粗利率
  ws.getColumn(6).width = 9; // 差益率
  ws.getColumn(7).width = 16; // 粗利の額
  ws.getColumn(8).width = 16; // 差益の額
  ws.getColumn(9).width = 16; // 棚卸の額
  ws.getColumn(10).width = 28; // 備考

  return wb;
}
