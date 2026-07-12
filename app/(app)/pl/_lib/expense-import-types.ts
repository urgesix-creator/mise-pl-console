// ====================================================================
// 月次PL 販管費（monthly_expenses）Excelインポート 型定義（DB非依存・純粋）
//
//   - 売上予算（targets/_lib/target-import-types.ts）の型を、販管費グリッド用に拡張。
//   - 1データ行＝1科目（科目名・区分・12ヶ月の金額）。UPSERTキーはセル単位
//     (store_id, year_month, account_name)。空欄の月は取り込まない（スキップ）。
// ====================================================================

import type { CategoryTag } from './expense-constants';

/** 科目行の判定。new=新規科目 / update=既存科目に変更あり / unchanged=変更なし
 *  / error=検証エラー / skip=取込対象なし（金額空・同名後続行に集約） */
export type ExpenseRowStatus = 'new' | 'update' | 'unchanged' | 'error' | 'skip';

/** パース段階の1セル（検証前・生文字列） */
export type ParsedExpenseCell = {
  /** 'YYYY-MM'（列ヘッダー由来） */
  yearMonth: string;
  /** セルの生文字列（空欄は null） */
  raw: string | null;
};

/** パース段階の1データ行＝1科目（検証前・生文字列） */
export type ParsedExpenseRow = {
  excelRow: number;
  accountName: string | null;
  /** 区分の生値（日本語ラベル or 内部値・検証前） */
  categoryRaw: string | null;
  cells: ParsedExpenseCell[];
};

export type ParsedExpenseMeta = {
  storeNameLabel: string | null;
  storeId: string | null;
  fiscalYearLabel: string | null;
  /** 月列（'YYYY-MM'・ファイル出現順） */
  monthColumns: string[];
};

export type ParseExpenseResult =
  | { ok: true; headerExcelRow: number; rows: ParsedExpenseRow[]; meta: ParsedExpenseMeta }
  | { ok: false; error: string };

/** 取り込む1セルの変更内容 */
export type ExpenseCellChange = {
  yearMonth: string;
  /** 取り込む値（非負・検証済み） */
  next: number;
  /** 既存値（無ければ null） */
  current: number | null;
  /** 既存と異なるか（新規月は true） */
  changed: boolean;
};

/** プレビュー：科目1行分の判定 */
export type ExpensePreviewRow = {
  excelRow: number;
  status: ExpenseRowStatus;
  /** 正規化済みの科目名（error/skip では null の場合あり） */
  accountName: string | null;
  /** 検証済みの区分（error では null の場合あり） */
  categoryTag: CategoryTag | null;
  /** 取り込む（非空・検証済み）セルのみ。空欄の月は含めない（スキップ） */
  upsertCells: ExpenseCellChange[];
  errors: string[];
  warnings: string[];
};

export type ExpenseImportPreview = {
  meta: {
    storeId: string;
    storeName: string;
    fiscalYearLabel: string | null;
    monthColumns: string[];
  };
  summary: {
    totalRows: number;
    accountsNew: number;
    accountsUpdate: number;
    accountsUnchanged: number;
    errorRows: number;
    skipRows: number;
    /** UPSERT するセル総数（new+update の upsertCells 合計） */
    cellsToWrite: number;
    duplicateNames: string[];
  };
  rows: ExpensePreviewRow[];
};

export type ExpenseDryRunResult =
  | { success: true; preview: ExpenseImportPreview }
  | { success: false; error: string };

export type ExpenseCommitReport = {
  accountsNew: number;
  accountsUpdate: number;
  cellsWritten: number;
  skippedRows: number;
  errorRows: number;
};

export type ExpenseCommitResult =
  | { success: true; report: ExpenseCommitReport }
  | { success: false; error: string };
