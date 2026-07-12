// ====================================================================
// 日次売上（統合）インポート パース＋検証（DB非依存・純粋）
//
//   サブステップ1（ドライラン）の中核。
//   - parseIntegratedWorkbook : Excel(統合フォーマット)を ExcelJS でパースし、
//     見出しブロックを読み飛ばして「店舗名」で始まるデータヘッダー行を検出、
//     経営データ列と部門列を解釈して生の行配列を返す（往復の境界判別）。
//   - buildImportPreview       : 生の行を正規化・検証し、new/update/error/skip を判定。
//     既存 calculateSales（_schemas.ts §8.1）を改変せず import して
//     service_fee / tax / 客単価 を再計算（プレビュー表示用）。
//
//   【厳守】このモジュールは DB に一切アクセスしない（マスタ・現在値は引数で受け取る）。
//          書き込み（UPSERT）は行わない。実書き込みは後続サブステップ。
// ====================================================================

import { Workbook } from 'exceljs';
import type { CellValue } from 'exceljs';
import { INTEGRATED_DATA_HEADER_KEY } from './integrated-export';
import {
  calculateSales,
  calcAvgPerCustomer,
  grossNetDigitWarning,
  WEATHER_LABEL,
  type Weather,
} from '@/app/(app)/daily-input/sales/_schemas';
import type { TaxBase } from '@/types/database';
import type {
  ParseResult,
  ParsedRawRow,
  ParsedDeptCell,
  ImportPreview,
  ImportPreviewRow,
  ImportPreviewDeptCell,
  FieldDiff,
} from './integrated-import-types';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 経営データ列：正規化ヘッダー → ParsedRawRow のフィールド名。
 *  store_id はデータ行に持たせない（見出しブロックから1回読む）ため列マップから除外。 */
const MGMT_HEADER_TO_FIELD: Record<string, keyof ParsedRawRow> = {
  店舗名: 'storeName',
  日付: 'businessDate',
  昼夜区分: 'dayPeriod',
  税抜売上: 'netSales',
  税込売上: 'grossSales',
  客数: 'customerCount',
  天気: 'weather',
  イベントメモ: 'eventNote',
  備考: 'eventNote', // 後方互換：旧フォーマット（ヘッダー「備考」）も event_note として受理する
};

/** 自動計算列（取込せず再計算する）。部門列判定から除外する */
const AUTO_HEADERS = new Set(['サービス料', '税額', '客単価', '部門計']);

/** 見出しタグ（【必須】等）を除去して前後空白を落とす */
function normalizeHeader(raw: string): string {
  return raw.replace(/【[^】]*】/g, '').trim();
}

/** ExcelJS のセル値を文字列へ（空・null は null）。日付は YYYY-MM-DD に整形 */
function readCellString(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: CellValue; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) {
      const t = v.richText.map((r) => r.text).join('').trim();
      return t === '' ? null : t;
    }
    if (typeof v.text === 'string') {
      const t = v.text.trim();
      return t === '' ? null : t;
    }
    if (v.result !== undefined && v.result !== null) return readCellString(v.result);
  }
  return null;
}

