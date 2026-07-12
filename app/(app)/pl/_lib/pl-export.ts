// ====================================================================
// 月次PL（損益）エクスポート 純粋関数（ExcelJS・DB非依存）
//
//   - 画面に表示されている PL（行＝科目、列＝決算12ヶ月＋年間計）を、そのまま
//     Excel(.xlsx) のワークブックに組み立てる純粋関数。DB には一切アクセスしない。
//   - 出力対象の行は「行定義配列（PlExportRow[）」で受け取る。S4（利益）・S5（指標）が
//     できたら、この配列に行を push するだけで出力を拡張できる（builder 本体は不変）。
//   - 計算不可・未来月（画面が「—」）は number|null の null で渡し、Excel では空欄にする。
//   - 現地通貨。円換算（S6）は本ファイルの責務外。
//
//   ※ 既存の売上予算エクスポート（targets/_lib/target-export.ts）は変更しない。
//      共通の作法（ExcelJS の Workbook/Fill/numFmt）をコピー思想で流用しているのみ。
// ====================================================================

import { Workbook } from 'exceljs';
import type { CellValue, Fill } from 'exceljs';

/** 行の種別（罫線・太字・背景の出し分けに使う） */
export type PlRowKind = 'normal' | 'emphasis' | 'section' | 'total' | 'input';

/** PL の1行（画面の1行に対応）。数値は現地通貨、計算不可・未評価は null（=空欄）。 */
export type PlExportRow = {
  /** 行見出し（科目名等） */
  label: string;
  /** 行の種別（見た目の出し分け） */
  kind: PlRowKind;
  /** 各月の値（length = meta.monthLabels.length）。null は空欄 */
  values: (number | null)[];
  /** 年間計（null は空欄。営業日数・見出し行など年間計を出さない行で使用） */
  yearTotal: number | null;
};

/** 見出しブロック用メタ */
export type PlExportMeta = {
  storeName: string;
  /** 決算期ラベル（例：'2026年度'） */
  fiscalYearLabel: string;
  /** 通貨コード（例：'THB'） */
  currencyCode: string;
  /** 月見出し（例：['2026/04', ...]・length 12） */
  monthLabels: string[];
  /** 出力日時（呼び出し側で文字列化して渡す。例：'2026-06-08 14:30'） */
  generatedAt: string;
};

const TITLE = '月次PL（損益計算書）';
const NUM_FMT = '#,##0';
const FILL_HEADER = 'FFF1F5F9'; // slate-100（ヘッダー帯）
const FILL_EMPHASIS = 'FFF8FAFC'; // slate-50（売上総利益・販管費計）

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/**
 * 月次PL の Workbook を組み立てる純粋関数。
 * 列＝[科目, ...12ヶ月, 年間計]。行＝rows をそのまま上から流す。
 */
export function buildPlWorkbook(rows: PlExportRow[], meta: PlExportMeta): Workbook {
  const monthCount = meta.monthLabels.length;
  const lastDataCol = 1 + monthCount + 1; // 科目(1) + 月(monthCount) + 年間計(1)
  const yearTotalCol = lastDataCol;

  const wb = new Workbook();
  const ws = wb.addWorksheet('月次PL');

  // 見出しブロック（先頭は固定キーで始めない／インポート用途は無いが体裁を揃える）
  ws.addRow([TITLE]).font = { bold: true, size: 14 };
  ws.addRow([`対象店舗：${meta.storeName}`]);
  ws.addRow([`決算期：${meta.fiscalYearLabel}`]);
  ws.addRow([`通貨：${meta.currencyCode}（現地通貨）`]);
  ws.addRow([`出力日時：${meta.generatedAt}`]);
  ws.addRow(['※ 空欄＝計算不可（予算・営業日数未入力等）または対象外（未来月）。金額は現地通貨。']);
  ws.addRow([]); // 区切り空行

  // データ部ヘッダー行（科目 / 12ヶ月 / 年間計）
  const headers: CellValue[] = [`科目（${meta.currencyCode}）`, ...meta.monthLabels, '年間計'];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  for (let c = 1; c <= lastDataCol; c++) {
    headerRow.getCell(c).fill = solidFill(FILL_HEADER);
  }

  // データ行（行定義配列をそのまま）
  for (const r of rows) {
    const cells: CellValue[] = [r.label];
    for (let i = 0; i < monthCount; i++) {
      const v = r.values[i];
      cells.push(v === null || v === undefined ? null : v); // null=空欄
    }
    cells.push(r.yearTotal === null || r.yearTotal === undefined ? null : r.yearTotal);
    const row = ws.addRow(cells);

    const bold = r.kind === 'emphasis' || r.kind === 'total' || r.kind === 'section';
    if (bold) row.font = { bold: true };
    if (r.kind === 'emphasis' || r.kind === 'total') {
      for (let c = 1; c <= lastDataCol; c++) row.getCell(c).fill = solidFill(FILL_EMPHASIS);
    }
    // 数値列の書式（科目列=1 を除く）。null セルは空欄のまま。
    for (let c = 2; c <= lastDataCol; c++) {
      row.getCell(c).numFmt = NUM_FMT;
      row.getCell(c).alignment = { horizontal: 'right' };
    }
  }

  // 列幅・書式
  ws.getColumn(1).width = 22; // 科目
  for (let c = 2; c <= 1 + monthCount; c++) ws.getColumn(c).width = 12; // 各月
  ws.getColumn(yearTotalCol).width = 14; // 年間計
  for (let c = 2; c <= lastDataCol; c++) ws.getColumn(c).numFmt = NUM_FMT;

  return wb;
}
