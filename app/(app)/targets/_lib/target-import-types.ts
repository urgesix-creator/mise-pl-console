// ====================================================================
// 売上予算（日次目標）インポート 型定義（DB非依存・純粋）
//   日次売上の統合インポート型を、予算用に簡素化（部門・税計算・客数なし）。
// ====================================================================

/** 行の判定。new=新規 / update=上書き / error=検証エラー / skip=同一キー後続行に上書き */
export type TargetRowStatus = 'new' | 'update' | 'error' | 'skip';

/** パース段階の1データ行（検証前・生文字列） */
export type ParsedTargetRow = {
  excelRow: number;
  storeId: string | null; // 見出しブロックから付与（行には持たせない）
  targetDate: string | null;
  targetSales: string | null;
};

export type ParsedTargetMeta = {
  periodFrom: string | null;
  periodTo: string | null;
  storeNameLabel: string | null;
  storeId: string | null;
};

export type ParseTargetResult =
  | { ok: true; headerExcelRow: number; rows: ParsedTargetRow[]; meta: ParsedTargetMeta }
  | { ok: false; error: string };

/** プレビュー：予算1行分の判定 */
export type TargetPreviewRow = {
  excelRow: number;
  status: TargetRowStatus;
  key: { storeId: string; targetDate: string } | null;
  /** 取り込む値（空欄は 0 に正規化済み） */
  targetSales: number | null;
  /** update のみ：現在値 → 新値 */
  diff: { current: number; next: number } | null;
  errors: string[];
  warnings: string[];
};

export type TargetImportPreview = {
  meta: {
    storeId: string;
    storeName: string;
    periodFrom: string | null;
    periodTo: string | null;
  };
  summary: {
    total: number;
    newCount: number;
    updateCount: number;
    errorCount: number;
    skipCount: number;
    duplicateKeys: string[];
  };
  rows: TargetPreviewRow[];
};

export type TargetDryRunResult =
  | { success: true; preview: TargetImportPreview }
  | { success: false; error: string };

export type TargetCommitReport = {
  inserted: number; // 新規
  updated: number; // 上書き
  skippedRows: number;
  errorRows: number;
};

export type TargetCommitResult =
  | { success: true; report: TargetCommitReport }
  | { success: false; error: string };