/** 金額・客数の生文字列を数値へ。空は null、数値化不能は invalid */
function parseAmount(raw: string | null): { ok: true; value: number | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  const cleaned = raw.replace(/[,\s¥￥$]/g, '');
  if (cleaned === '') return { ok: true, value: null };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

/** YYYY-MM-DD が形式・実在日として正しいか */
function isValidDateString(s: string): boolean {
  if (!DATE_PATTERN.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 天気ラベル（晴 等）→ コード（sunny 等）の逆引きマップ */
const WEATHER_LABEL_TO_CODE: Record<string, Weather> = Object.entries(WEATHER_LABEL).reduce(
  (acc, [code, label]) => {
    acc[label] = code as Weather;
    return acc;
  },
  {} as Record<string, Weather>,
);

// --------------------------------------------------------------------
// 1-2: 純粋パーサ
// --------------------------------------------------------------------

/**
 * 統合フォーマットの Excel をパースする（DB非依存）。
 * 見出しブロックを読み飛ばし、先頭セルが INTEGRATED_DATA_HEADER_KEY（'店舗名'）で始まる
 * 行をデータヘッダーとして検出する。合計行（先頭セル '合計'）・空行はスキップ。
 */
export async function parseIntegratedWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ParseResult> {
  const wb = new Workbook();
  try {
    // exceljs は Buffer / ArrayBuffer のどちらも受け付ける
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return { ok: false, error: 'Excelファイルの読み込みに失敗しました（破損または非対応形式）' };
  }

  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: 'シートが見つかりません' };

  // --- 見出しブロックのメタ取得 ＋ データヘッダー行の検出 ----------
  let headerRowNumber = -1;
  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  let storeNameLabel: string | null = null;
  let storeId: string | null = null;

  const lastRow = ws.rowCount;
  for (let r = 1; r <= lastRow; r++) {
    const first = readCellString(ws.getRow(r).getCell(1).value);
    if (first === null) continue;
    if (first.startsWith(INTEGRATED_DATA_HEADER_KEY)) {
      headerRowNumber = r;
      break;
    }
    const period = first.match(/対象期間：(\S+)\s*〜\s*(\S+)/);
    if (period) {
      periodFrom = period[1];
      periodTo = period[2];
    }
    const store = first.match(/対象店舗：(.+)$/);
    if (store) {
      const full = store[1].trim();
      // 「店舗名（store_id: <uuid>）」から store_id を抽出し、表示名は (store_id...) を除去
      const idMatch = full.match(/store_id:\s*([0-9a-fA-F-]{36})/);
      if (idMatch) storeId = idMatch[1];
      storeNameLabel = full.replace(/[（(]\s*store_id:[^）)]*[）)]/, '').trim();
    }
  }

  if (headerRowNumber === -1) {
    return {
      ok: false,
      error: 'データ部のヘッダー行（「店舗名」で始まる行）が見つかりません。統合フォーマットのファイルか確認してください',
    };
  }

  // --- ヘッダー行を解釈：列インデックスのマップを構築 --------------
  const headerRow = ws.getRow(headerRowNumber);
  const mgmtCol: Partial<Record<keyof ParsedRawRow, number>> = {};
  const deptCols: { name: string; col: number }[] = [];

  const colCount = headerRow.cellCount;
  for (let c = 1; c <= colCount; c++) {
    const raw = readCellString(headerRow.getCell(c).value);
    if (raw === null) continue;
    const key = normalizeHeader(raw);
    if (key === '') continue;
    const field = MGMT_HEADER_TO_FIELD[key];
    if (field) {
      mgmtCol[field] = c;
      continue;
    }
    if (AUTO_HEADERS.has(key)) continue; // 自動列は取込まない
    deptCols.push({ name: key, col: c }); // それ以外＝部門列
  }

  const deptHeaderNames = deptCols.map((d) => d.name);

  // --- データ行の抽出（合計行・空行は除外） ------------------------
  const rows: ParsedRawRow[] = [];
  for (let r = headerRowNumber + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const firstCell = mgmtCol.storeName
      ? readCellString(row.getCell(mgmtCol.storeName).value)
      : readCellString(row.getCell(1).value);

    // 合計行（先頭セル '合計'）はスキップ
    if (firstCell !== null && normalizeHeader(firstCell) === '合計') continue;

    const get = (field: keyof ParsedRawRow): string | null => {
      const col = mgmtCol[field];
      return col ? readCellString(row.getCell(col).value) : null;
    };

    const departments: ParsedDeptCell[] = deptCols.map((d) => ({
      name: d.name,
      rawValue: readCellString(row.getCell(d.col).value),
    }));

    const storeName = get('storeName');
    const businessDate = get('businessDate');
    const dayPeriod = get('dayPeriod');
    const netSales = get('netSales');
    const grossSales = get('grossSales');
    const customerCount = get('customerCount');
    const weather = get('weather');
    const eventNote = get('eventNote');

    // 空テンプレ行のドロップ：日付・店舗名・昼夜区分は「記入」とみなさず、
    // 売上系（net/gross/客数/天気/イベントメモ/部門）が全て空なら未記入の日として除外する。
    // （日付だけ入った全日付テンプレの空行をエラーにせず取込対象から外す）
    const hasEntryValue =
      [netSales, grossSales, customerCount, weather, eventNote].some((v) => v !== null) ||
      departments.some((d) => d.rawValue !== null);
    if (!hasEntryValue) continue;

    rows.push({
      excelRow: r,
      storeName,
      // store_id はデータ行に無いため、ファイルレベル（見出し）の値を全行に付与する。
      // これにより既存の行レベル店舗照合ロジックを変更せず再利用できる。
      storeId,
      businessDate,
      dayPeriod,
      netSales,
      grossSales,
      customerCount,
      weather,
      eventNote,
      departments,
    });
  }

  return {
    ok: true,
    headerExcelRow: headerRowNumber,
    deptHeaderNames,
    rows,
    meta: { periodFrom, periodTo, storeNameLabel, storeId },
  };
}

// --------------------------------------------------------------------
// 1-3 + プレビュー生成: 正規化・検証・判定（DB非依存）
// --------------------------------------------------------------------

/** 既存 daily_sales 1行（差分表示用・呼び出し側が読み取って渡す） */
export type ExistingSalesRow = {
  net_sales: number;
  gross_sales: number;
  service_fee: number;
  tax_amount: number;
  customer_count: number;
  weather: string | null;
  event_note: string | null;
};

/** buildImportPreview のコンテキスト（マスタ・現在値・店舗パラメータ。すべて呼出側がDBから読取） */
export type BuildPreviewContext = {
  storeId: string;
  storeName: string;
  serviceFeeRate: number;
  taxRate: number;
  taxBase: TaxBase;
  /** 店舗のサービス料入力モード（true=込み）。calculateSales へそのまま渡す（売上入力と同一計算） */
  serviceFeeIncluded: boolean;
  /** 当該店の有効部門：部門名 → department_id */
  deptNameToId: Map<string, string>;
  /** 既存 daily_sales（day_period='all'）：business_date → 行 */
  existingSales: Map<string, ExistingSalesRow>;
  /** 既存 daily_department_sales：`${business_date}|${department_id}` → gross */
  existingDept: Map<string, number>;
  periodFrom: string | null;
  periodTo: string | null;
  deptHeaderNames: string[];
};

/** 部門セルを判定（登録/未登録・new/update・差分） */
function buildDeptCell(
  parsed: ParsedDeptCell,
  businessDate: string | null,
  ctx: BuildPreviewContext,
  skippedDepartments: Set<string>,
  warnings: string[],
): ImportPreviewDeptCell {
  const departmentId = ctx.deptNameToId.get(parsed.name) ?? null;

  // 未登録部門：列ごとスキップ（自動登録しない）
  if (departmentId === null) {
    skippedDepartments.add(parsed.name);
    return { name: parsed.name, departmentId: null, gross: null, action: 'skip-unregistered' };
  }

  const amount = parseAmount(parsed.rawValue);
  if (!amount.ok) {
    warnings.push(`部門「${parsed.name}」の値が数値ではありません（取込対象外）`);
    return { name: parsed.name, departmentId, gross: null, action: 'apply' };
  }
  if (amount.value === null) {
    // 空欄＝その部門の値なし（no-op）
    return { name: parsed.name, departmentId, gross: null, action: 'apply' };
  }
  if (amount.value < 0) {
    warnings.push(`部門「${parsed.name}」の値が負値です（取込対象外）`);
    return { name: parsed.name, departmentId, gross: null, action: 'apply' };
  }

  const cell: ImportPreviewDeptCell = {
    name: parsed.name,
    departmentId,
    gross: amount.value,
    action: 'apply',
  };
  if (businessDate !== null) {
    const existing = ctx.existingDept.get(`${businessDate}|${departmentId}`);
    if (existing === undefined) {
      cell.status = 'new';
    } else {
      cell.status = 'update';
      cell.diff = { current: existing, next: amount.value };
    }
  }
  return cell;
}

/** 1データ行を検証・正規化し、プレビュー行を作る（重複判定は後段でまとめて行う） */
function buildRow(parsed: ParsedRawRow, ctx: BuildPreviewContext, skippedDepartments: Set<string>): ImportPreviewRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- store_id：必須・UUID・選択店舗と一致 -----------------------
  let storeIdOk = false;
  if (parsed.storeId === null) {
    errors.push('store_id が空です');
  } else if (!UUID_PATTERN.test(parsed.storeId)) {
    errors.push('store_id の形式が不正です');
  } else if (parsed.storeId !== ctx.storeId) {
    errors.push('store_id が取込先店舗と一致しません');
  } else {
    storeIdOk = true;
  }

  // --- business_date：必須・実在日 --------------------------------
  let dateOk = false;
  if (parsed.businessDate === null) {
    errors.push('日付が空です');
  } else if (!isValidDateString(parsed.businessDate)) {
    errors.push('日付の形式が不正です（YYYY-MM-DD・実在日）');
  } else {
    dateOk = true;
  }

  // --- day_period：'all' のみ許容（空欄は all 既定。lunch/dinner 等はエラー） ---
  let dayPeriod = 'all';
  if (parsed.dayPeriod !== null && parsed.dayPeriod !== 'all') {
    errors.push(`昼夜区分が想定外です（'all' のみ可・全店all前提）: ${parsed.dayPeriod}`);
  }

  // --- net_sales：必須・数値・非負 --------------------------------
  let netSales: number | null = null;
  const netParsed = parseAmount(parsed.netSales);
  if (!netParsed.ok) {
    errors.push('税抜売上が数値ではありません');
  } else if (netParsed.value === null) {
    errors.push('税抜売上は必須です');
  } else if (netParsed.value < 0) {
    errors.push('税抜売上は0以上で入力してください');
  } else {
    netSales = netParsed.value;
  }

  // --- gross_sales：任意・非負（空欄は0） -------------------------
  let grossSales = 0;
  const grossParsed = parseAmount(parsed.grossSales);
  if (!grossParsed.ok) {
    errors.push('税込売上が数値ではありません');
  } else if (grossParsed.value === null) {
    grossSales = 0;
  } else if (grossParsed.value < 0) {
    errors.push('税込売上は0以上で入力してください');
  } else {
    grossSales = grossParsed.value;
  }

  // --- customer_count：任意・整数・非負（空欄は0） ----------------
  let customerCount = 0;
  const custParsed = parseAmount(parsed.customerCount);
  if (!custParsed.ok) {
    errors.push('客数が数値ではありません');
  } else if (custParsed.value === null) {
    customerCount = 0;
  } else if (custParsed.value < 0) {
    errors.push('客数は0以上で入力してください');
  } else if (!Number.isInteger(custParsed.value)) {
    errors.push('客数は整数で入力してください');
  } else {
    customerCount = custParsed.value;
  }

  // --- weather：ラベル→コード変換（未知は原文温存＋警告・空は空のまま） ---
  let weather: string | null = null;
  if (parsed.weather !== null) {
    const code = WEATHER_LABEL_TO_CODE[parsed.weather];
    if (code) {
      weather = code;
    } else {
      weather = parsed.weather; // 原文温存（DB値は将来サブステップでそのまま扱う）
      warnings.push(`天気「${parsed.weather}」は規定の選択肢外です（原文のまま保持・要確認）`);
    }
  }

  // --- event_note：500文字まで（超過は警告のみ・切り捨てない） -----
  const eventNote = parsed.eventNote;
  if (eventNote !== null && eventNote.length > 500) {
    warnings.push('イベントメモが500文字を超えています');
  }

  // --- 桁違い警告（既存 grossNetDigitWarning 流用・保存はブロックしない） ---
  if (netSales !== null && netSales > 0) {
    const dw = grossNetDigitWarning(grossSales, netSales);
    if (dw.warn && dw.message) warnings.push(dw.message);
  }

  // --- 部門セル判定（行のエラー有無にかかわらず提示） --------------
  const departments = parsed.departments.map((d) =>
    buildDeptCell(d, dateOk ? parsed.businessDate : null, ctx, skippedDepartments, warnings),
  );

  const key =
    storeIdOk && dateOk
      ? { storeId: ctx.storeId, businessDate: parsed.businessDate as string, dayPeriod }
      : null;

  // --- エラー行：ここで確定（再計算・差分は出さない） --------------
  if (errors.length > 0 || netSales === null) {
    return {
      excelRow: parsed.excelRow,
      status: 'error',
      key,
      input: { netSales, grossSales, customerCount, weather, eventNote },
      recalc: null,
      diff: null,
      departments,
      errors,
      warnings,
    };
  }

  // --- 再計算（既存 calculateSales を改変せず使用・店舗モードをそのまま渡す） ----
  const calc = calculateSales({
    netSales,
    grossSales,
    serviceFeeRate: ctx.serviceFeeRate,
    taxRate: ctx.taxRate,
    taxBase: ctx.taxBase,
    customerCount,
    serviceFeeIncluded: ctx.serviceFeeIncluded,
  });
  const recalc = {
    netSales: calc.net_sales, // 込み時は本体（=記入÷(1+料率)）。別時は記入の round2
    serviceFee: calc.service_fee,
    taxAmount: calc.tax_amount,
    avgPerCustomer: calc.avg_per_customer,
  };

  // --- new / update 判定 ＋ 差分（update のみ） --------------------
  const existing = key ? ctx.existingSales.get(key.businessDate) : undefined;
  let status: ImportPreviewRow['status'] = 'new';
  let diff: Record<string, FieldDiff> | null = null;

  if (existing) {
    status = 'update';
    const currentAvg = calcAvgPerCustomer(existing.gross_sales, existing.customer_count);
    const candidate: Record<string, FieldDiff> = {
      net_sales: { current: existing.net_sales, next: calc.net_sales },
      gross_sales: { current: existing.gross_sales, next: calc.gross_sales },
      customer_count: { current: existing.customer_count, next: customerCount },
      weather: { current: existing.weather, next: weather },
      event_note: { current: existing.event_note, next: eventNote },
      service_fee: { current: existing.service_fee, next: calc.service_fee },
      tax_amount: { current: existing.tax_amount, next: calc.tax_amount },
      avg_per_customer: { current: currentAvg, next: calc.avg_per_customer },
    };
    // 変化のある項目のみ残す
    diff = {};
    for (const [field, d] of Object.entries(candidate)) {
      if (d.current !== d.next) diff[field] = d;
    }
  }

  return {
    excelRow: parsed.excelRow,
    status,
    key,
    input: { netSales, grossSales, customerCount, weather, eventNote },
    recalc,
    diff,
    departments,
    errors,
    warnings,
  };
}

