'use server';

// ====================================================================
// 月次PL（損益）エクスポート Server Action（読み取り専用・ExcelJS）
//
//   - クライアント（画面に表示中の値）から行データ（PlExportRow[]）＋メタを受け取り、
//     純粋関数 buildPlWorkbook で Workbook を生成し base64 で返す。
//   - 【方針A】画面の値をそのまま出力するため、ここでは DB を一切読まない・書かない。
//     lib/pl の再計算も行わない（forecast はクライアントが保持済みの表示値を使う）。
//   - 認証済み・有効ユーザーのみ（PL画面を閲覧できる全ロール／出力は読み取り専用）。
//   - 税計算（§8.1）・経営データ・他テーブルには触れない。DB書き込みは増えない。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { sanitizeFilenamePart } from '@/lib/xlsx-utils';
import { buildPlWorkbook, type PlExportRow, type PlExportMeta } from './pl-export';

export type ExportPlInput = {
  rows: PlExportRow[];
  meta: PlExportMeta;
};

export type ExportPlResult =
  | { success: true; filename: string; base64Xlsx: string }
  | { success: false; error: string };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildPlFilename(storeName: string, fiscalYearLabel: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `PL_${sanitizeFilenamePart(storeName)}_${sanitizeFilenamePart(fiscalYearLabel)}_${stamp}.xlsx`;
}

/** 軽量な形状ガード（クライアント入力の最低限の検証。書き込みは無いので過剰検証はしない） */
function isValidInput(input: ExportPlInput): boolean {
  if (!input || typeof input !== 'object') return false;
  const { rows, meta } = input;
  if (!Array.isArray(rows) || !meta || typeof meta !== 'object') return false;
  if (typeof meta.storeName !== 'string' || !Array.isArray(meta.monthLabels)) return false;
  if (meta.monthLabels.length === 0 || meta.monthLabels.length > 24) return false;
  if (rows.length > 200) return false; // 暴走ガード
  return rows.every(
    (r) => r && typeof r.label === 'string' && Array.isArray(r.values),
  );
}

/**
 * 月次PL を Excel(.xlsx) としてエクスポートする（読み取り専用・DB非依存）。
 * 画面に表示中の行データをそのまま受け取り、Workbook を base64 で返す。
 */
export async function exportMonthlyPl(input: ExportPlInput): Promise<ExportPlResult> {
  // 認証チェックのみ（PL閲覧者なら出力可・読み取り専用）。DB への書き込み・読取はしない。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '認証が必要です' };

  if (!isValidInput(input)) {
    return { success: false, error: '出力データの形式が正しくありません' };
  }

  try {
    // 出力日時はサーバ側で確定（クライアント時計に依存しない）
    const now = new Date();
    const generatedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const wb = buildPlWorkbook(input.rows, { ...input.meta, generatedAt });
    const buf = await wb.xlsx.writeBuffer();
    const base64Xlsx = Buffer.from(buf as ArrayBuffer).toString('base64');
    return {
      success: true,
      filename: buildPlFilename(input.meta.storeName, input.meta.fiscalYearLabel),
      base64Xlsx,
    };
  } catch (e) {
    return {
      success: false,
      error: `Excelの生成に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
