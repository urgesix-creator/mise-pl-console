// ====================================================================
// 日次売上（統合）エクスポート 純粋関数（ExcelJS・DB非依存）
//
//   - 経営データ（daily_sales・day_period='all'）＋ 部門別売上（daily_department_sales）を
//     日付ごと1行に横統合した Workbook を組み立てる純粋関数。
//   - DB には一切アクセスしない（引数のデータを整形するだけ）。
//   - 経営計算ロジックには触れない（net/gross/service/tax は渡された実値をそのまま表示。
//     客単価のみ「gross÷客数」を参考表示として算出。経営と部門は連動させない）。
//   - 既存の SheetJS 実装（export.ts の部門別エクスポート: summaryToTable 等）は無変更で温存。
//     本ファイルは色付き（セル背景）が必要な統合フォーマット専用に ExcelJS を用いる。
//
//   ■ セル背景色（凡例）
//     グレー FFE5E7EB ＝【必須】：店舗名 / store_id / 日付 / 税抜売上(net)
//     薄ブルー FFDBEAFE ＝【自動】：サービス料 / 税額 / 客単価 / 部門計
//     色なし            ＝【任意】：税込売上 / 客数 / 天気 / イベントメモ / 各部門
//     ※色非対応ビューア向けに、列見出しにも【必須】【任意】【自動】の文字タグを併記する。
//
//   ■ 往復インポート用の境界判別（重要）
//     先頭に「見出しブロック（タイトル・期間・店舗・凡例・注記・空行）」を置く。
//     データ部のヘッダー行は、先頭セルが固定キーワード INTEGRATED_DATA_HEADER_KEY（= '店舗名'）で
//     始まる行として機械検出できる（見出しブロックの行はいずれもこの語で始まらない）。
//     → インポートはその行までを読み飛ばし、次行からをデータ本体とみなせる。
// ====================================================================

import { Workbook } from 'exceljs';
import type { CellValue, Fill } from 'exceljs';
import type { DailySalesExportRow } from './export';
// 天気のコード→日本語ラベルは「売上入力画面の単一定義」を参照（再定義せず乖離を防ぐ）。
// _schemas.ts は変更せず import のみ。DB値（コード）は不変で、出力時に表示変換するだけ。
import { WEATHER_LABEL, WEATHER_OPTIONS } from '@/app/(app)/daily-input/sales/_schemas';

// 色（ARGB）
const FILL_REQUIRED = 'FFE5E7EB'; // グレー＝必須
const FILL_AUTO = 'FFDBEAFE'; // 薄ブルー＝自動計算/参考

/** タイトル（見出しブロック先頭） */
export const INTEGRATED_SHEET_TITLE = '日次売上（統合）';
/** データ部ヘッダー行の先頭セルが必ずこの語で始まる（インポートの境界検出キー） */
export const INTEGRATED_DATA_HEADER_KEY = '店舗名';

/** daily_department_sales の1行（税込のみ） */
export type IntegratedDeptSalesRow = {
  store_id: string;
  business_date: string;
  department_id: string;
  gross_sales: number;
};

/** 部門マスタ（その店の有効部門のみを呼び出し側が渡す前提） */
export type IntegratedDeptMasterRow = {
  id: string;
  name: string;
  display_order: number;
};

/** 見出しブロック用メタ */
export type IntegratedExportMeta = {
  storeName: string;
  storeId: string;
  from: string;
  to: string;
};

/** 経営データ列の定義（順序・見出しタグ・色）。dept 列はこの後に動的追加する */
// store_id はデータ行には持たせず、見出しブロックに1回だけ表示する（1店舗1ファイルのため）。
const MGMT_COLUMNS: { header: string; fill: string | null }[] = [
  { header: '店舗名【必須】', fill: FILL_REQUIRED },
  { header: '日付【必須】', fill: FILL_REQUIRED },
  { header: '昼夜区分', fill: null },
  { header: '税抜売上【必須】', fill: FILL_REQUIRED },
  { header: '税込売上【任意】', fill: null },
  { header: '客数【任意】', fill: null },
  { header: '天気【任意】', fill: null },
  { header: 'イベントメモ【任意】', fill: null },
  { header: 'サービス料【自動】', fill: FILL_AUTO },
  { header: '税額【自動】', fill: FILL_AUTO },
  { header: '客単価【自動】', fill: FILL_AUTO },
];

