// ====================================================================
// 売上予算（日次目標）エクスポート 純粋関数（ExcelJS・DB非依存）
//
//   - daily_targets（store_id, target_date, target_sales）を日付ごと1行に出力する
//     記入テンプレート Workbook を組み立てる純粋関数。DB には一切アクセスしない。
//   - 日次売上の統合フォーマットを簡素化（税計算・部門・客数・天気・備考を全削除）。
//     列は「日付・曜日（参考）・売上予算額」の3列のみ。
//   - 日付は文字列で出力（Excelの自動日付整形・タイムゾーンずれを防止）。
//
//   ■ 往復インポート用の境界判別
//     先頭の見出しブロック（タイトル・期間・店舗＋store_id・注記）の行は、いずれも
//     固定キー TARGET_DATA_HEADER_KEY（= '日付'）で始まらない。データ部ヘッダー行のみ
//     '日付【必須】' で始まるため、インポートはそこを境界として検出できる。
// ====================================================================

import { Workbook } from 'exceljs';
import type { CellValue, Fill } from 'exceljs';
import { enumerateDates, weekdayJa } from '@/lib/xlsx-utils';

const FILL_REQUIRED = 'FFE5E7EB'; // グレー＝必須

/** タイトル（見出しブロック先頭） */
export const TARGET_SHEET_TITLE = '売上予算（日次目標）';
/** データ部ヘッダー行の先頭セルが必ずこの語で始まる（インポートの境界検出キー） */
export const TARGET_DATA_HEADER_KEY = '日付';

/** daily_targets の1行（純粋関数の入力） */
export type TargetExportRow = {
  target_date: string;
  target_sales: number;
};

/** 見出しブロック用メタ */
export type TargetExportMeta = {
  storeName: string;
  storeId: string;
  from: string;
  to: string;
};

/** 列定義（順序・色）。曜日は参考列・予算額は必須 */
const COLUMNS: { header: string; fill: string | null }[] = [
  { header: '日付【必須】', fill: FILL_REQUIRED },
  { header: '曜日', fill: null },
  { header: '売上予算額（税抜）【必須】', fill: FILL_REQUIRED },
];

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/**
 * 売上予算テンプレートの Workbook を組み立てる純粋関数。
 * 行軸（日付）＝対象期間 from〜to の全日付（記入テンプレ。データのある日とも和集合）。
 */
export function buildTargetWorkbook(rows: TargetExportRow[], meta: TargetExportMeta): Workbook {
  const targetByDate = new Map<string, number>(rows.map((r) => [r.target_date, r.target_sales]));

  const allDates = Array.from(
    new Set<string>([...enumerateDates(meta.from, meta.to), ...rows.map((r) => r.target_date)]),
  ).sort();

  const headers = COLUMNS.map((c) => c.header);
  const fillByCol = new Map<number, string>();
  COLUMNS.forEach((c, i) => {
    if (c.fill) fillByCol.set(i + 1, c.fill);
  });

  let targetSum = 0;

  const wb = new Workbook();
  const ws = wb.addWorksheet('売上予算');

  // 見出しブロック（先頭セルは '日付' で始まらない＝境界検出と衝突しない）
  ws.addRow([TARGET_SHEET_TITLE]);
  ws.addRow([`対象期間：${meta.from} 〜 ${meta.to}`]);
  ws.addRow([`対象店舗：${meta.storeName}（store_id: ${meta.storeId}）`]);
  // 注記は見出し境界キー（'日付' / '売上予算額'）で始めない（インポートのヘッダー検出と衝突させない）。
  ws.addRow(['※ 入力形式：YYYY-MM-DD（文字列）。予算額は税抜（ネットセールス）基準。']);
  ws.addRow(['※ 空欄の日は 0 として取り込まれます。']);
  ws.addRow(['このファイルはインポート（取込）にも使えます。']);
  ws.addRow([]); // 区切り空行

  // データ部ヘッダー行（先頭セル = '日付【必須】' → TARGET_DATA_HEADER_KEY で検出可能）
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  for (const [col, argb] of fillByCol) {
    headerRow.getCell(col).fill = solidFill(argb);
  }

  // データ行（日付ごと1行）
  for (const date of allDates) {
    const target = targetByDate.get(date);
    if (target !== undefined) targetSum += target;
    const rowValues: CellValue[] = [date, weekdayJa(date), target ?? null];
    const row = ws.addRow(rowValues);
    for (const [col, argb] of fillByCol) {
      row.getCell(col).fill = solidFill(argb);
    }
  }

  // 合計行（末尾）
  const totalsRow = ws.addRow(['合計', null, targetSum]);
  totalsRow.font = { bold: true };
  for (const [col, argb] of fillByCol) {
    totalsRow.getCell(col).fill = solidFill(argb);
  }

  // 列幅
  ws.getColumn(1).width = 14; // 日付
  ws.getColumn(2).width = 8; // 曜日
  ws.getColumn(3).width = 18; // 予算額

  // 日付列を文字列書式（@）にして Excel の自動日付変換を抑止
  ws.getColumn(1).numFmt = '@';

  return wb;
}
