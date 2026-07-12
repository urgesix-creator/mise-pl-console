// ====================================================================
// 日次売上（統合）インポート 型定義（DB非依存・純粋）
//
//   サブステップ1（パース＋検証・ドライラン）専用の型。
//   - パーサ（integrated-import.ts）／検証／ドライランAction が共有する。
//   - 【厳守】この段階は読み取りのみ。INSERT/UPDATE/DELETE は一切行わない。
//   - 実書き込み（UPSERT）用の型は後続サブステップで別途定義する。
// ====================================================================

/** 行の判定。
 *  - new   : 既存レコードなし（新規取込候補）
 *  - update: 既存レコードあり（上書き候補。差分を提示）
 *  - error : 検証エラー（取込対象外。errors に理由）
 *  - skip  : 同一キーの後続行に上書きされる重複行（最後の行優先）
 */
export type ImportRowStatus = 'new' | 'update' | 'error' | 'skip';

/** 部門セルの扱い。
 *  - apply             : 反映候補（登録済み部門）
 *  - skip-unregistered : 未登録の部門名（列ごとスキップ・自動登録しない）
 */
export type DeptCellAction = 'apply' | 'skip-unregistered';

/** 差分（現在値 → 新値）。表示用。number / string / null を許容 */
export type DiffValue = number | string | null;
export type FieldDiff = { current: DiffValue; next: DiffValue };

// --------------------------------------------------------------------
// パーサ（DB非依存）の出力
// --------------------------------------------------------------------

/** パース段階で読み取った部門セル（名称はタグ除去済み・値は生文字列） */
export type ParsedDeptCell = {
  /** ヘッダーから取り出した部門名（【任意】等のタグ除去済み） */
  name: string;
  /** セルの生文字列（空は null） */
  rawValue: string | null;
};

/** パース段階の1データ行（検証・正規化前。すべて生文字列） */
export type ParsedRawRow = {
  /** Excel 上の実行番号（1始まり・エラー指摘用） */
  excelRow: number;
  storeName: string | null;
  storeId: string | null;
  businessDate: string | null;
  dayPeriod: string | null;
  netSales: string | null;
  grossSales: string | null;
  customerCount: string | null;
  weather: string | null;
  eventNote: string | null;
  departments: ParsedDeptCell[];
};

/** 見出しブロックから読み取ったメタ（表示用・任意） */
export type ParsedFileMeta = {
  periodFrom: string | null;
  periodTo: string | null;
  storeNameLabel: string | null;
  /** 見出しブロックから読み取ったファイルレベルの store_id（データ行には持たせない） */
  storeId: string | null;
};

/** パーサ parseIntegratedWorkbook の戻り値 */
export type ParseResult =
  | {
      ok: true;
      /** データ部ヘッダー行（「店舗名」で始まる行）の Excel 行番号 */
      headerExcelRow: number;
      /** 検出した部門列のヘッダー名（タグ除去済み・出現順） */
      deptHeaderNames: string[];
      rows: ParsedRawRow[];
      meta: ParsedFileMeta;
    }
  | { ok: false; error: string };

// --------------------------------------------------------------------
// 検証＋プレビュー（ドライラン）の出力
// --------------------------------------------------------------------

/** プレビュー：部門セル1つ分の判定 */
export type ImportPreviewDeptCell = {
  name: string;
  /** 逆引きできた department_id（未登録は null） */
  departmentId: string | null;
  /** 取り込む数値（空・無効・スキップは null） */
  gross: number | null;
  action: DeptCellAction;
  /** apply かつ数値があるときのみ。new/update */
  status?: 'new' | 'update';
  /** update のときのみ：現在値 → 新値 */
  diff?: FieldDiff;
};

/** プレビュー：経営データ（daily_sales）1行分の判定 */
export type ImportPreviewRow = {
  excelRow: number;
  status: ImportRowStatus;
  /** マッチングキー（store_id, business_date, day_period）。キー確定不能時は null */
  key: { storeId: string; businessDate: string; dayPeriod: string } | null;
  /** 取り込む値（正規化後。weather はコード変換後） */
  input: {
    netSales: number | null;
    grossSales: number | null;
    customerCount: number | null;
    weather: string | null;
    eventNote: string | null;
  };
  /** 既存 calculateSales による再計算（プレビュー表示用）。error 行は null */
  recalc: {
    netSales: number; // 保存する net_sales（込み=本体／別=記入round2）
    serviceFee: number;
    taxAmount: number;
    avgPerCustomer: number | null;
  } | null;
  /** update 行のみ：項目ごとの現在値→新値（service_fee/tax/客単価の再計算値含む） */
  diff: Record<string, FieldDiff> | null;
  departments: ImportPreviewDeptCell[];
  errors: string[];
  warnings: string[];
};

/** ドライランの最終出力（書き込みは一切しない） */
export type ImportPreview = {
  meta: {
    storeId: string;
    storeName: string;
    periodFrom: string | null;
    periodTo: string | null;
    deptHeaderNames: string[];
  };
  summary: {
    total: number;
    newCount: number;
    updateCount: number;
    errorCount: number;
    skipCount: number;
    /** ファイル全体で見つかった未登録部門名（一意） */
    skippedDepartments: string[];
    /** ファイル内で重複し、後続行に上書きされたキー（一意） */
    duplicateKeys: string[];
  };
  rows: ImportPreviewRow[];
};

/** ドライランAction の戻り値 */
export type DryRunResult =
  | { success: true; preview: ImportPreview }
  | { success: false; error: string };

// --------------------------------------------------------------------
// 実書き込み（取込実行）の出力
// --------------------------------------------------------------------

/** 取込実行の結果レポート（成功時） */
export type CommitReport = {
  /** daily_sales：新規書き込み件数 */
  salesNew: number;
  /** daily_sales：上書き件数 */
  salesUpdate: number;
  /** daily_department_sales：書き込んだ部門セル件数 */
  deptWritten: number;
  /** 取込対象外（重複等でスキップした行） */
  skippedRows: number;
  /** エラーで除外した行 */
  errorRows: number;
  /** 未登録でスキップした部門名（一意） */
  skippedDepartments: string[];
};

/** 取込実行Action の戻り値。
 *  失敗時 partial：どこまでコミットされたか（2テーブル非原子のため明示する）。 */
export type CommitResult =
  | { success: true; report: CommitReport }
  | {
      success: false;
      error: string;
      partial?: { salesCommitted: boolean; deptCommitted: boolean };
    };