/** solid 塗りつぶし Fill を作る */
function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/**
 * from〜to（YYYY-MM-DD）の全日付を昇順で列挙する（記入テンプレ用）。
 * 文字列ベースで1日ずつ進めるため、タイムゾーンずれの影響を受けない。
 * Action 側でも出力行数（テンプレ行数）の算出に再利用する。
 */
export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const pat = /^\d{4}-\d{2}-\d{2}$/;
  if (!pat.test(from) || !pat.test(to) || from > to) return out;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let cur = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  let guard = 0;
  while (cur <= end && guard < 100000) {
    const dt = new Date(cur);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur += 86400000;
    guard++;
  }
  return out;
}

/**
 * 天気のコード（sunny 等）を画面と同じ日本語ラベル（晴 等）へ変換する（表示のみ）。
 * 未知の値（旧データの自由入力等）はそのまま温存し、欠落させない。DB値は変更しない。
 */
function weatherLabel(code: string | null): string | null {
  if (!code) return null;
  return (WEATHER_LABEL as Record<string, string>)[code] ?? code;
}

/**
 * 統合フォーマットの Workbook を組み立てる純粋関数。
 *
 * @param salesRows     daily_sales（day_period='all'・当該店舗・期間内）
 * @param deptSalesRows daily_department_sales（当該店舗・期間内）
 * @param deptMaster    部門マスタ（有効部門のみ・display_order 順でなくても内部でソート）
 * @param meta          店舗名 / store_id / 期間
 * @returns ExcelJS Workbook（呼び出し側で writeBuffer 等を行う）
 */
