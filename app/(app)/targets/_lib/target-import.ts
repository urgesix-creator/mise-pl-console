// ====================================================================
// 売上予算（日次目標）インポート パース＋検証（DB非依存・純粋）
//
//   - parseTargetWorkbook : Excel（予算テンプレ）を ExcelJS でパースし、見出しブロックを
//     読み飛ばして「日付」で始まるデータヘッダー行を検出。日付・予算額の生行を返す。
//   - buildTargetImportPreview : 生行を検証し new/update/error/skip を判定。
//
//   【確定方針】テンプレートに出力された全日付が対象。予算額が空欄の行は「0」として取り込む
//   （記入のない日は 0 で上書き）。日付が無い行（真の空行）はスキップ。
//
//   【厳守】DB に一切アクセスしない（既存値は引数で受け取る）。書き込みもしない。
// ====================================================================

import { Workbook } from 'exceljs';
import {
  isValidDateString,
  normalizeHeader,
  parseAmount,
  readCellString,
} from '@/lib/xlsx-utils';
import { TARGET_DATA_HEADER_KEY } from './target-export';
import type {
  ParseTargetResult,
  ParsedTargetRow,
  TargetImportPreview,
  TargetPreviewRow,
} from './target-import-types';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** ヘッダー正規化名 → フィールド */
const HEADER_TO_FIELD: Record<string, 'targetDate' | 'targetSales'> = {
  '日付': 'targetDate',
  '売上予算額（税抜）': 'targetSales',
  '売上予算額': 'targetSales', // タグ・括弧違いの後方互換
  '予算額': 'targetSales',
};

/** 取込まない参考列（曜日） */
const IGNORE_HEADERS = new Set(['曜日']);

/**
 * 予算テンプレの Excel をパースする（DB非依存）。
 * 見出しブロックを読み飛ばし、先頭セルが TARGET_DATA_HEADER_KEY（'日付'）で始まる行を
 * データヘッダーとして検出する。合計行（先頭セル '合計'）はスキップ。
 */
export async function parseTargetWorkbook(buffer: ArrayBuffer | Buffer): Promise<ParseTargetResult> {
  const wb = new Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return { ok: false, error: 'Excelファイルの読み込みに失敗しました（破損または非対応形式）' };
  }

  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: 'シートが見つかりません' };

  let headerRowNumber = -1;
  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  let storeNameLabel: string | null = null;
  let storeId: string | null = null;

  const lastRow = ws.rowCount;
  for (let r = 1; r <= lastRow; r++) {
    const first = readCellString(ws.getRow(r).getCell(1).value);
    if (first === null) continue;
    // タグ（【必須】等）除去後の完全一致で判定する。
    // startsWith だと注記行「日付は…」を誤検出するため、ヘッダー「日付【必須】」→正規化「日付」の
    // 完全一致でデータヘッダー行を特定する（注記行は正規化しても「日付」にならないので除外される）。
    if (normalizeHeader(first) === TARGET_DATA_HEADER_KEY) {
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
      const idMatch = full.match(/store_id:\s*([0-9a-fA-F-]{36})/);
      if (idMatch) storeId = idMatch[1];
      storeNameLabel = full.replace(/[（(]\s*store_id:[^）)]*[）)]/, '').trim();
    }
  }

  if (headerRowNumber === -1) {
    return {
      ok: false,
      error: 'データ部のヘッダー行（「日付」で始まる行）が見つかりません。売上予算フォーマットのファイルか確認してください',
    };
  }

  // ヘッダー行：列マップ構築
  const headerRow = ws.getRow(headerRowNumber);
  const colMap: Partial<Record<'targetDate' | 'targetSales', number>> = {};
  const colCount = headerRow.cellCount;
  for (let c = 1; c <= colCount; c++) {
    const raw = readCellString(headerRow.getCell(c).value);
    if (raw === null) continue;
    const key = normalizeHeader(raw);
    if (key === '' || IGNORE_HEADERS.has(key)) continue;
    const field = HEADER_TO_FIELD[key];
    if (field) colMap[field] = c;
  }
  if (!colMap.targetDate || !colMap.targetSales) {
    return { ok: false, error: '「日付」「売上予算額」の列が見つかりません' };
  }

  // データ行抽出。日付のある行のみ対象（予算額の空欄は許容＝後段で0に正規化）。
  const rows: ParsedTargetRow[] = [];
  for (let r = headerRowNumber + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const dateRaw = readCellString(row.getCell(colMap.targetDate).value);
    // 合計行（先頭セル '合計'）はスキップ
    if (dateRaw !== null && normalizeHeader(dateRaw) === '合計') continue;
    // 日付が無い行（真の空行）はスキップ（テンプレ行ではない）
    if (dateRaw === null) continue;

    rows.push({
      excelRow: r,
      storeId,
      targetDate: dateRaw,
      targetSales: readCellString(row.getCell(colMap.targetSales).value),
    });
  }

  return {
    ok: true,
    headerExcelRow: headerRowNumber,
    rows,
    meta: { periodFrom, periodTo, storeNameLabel, storeId },
  };
}

