'use server';

import { Workbook } from 'exceljs';

// ====================================================================
// 部門別売上 Excel(.xlsx) 生成 Server Action（exceljs）
//   - 旧 SheetJS(xlsx) のクライアント生成（downloadXlsx）を置換。
//   - 受け取った表データ（headers + rows）を整形して base64(xlsx) を返すのみ。
//     DB・集計ロジックには一切関与しない（呼び出し側で算出済みの値を出力するだけ）。
// ====================================================================

type TableData = {
  headers: string[];
  rows: (string | number)[][];
};

/** 表データ → Excel(.xlsx) を生成し base64 で返す */
export async function buildDepartmentXlsx(
  sheetName: string,
  table: TableData,
): Promise<{ base64: string }> {
  const wb = new Workbook();
  // シート名は31文字以内（Excel制約）
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.addRow(table.headers);
  for (const row of table.rows) {
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  const base64 = Buffer.from(buf as ArrayBuffer).toString('base64');
  return { base64 };
}