export function buildIntegratedDailyWorkbook(
  salesRows: DailySalesExportRow[],
  deptSalesRows: IntegratedDeptSalesRow[],
  deptMaster: IntegratedDeptMasterRow[],
  meta: IntegratedExportMeta,
): Workbook {
  // --- 部門（列）：有効部門を display_order 順に固定 -----------------
  const activeDepts = [...deptMaster].sort((a, b) => a.display_order - b.display_order);

  // --- 突き合わせ用インデックス -----------------------------------
  const salesByDate = new Map<string, DailySalesExportRow>(
    salesRows.map((r) => [r.business_date, r]),
  );
  const deptByDateDept = new Map<string, number>(
    deptSalesRows.map((r) => [`${r.business_date}|${r.department_id}`, Number(r.gross_sales)]),
  );

  // 行軸（日付）＝対象期間 from〜to の全日付（記入テンプレ）。
  // 念のためデータのある日付とも和集合を取り（範囲外があっても欠落させない）昇順に整列。
  const allDates = Array.from(
    new Set<string>([
      ...enumerateDates(meta.from, meta.to),
      ...salesRows.map((r) => r.business_date),
      ...deptSalesRows.map((r) => r.business_date),
    ]),
  ).sort();

  // --- 列レイアウトと色マップ（1-based 列番号） -------------------
  const headers: string[] = [
    ...MGMT_COLUMNS.map((c) => c.header),
    ...activeDepts.map((d) => `${d.name}【任意】`),
    '部門計【自動】',
  ];
  const fillByCol = new Map<number, string>();
  MGMT_COLUMNS.forEach((c, i) => {
    if (c.fill) fillByCol.set(i + 1, c.fill);
  });
  const totalDeptColIndex = MGMT_COLUMNS.length + activeDepts.length + 1; // 部門計の列
  fillByCol.set(totalDeptColIndex, FILL_AUTO);
  // 部門列（MGMT_COLUMNS.length+1 .. +activeDepts.length）は色なし（任意）

  // --- 合計用アキュムレータ ---------------------------------------
  let netSum = 0;
  let grossSum = 0;
  let custSum = 0;
  let serviceSum = 0;
  let taxSum = 0;
  const deptSums = activeDepts.map(() => 0);
  let deptGrandSum = 0;

  // --- Workbook 構築 ----------------------------------------------
  const wb = new Workbook();
  const ws = wb.addWorksheet('日次売上（統合）');

  // 見出しブロック（各行 A 列に文字列。先頭セルは '店舗名' で始まらない＝境界検出と衝突しない）
  ws.addRow([INTEGRATED_SHEET_TITLE]);
  ws.addRow([`対象期間：${meta.from} 〜 ${meta.to}`]);
  // 対象店舗の近くに store_id を1回だけ表示（インポートはここから店舗を照合する）
  ws.addRow([`対象店舗：${meta.storeName}（store_id: ${meta.storeId}）`]);
  ws.addRow(['日付は YYYY-MM-DD 形式（文字列）で入力してください。']);
  ws.addRow([
    '凡例：【必須】未記入不可（グレー） ／ 【任意】入れれば反映（色なし） ／ 【自動】入力不要・自動計算（薄いブルー）',
  ]);
  ws.addRow(['このファイルはインポート（取込）にも使えます。']);
  ws.addRow([
    'サービス料：「税抜売上」列は、店舗設定が「サービス料込み」ならサービス料を含んだ税抜額を、「サービス料別」なら税抜本体を記入してください（サービス料・税額は自動計算します。どちらで読み込むかは取込前のプレビューに表示されます）。',
  ]);
  // 天気の選択肢（記入者がコピペで使える）。画面定義 WEATHER_OPTIONS と常に同期。
  ws.addRow([`天気の選択肢：${WEATHER_OPTIONS.map((w) => WEATHER_LABEL[w]).join(' / ')}`]);
  ws.addRow([]); // 空行（見出しとデータの区切り）

  // データ部ヘッダー行（先頭セル = '店舗名【必須】' → INTEGRATED_DATA_HEADER_KEY で検出可能）
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  for (const [col, argb] of fillByCol) {
    headerRow.getCell(col).fill = solidFill(argb);
  }

  // データ行（日付ごと1行）
  for (const date of allDates) {
    const s = salesByDate.get(date);
    const avg = s && s.customer_count > 0 ? s.gross_sales / s.customer_count : null;

    // 経営データ部（無ければ null＝空欄。net は必須色のまま空欄でもよい＝記入を促す）
    // store_id はデータ行に持たせない（見出しブロックに1回表示）。
    const mgmt: CellValue[] = [
      meta.storeName,
      date,
      s ? s.day_period : null,
      s ? s.net_sales : null,
      s ? s.gross_sales : null,
      s ? s.customer_count : null,
      s ? weatherLabel(s.weather) : null,
      s ? s.event_note ?? null : null,
      s ? s.service_fee : null,
      s ? s.tax_amount : null,
      avg,
    ];

    // 部門別部（その日の各部門 gross。無ければ空欄）。経営とは連動しない実値。
    let dayDeptSum = 0;
    let hasDept = false;
    const deptVals: CellValue[] = activeDepts.map((d, i) => {
      const v = deptByDateDept.get(`${date}|${d.id}`);
      if (v === undefined) return null;
      dayDeptSum += v;
      deptSums[i] += v;
      hasDept = true;
      return v;
    });

    // 合計用に経営値を加算
    if (s) {
      netSum += s.net_sales;
      grossSum += s.gross_sales;
      custSum += s.customer_count;
      serviceSum += s.service_fee;
      taxSum += s.tax_amount;
    }
    deptGrandSum += dayDeptSum;

    const rowValues: CellValue[] = [...mgmt, ...deptVals, hasDept ? dayDeptSum : null];
    const row = ws.addRow(rowValues);
    for (const [col, argb] of fillByCol) {
      row.getCell(col).fill = solidFill(argb);
    }
  }

  // 合計行（末尾）。客単価は合計を足さず gross合計÷客数合計で再計算
  const avgTotal = custSum > 0 ? grossSum / custSum : null;
  const totalsValues: CellValue[] = [
    '合計',
    null, // 日付
    null, // 昼夜区分
    netSum,
    grossSum,
    custSum,
    null, // 天気
    null, // イベントメモ
    serviceSum,
    taxSum,
    avgTotal,
    ...deptSums,
    deptGrandSum,
  ];
  const totalsRow = ws.addRow(totalsValues);
  totalsRow.font = { bold: true };
  for (const [col, argb] of fillByCol) {
    totalsRow.getCell(col).fill = solidFill(argb);
  }

  // 列幅（可読性。任意・データには影響しない）
  ws.getColumn(1).width = 16; // 店舗名
  ws.getColumn(2).width = 12; // 日付
  ws.getColumn(3).width = 10; // 昼夜区分
  for (let c = 4; c <= headers.length; c++) {
    const col = ws.getColumn(c);
    if (!col.width) col.width = 12;
  }

  // 日付列を文字列書式（@）にし、Excel の自動日付変換を抑止する
  const dateColIndex = MGMT_COLUMNS.findIndex((c) => c.header.startsWith('日付')) + 1;
  if (dateColIndex > 0) ws.getColumn(dateColIndex).numFmt = '@';

  return wb;
}