export type BuildTargetPreviewContext = {
  storeId: string;
  storeName: string;
  /** 既存 daily_targets：target_date → target_sales */
  existing: Map<string, number>;
  periodFrom: string | null;
  periodTo: string | null;
};

/** 1行を検証・正規化（空欄=0）。 */
function buildRow(parsed: ParsedTargetRow, ctx: BuildTargetPreviewContext): TargetPreviewRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // store_id（見出し由来）：必須・UUID・選択店舗と一致
  if (parsed.storeId === null) {
    errors.push('ファイルの対象店舗（store_id）が読み取れません');
  } else if (!UUID_PATTERN.test(parsed.storeId)) {
    errors.push('store_id の形式が不正です');
  } else if (parsed.storeId !== ctx.storeId) {
    errors.push('store_id が取込先店舗と一致しません');
  }

  // target_date：必須・実在日
  let dateOk = false;
  if (parsed.targetDate === null) {
    errors.push('日付が空です');
  } else if (!isValidDateString(parsed.targetDate)) {
    errors.push('日付の形式が不正です（YYYY-MM-DD・実在日）');
  } else {
    dateOk = true;
  }

  // target_sales：空欄=0・非負・数値
  let targetSales: number | null = null;
  const parsedAmount = parseAmount(parsed.targetSales);
  if (!parsedAmount.ok) {
    errors.push('売上予算額が数値ではありません');
  } else if (parsedAmount.value === null) {
    targetSales = 0; // 空欄=0
  } else if (parsedAmount.value < 0) {
    errors.push('売上予算額は0以上で入力してください');
  } else {
    targetSales = parsedAmount.value;
  }

  const key =
    errors.length === 0 && dateOk
      ? { storeId: ctx.storeId, targetDate: parsed.targetDate as string }
      : null;

  if (errors.length > 0 || key === null || targetSales === null) {
    return { excelRow: parsed.excelRow, status: 'error', key, targetSales, diff: null, errors, warnings };
  }

  const existing = ctx.existing.get(key.targetDate);
  if (existing === undefined) {
    return { excelRow: parsed.excelRow, status: 'new', key, targetSales, diff: null, errors, warnings };
  }
  const diff = existing !== targetSales ? { current: existing, next: targetSales } : null;
  return { excelRow: parsed.excelRow, status: 'update', key, targetSales, diff, errors, warnings };
}

/**
 * 生の行配列を検証・判定してプレビューを生成する純粋関数。
 * ファイル内キー重複は「最後の行優先」。先行する重複行は status='skip'。
 */
export function buildTargetImportPreview(
  rows: ParsedTargetRow[],
  ctx: BuildTargetPreviewContext,
): TargetImportPreview {
  const previewRows = rows.map((r) => buildRow(r, ctx));

  const lastIndexByKey = new Map<string, number>();
  previewRows.forEach((row, i) => {
    if ((row.status === 'new' || row.status === 'update') && row.key) {
      lastIndexByKey.set(row.key.targetDate, i);
    }
  });
  const duplicateKeys = new Set<string>();
  previewRows.forEach((row, i) => {
    if ((row.status === 'new' || row.status === 'update') && row.key) {
      if (lastIndexByKey.get(row.key.targetDate) !== i) {
        row.status = 'skip';
        row.warnings.push('同一日付の後続行で上書きされます（この行は取込対象外）');
        duplicateKeys.add(row.key.targetDate);
      }
    }
  });

  const summary = {
    total: previewRows.length,
    newCount: previewRows.filter((r) => r.status === 'new').length,
    updateCount: previewRows.filter((r) => r.status === 'update').length,
    errorCount: previewRows.filter((r) => r.status === 'error').length,
    skipCount: previewRows.filter((r) => r.status === 'skip').length,
    duplicateKeys: Array.from(duplicateKeys),
  };

  return {
    meta: {
      storeId: ctx.storeId,
      storeName: ctx.storeName,
      periodFrom: ctx.periodFrom,
      periodTo: ctx.periodTo,
    },
    summary,
    rows: previewRows,
  };
}