/**
 * 生の行配列を検証・判定し、プレビュー（ドライラン結果）を生成する純粋関数。
 * ファイル内キー重複は「最後の行優先」。先行する重複行は status='skip'。
 */
export function buildImportPreview(rows: ParsedRawRow[], ctx: BuildPreviewContext): ImportPreview {
  const skippedDepartments = new Set<string>();
  const previewRows = rows.map((r) => buildRow(r, ctx, skippedDepartments));

  // --- ファイル内キー重複：書き込み候補（new/update）同士で最後の行を優先 ---
  const lastIndexByKey = new Map<string, number>();
  previewRows.forEach((row, i) => {
    if ((row.status === 'new' || row.status === 'update') && row.key) {
      lastIndexByKey.set(keyString(row.key), i);
    }
  });
  const duplicateKeys = new Set<string>();
  previewRows.forEach((row, i) => {
    if ((row.status === 'new' || row.status === 'update') && row.key) {
      const ks = keyString(row.key);
      if (lastIndexByKey.get(ks) !== i) {
        row.status = 'skip';
        row.warnings.push('同一キーの後続行で上書きされます（この行は取込対象外）');
        duplicateKeys.add(ks);
      }
    }
  });

  const summary = {
    total: previewRows.length,
    newCount: previewRows.filter((r) => r.status === 'new').length,
    updateCount: previewRows.filter((r) => r.status === 'update').length,
    errorCount: previewRows.filter((r) => r.status === 'error').length,
    skipCount: previewRows.filter((r) => r.status === 'skip').length,
    skippedDepartments: Array.from(skippedDepartments),
    duplicateKeys: Array.from(duplicateKeys),
  };

  return {
    meta: {
      storeId: ctx.storeId,
      storeName: ctx.storeName,
      periodFrom: ctx.periodFrom,
      periodTo: ctx.periodTo,
      deptHeaderNames: ctx.deptHeaderNames,
    },
    summary,
    rows: previewRows,
  };
}

function keyString(key: { storeId: string; businessDate: string; dayPeriod: string }): string {
  return `${key.storeId}|${key.businessDate}|${key.dayPeriod}`;
}
