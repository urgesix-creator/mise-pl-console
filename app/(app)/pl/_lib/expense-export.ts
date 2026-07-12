// ====================================================================
// 月次PL 販管費（monthly_expenses）テンプレート エクスポート 純粋関数（ExcelJS・DB非依存）
//
//   - 行＝科目（科目名・区分・12ヶ月の金額）、列＝科目名／区分／各月（'YYYY-MM' 文字列）の
//     往復可能なテンプレート Workbook を組み立てる。DB には一切アクセスしない。
//   - 既存の販管費があれば記入済みで出力。区分列は Excel データバリデーション（4種ドロップダウン）。
//   - 月見出しは 'YYYY-MM' を文字列書式（@）で出力（自動日付化・タイムゾーンずれを防止）。
//   - 見出しブロックに store_id を埋め込み、再インポート時の店舗照合に使う。
//
//   ※ 既存の売上予算テンプレ（targets/_lib/target-export.ts）・PL出力（pl-export.ts）は
//      変更しない。共通の作法（ExcelJS）をコピー思想で流用しているのみ。
// ====================================================================

import { Workbook } from 'exceljs';
import type { CellValue, Fill } from 'exceljs';
import { CATEGORY_TAGS, TAG_LABELS, type CategoryTag } from './expense-constants';

const FILL_REQUIRED = 'FFE5E7EB'; // グレー＝必須列
const FILL_HEADER = 'FFF1F5F9';

/** タイトル（見出しブロック先頭） */
export const EXPENSE_SHEET_TITLE = '販管費（月次・科目別）';
/** データ部ヘッダー行の先頭セルが必ずこの語で始まる（インポートの境界検出キー） */
export const EXPENSE_DATA_HEADER_KEY = '科目名';
/** 新規科目記入用の空行数（テンプレ余白） */
const SPARE_ROWS = 8;

/** 1科目（純粋関数の入力） */
export type ExpenseTemplateRow = {
  account_name: string;
  category_tag: CategoryTag;
  /** 'YYYY-MM' → 金額 */
  amounts: Record<string, number>;
  display_order: number;
};

/** 見出しブロック用メタ */
export type ExpenseTemplateMeta = {
  storeName: string;
  storeId: string;
  /** 決算期ラベル（例：'2026年度'） */
  fiscalYearLabel: string;
  /** 月列（'YYYY-MM'・決算期の12ヶ月・順序どおり） */
  monthColumns: string[];
  /** 通貨コード（例：'THB'） */
  currencyCode: string;
};

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** 区分ドロップダウンの選択肢（日本語ラベル・カンマ区切り） */
function tagDropdownFormula(): string {
  const labels = CATEGORY_TAGS.map((t) => TAG_LABELS[t]).join(',');
  return `"${labels}"`;
}

/**
 * 販管費テンプレートの Workbook を組み立てる純粋関数。
 * 列＝[科目名, 区分, ...12ヶ月]。既存科目を記入済みで出力し、末尾に空行（新規記入用）を付ける。
 */
export function buildExpenseTemplateWorkbook(
  rows: ExpenseTemplateRow[],
  meta: ExpenseTemplateMeta,
): Workbook {
  const monthCount = meta.monthColumns.length;
  const lastCol = 2 + monthCount; // 科目名(1) + 区分(2) + 月(monthCount)

  const wb = new Workbook();
  const ws = wb.addWorksheet('販管費');

  // 見出しブロック（先頭は EXPENSE_DATA_HEADER_KEY で始めない＝境界検出と衝突しない）
  ws.addRow([EXPENSE_SHEET_TITLE]).font = { bold: true, size: 14 };
  ws.addRow([`対象店舗：${meta.storeName}（store_id: ${meta.storeId}）`]);
  ws.addRow([`決算期：${meta.fiscalYearLabel}`]);
  ws.addRow([`通貨：${meta.currencyCode}（現地通貨）`]);
  ws.addRow(['※ 区分は「人件費／家賃／減価償却／その他」から選択してください。']);
  ws.addRow(['※ 金額が空欄の月は取り込みません（既存値を変更しません）。0 にしたい月は 0 と入力してください。']);
  ws.addRow(['※ 金額がすべて空欄でも、科目名と区分があれば「科目だけ」を登録できます（先頭月に0で登録・各月は後から編集可）。']);
  ws.addRow(['※ 月の見出し（YYYY-MM）は変更しないでください。このファイルはインポート（取込）に使えます。']);
  ws.addRow([]); // 区切り空行

  // データ部ヘッダー行（科目名 / 区分 / 各月）
  const headers: CellValue[] = [
    '科目名【必須】',
    '区分【必須】',
    ...meta.monthColumns, // 'YYYY-MM' 文字列
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  for (let c = 1; c <= lastCol; c++) {
    headerRow.getCell(c).fill = solidFill(c <= 2 ? FILL_REQUIRED : FILL_HEADER);
  }
  const firstDataRowNumber = headerRow.number + 1;

  // データ行（既存科目・display_order順は呼び出し側で整列済み）
  for (const r of rows) {
    const cells: CellValue[] = [r.account_name, TAG_LABELS[r.category_tag]];
    for (const ym of meta.monthColumns) {
      const v = r.amounts[ym];
      cells.push(v === undefined || v === null ? null : v);
    }
    ws.addRow(cells);
  }

  // 新規記入用の空行
  for (let i = 0; i < SPARE_ROWS; i++) {
    ws.addRow([null, null]);
  }

  const lastDataRowNumber = firstDataRowNumber + rows.length + SPARE_ROWS - 1;

  // 区分列（2列目）にデータバリデーション（4種ドロップダウン）
  const formula = tagDropdownFormula();
  for (let r = firstDataRowNumber; r <= lastDataRowNumber; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'warning',
      error: '人件費／家賃／減価償却／その他 から選択してください',
    };
  }

  // 書式・列幅
  ws.getColumn(1).width = 22; // 科目名
  ws.getColumn(1).numFmt = '@'; // 文字列
  ws.getColumn(2).width = 12; // 区分
  for (let c = 3; c <= lastCol; c++) {
    ws.getColumn(c).width = 11;
    ws.getColumn(c).numFmt = '#,##0';
  }

  return wb;
}
