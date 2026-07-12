// ====================================================================
// 月次PL 販管費（monthly_expenses）インポート パース＋検証（DB非依存・純粋）
//
//   - parseExpenseWorkbook : Excel（販管費テンプレ）を ExcelJS でパースし、見出しブロックを
//     読み飛ばして「科目名」で始まるデータヘッダー行を検出。科目名・区分・各月（YYYY-MM）の
//     生行を返す。月列はヘッダー（'YYYY-MM' 文字列）から自己記述的に決定する。
//   - buildExpenseImportPreview : 生行を検証し、セル単位で取込内容を判定（空欄スキップ・
//     区分の日本語ラベル逆引き・科目重複は last-wins）。
//
//   【厳守】DB に一切アクセスしない（既存値は引数で受け取る）。書き込みもしない。
// ====================================================================

import { Workbook } from 'exceljs';
import { normalizeHeader, parseAmount, readCellString } from '@/lib/xlsx-utils';
import { CATEGORY_TAGS, TAG_LABELS, type CategoryTag } from './expense-constants';
import { EXPENSE_DATA_HEADER_KEY } from './expense-export';
import type {
  ExpenseCellChange,
  ExpenseImportPreview,
  ExpensePreviewRow,
  ParseExpenseResult,
  ParsedExpenseRow,
} from './expense-import-types';

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const MAX_AMOUNT = 1_000_000_000_000;

/** 区分の生値（日本語ラベル or 内部値）→ CategoryTag の逆引きマップ */
const LABEL_TO_TAG: Map<string, CategoryTag> = (() => {
  const m = new Map<string, CategoryTag>();
  for (const t of CATEGORY_TAGS) {
    m.set(TAG_LABELS[t], t); // 日本語ラベル
    m.set(t, t); // 内部値直書きも許容
  }
  return m;
})();

/** 'YYYY-MM' が形式・実在月として正しいか */
function isValidYearMonth(s: string): boolean {
  if (!MONTH_PATTERN.test(s)) return false;
  const m = Number(s.slice(5, 7));
  return m >= 1 && m <= 12;
}

/**
 * 販管費テンプレの Excel をパースする（DB非依存）。
 * 見出しブロックを読み飛ばし、先頭セルが EXPENSE_DATA_HEADER_KEY（'科目名'）で始まる行を
 * データヘッダーとして検出。月列は 'YYYY-MM' ヘッダーから決定する。
 */
export async function parseExpenseWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ParseExpenseResult> {
  const wb = new Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return { ok: false, error: 'Excelファイルの読み込みに失敗しました（破損または非対応形式）' };
  }

  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: 'シートが見つかりません' };

  let headerRowNumber = -1;
  let storeNameLabel: string | null = null;
  let storeId: string | null = null;
  let fiscalYearLabel: string | null = null;

  const lastRow = ws.rowCount;
  for (let r = 1; r <= lastRow; r++) {
    const first = readCellString(ws.getRow(r).getCell(1).value);
    if (first === null) continue;
    if (normalizeHeader(first) === EXPENSE_DATA_HEADER_KEY) {
      headerRowNumber = r;
      break;
    }
    const store = first.match(/対象店舗：(.+)$/);
    if (store) {
      const full = store[1].trim();
      const idMatch = full.match(/store_id:\s*([0-9a-fA-F-]{36})/);
      if (idMatch) storeId = idMatch[1];
      storeNameLabel = full.replace(/[（(]\s*store_id:[^）)]*[）)]/, '').trim();
    }
    const fy = first.match(/決算期：(.+)$/);
    if (fy) fiscalYearLabel = fy[1].trim();
  }

  if (headerRowNumber === -1) {
    return {
      ok: false,
      error: 'データ部のヘッダー行（「科目名」で始まる行）が見つかりません。販管費テンプレートのファイルか確認してください',
    };
  }

  // ヘッダー行：列マップ構築（科目名 / 区分 / 各月）
  const headerRow = ws.getRow(headerRowNumber);
  const colCount = headerRow.cellCount;
  let accountCol = -1;
  let categoryCol = -1;
  const monthCols: { col: number; yearMonth: string }[] = [];
  for (let c = 1; c <= colCount; c++) {
    const raw = readCellString(headerRow.getCell(c).value);
    if (raw === null) continue;
    const key = normalizeHeader(raw);
    if (key === EXPENSE_DATA_HEADER_KEY) accountCol = c;
    else if (key === '区分') categoryCol = c;
    else if (isValidYearMonth(key)) monthCols.push({ col: c, yearMonth: key });
  }
  if (accountCol === -1 || categoryCol === -1) {
    return { ok: false, error: '「科目名」「区分」の列が見つかりません' };
  }
  if (monthCols.length === 0) {
    return { ok: false, error: '月の列（YYYY-MM）が見つかりません' };
  }

  // データ行抽出（科目名 or いずれかの金額がある行のみ。完全空行はスキップ）
  const rows: ParsedExpenseRow[] = [];
  for (let r = headerRowNumber + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const accountName = readCellString(row.getCell(accountCol).value);
    const categoryRaw = readCellString(row.getCell(categoryCol).value);
    const cells = monthCols.map((mc) => ({
      yearMonth: mc.yearMonth,
      raw: readCellString(row.getCell(mc.col).value),
    }));
    const hasAmount = cells.some((cell) => cell.raw !== null);
    if (accountName === null && categoryRaw === null && !hasAmount) continue; // 完全空行
    rows.push({ excelRow: r, accountName, categoryRaw, cells });
  }

  return {
    ok: true,
    headerExcelRow: headerRowNumber,
    rows,
    meta: { storeNameLabel, storeId, fiscalYearLabel, monthColumns: monthCols.map((m) => m.yearMonth) },
  };
}

export type BuildExpensePreviewContext = {
  storeId: string;
  storeName: string;
  fiscalYearLabel: string | null;
  monthColumns: string[];
  /** 既存 monthly_expenses：account_name → ('YYYY-MM' → amount) */
  existing: Map<string, Map<string, number>>;
  /** 計算式科目（expense_formulas）の科目名集合（同名は手入力で取り込めない＝衝突error） */
  formulaNames: Set<string>;
};

/** 1行（1科目）を検証・正規化（空欄スキップ・区分逆引き）。 */
function buildRow(parsed: ParsedExpenseRow, ctx: BuildExpensePreviewContext): ExpensePreviewRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 科目名：trim・必須・≤100
  const accountName = parsed.accountName ? parsed.accountName.trim() : '';
  const hasAnyAmount = parsed.cells.some((c) => c.raw !== null);
  if (accountName === '') {
    if (hasAnyAmount) errors.push('科目名が空です（金額のみの行）');
  } else if (accountName.length > 100) {
    errors.push('科目名は100文字以内で入力してください');
  }

  // 計算式科目（expense_formulas）と同名は手入力で取り込めない（名前衝突を防ぐ）
  if (accountName !== '' && ctx.formulaNames.has(accountName)) {
    errors.push('計算式科目と同名のため取り込めません（この科目は計算式側で管理されています）');
  }

  // 区分：金額のある科目は必須。日本語ラベル/内部値を逆引き
  let categoryTag: CategoryTag | null = null;
  const catRaw = parsed.categoryRaw ? parsed.categoryRaw.trim() : '';
  if (catRaw !== '') {
    const mapped = LABEL_TO_TAG.get(catRaw);
    if (!mapped) errors.push(`区分が不正です（${catRaw}）。人件費/家賃/減価償却/その他 から選択してください`);
    else categoryTag = mapped;
  }

  // 各月：空欄スキップ・非負・数値・上限
  const validCells: { yearMonth: string; value: number }[] = [];
  for (const cell of parsed.cells) {
    const parsedAmount = parseAmount(cell.raw);
    if (!parsedAmount.ok) {
      errors.push(`${cell.yearMonth} の金額が数値ではありません`);
      continue;
    }
    if (parsedAmount.value === null) continue; // 空欄＝スキップ（取り込まない）
    if (parsedAmount.value < 0) {
      errors.push(`${cell.yearMonth} の金額は0以上で入力してください`);
      continue;
    }
    if (parsedAmount.value > MAX_AMOUNT) {
      errors.push(`${cell.yearMonth} の金額が上限を超えています`);
      continue;
    }
    validCells.push({ yearMonth: cell.yearMonth, value: parsedAmount.value });
  }

  // 金額があるのに区分未選択はエラー
  if (validCells.length > 0 && categoryTag === null) {
    errors.push('区分を選択してください（金額のある科目）');
  }

  if (errors.length > 0) {
    return {
      excelRow: parsed.excelRow,
      status: 'error',
      accountName: accountName || null,
      categoryTag,
      upsertCells: [],
      errors,
      warnings,
    };
  }

  // 取り込む金額が無い（全月空欄）場合の扱い。
  //  金額ゼロでも「科目だけ」を登録できるようにする（科目名＋区分があれば取り込む）。
  //   - 科目名なし → 取込対象外（skip）
  //   - 区分なし   → エラー（category_tag は必須）
  //   - 既存科目   → 既にPLに表示されるため金額は変更せず維持（unchanged・既存値保護）
  //   - 新規科目   → 先頭の対象月に amount=0 を登録し、科目枠だけを作る（各月は後から編集可）
  if (validCells.length === 0) {
    if (accountName === '') {
      warnings.push('科目名・金額がないため、この行は取り込みません');
      return {
        excelRow: parsed.excelRow,
        status: 'skip',
        accountName: null,
        categoryTag,
        upsertCells: [],
        errors,
        warnings,
      };
    }
    if (categoryTag === null) {
      errors.push('区分を選択してください（金額ゼロで科目のみ取り込む場合も区分は必須です）');
      return {
        excelRow: parsed.excelRow,
        status: 'error',
        accountName,
        categoryTag,
        upsertCells: [],
        errors,
        warnings,
      };
    }
    if (ctx.existing.has(accountName)) {
      warnings.push('既存の科目のため、金額は変更しません（科目は登録済み）');
      return {
        excelRow: parsed.excelRow,
        status: 'unchanged',
        accountName,
        categoryTag,
        upsertCells: [],
        errors,
        warnings,
      };
    }
    const anchorMonth = ctx.monthColumns[0];
    warnings.push('金額がゼロのため、科目のみ登録します（先頭月に0で登録・各月は後から編集できます）');
    return {
      excelRow: parsed.excelRow,
      status: 'new',
      accountName,
      categoryTag,
      upsertCells: [{ yearMonth: anchorMonth, next: 0, current: null, changed: true }],
      errors,
      warnings,
    };
  }

  // セルごとの変更判定
  const existingForAccount = ctx.existing.get(accountName);
  const upsertCells: ExpenseCellChange[] = validCells.map((vc) => {
    const current = existingForAccount?.get(vc.yearMonth) ?? null;
    return {
      yearMonth: vc.yearMonth,
      next: vc.value,
      current,
      changed: current === null ? true : current !== vc.value,
    };
  });

  const accountExists = ctx.existing.has(accountName);
  const anyChanged = upsertCells.some((c) => c.changed);
  let status: ExpensePreviewRow['status'];
  if (!accountExists) status = 'new';
  else if (anyChanged) status = 'update';
  else status = 'unchanged';

  return {
    excelRow: parsed.excelRow,
    status,
    accountName,
    categoryTag,
    upsertCells,
    errors,
    warnings,
  };
}

/**
 * 生の行配列を検証・判定してプレビューを生成する純粋関数。
 * ファイル内の科目名重複は「最後の行優先」。先行する重複行は status='skip'。
 */
export function buildExpenseImportPreview(
  rows: ParsedExpenseRow[],
  ctx: BuildExpensePreviewContext,
): ExpenseImportPreview {
  const previewRows = rows.map((r) => buildRow(r, ctx));

  // 科目名重複（trim後）：new/update/unchanged の行のみ対象・last-wins
  const lastIndexByName = new Map<string, number>();
  previewRows.forEach((row, i) => {
    if (
      (row.status === 'new' || row.status === 'update' || row.status === 'unchanged') &&
      row.accountName
    ) {
      lastIndexByName.set(row.accountName, i);
    }
  });
  const duplicateNames = new Set<string>();
  previewRows.forEach((row, i) => {
    if (
      (row.status === 'new' || row.status === 'update' || row.status === 'unchanged') &&
      row.accountName &&
      lastIndexByName.get(row.accountName) !== i
    ) {
      row.status = 'skip';
      row.upsertCells = [];
      row.warnings.push('同じ科目名の後続行で上書きされます（この行は取込対象外）');
      duplicateNames.add(row.accountName);
    }
  });

  const cellsToWrite = previewRows
    .filter((r) => r.status === 'new' || r.status === 'update')
    .reduce((sum, r) => sum + r.upsertCells.length, 0);

  const summary = {
    totalRows: previewRows.length,
    accountsNew: previewRows.filter((r) => r.status === 'new').length,
    accountsUpdate: previewRows.filter((r) => r.status === 'update').length,
    accountsUnchanged: previewRows.filter((r) => r.status === 'unchanged').length,
    errorRows: previewRows.filter((r) => r.status === 'error').length,
    skipRows: previewRows.filter((r) => r.status === 'skip').length,
    cellsToWrite,
    duplicateNames: Array.from(duplicateNames),
  };

  return {
    meta: {
      storeId: ctx.storeId,
      storeName: ctx.storeName,
      fiscalYearLabel: ctx.fiscalYearLabel,
      monthColumns: ctx.monthColumns,
    },
    summary,
    rows: previewRows,
  };
}
