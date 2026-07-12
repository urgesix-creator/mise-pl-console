'use server';

// ====================================================================
// 店舗別 期間集計 エクスポート Server Action（読み取り専用・ExcelJS）
//
//   - クライアント（画面に表示中の値）から行データ＋合計＋メタを受け取り、純粋関数
//     buildPeriodSummaryWorkbook で Workbook を生成し base64 で返す。
//   - 【方針】画面の値をそのまま出力するため DB を一切読まない・書かない・再計算しない
//     （getPeriodSummary の返り値＝画面の集計結果をそのまま使い、完全一致を保証）。
//   - 認証済みユーザーのみ（期間集計を閲覧できる全ロール／出力は読み取り専用）。
//   - 税計算（§8.1）・経営データ・他テーブル・既存のExcel出力には触れない。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { sanitizeFilenamePart } from '@/lib/xlsx-utils';
import {
  buildPeriodSummaryWorkbook,
  type PeriodExportRow,
  type PeriodExportTotal,
  type PeriodExportMeta,
} from './period-export';

export type ExportPeriodInput = {
  rows: PeriodExportRow[];
  total: PeriodExportTotal | null;
  meta: Omit<PeriodExportMeta, 'generatedAt'>;
};

export type ExportPeriodResult =
  | { success: true; filename: string; base64Xlsx: string }
  | { success: false; error: string };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 期間集計_[グループ名_]YYYYMMDD-YYYYMMDD[_円換算].xlsx */
function buildFilename(meta: Omit<PeriodExportMeta, 'generatedAt'>): string {
  const ymd = (iso: string) => iso.replace(/-/g, '');
  let name = '期間集計';
  if (meta.groupName && meta.groupName !== '全店舗') {
    name += `_${sanitizeFilenamePart(meta.groupName)}`;
  }
  name += `_${ymd(meta.start)}-${ymd(meta.end)}`;
  if (meta.currencyMode === 'jpy') name += '_円換算';
  return `${name}.xlsx`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 軽量な形状ガード（書き込みは無いので過剰検証はしない・暴走ガードのみ） */
function isValidInput(input: ExportPeriodInput): boolean {
  if (!input || typeof input !== 'object') return false;
  const { rows, meta } = input;
  if (!Array.isArray(rows) || rows.length > 500) return false;
  if (!meta || typeof meta !== 'object') return false;
  if (!DATE_PATTERN.test(meta.start) || !DATE_PATTERN.test(meta.end)) return false;
  if (meta.currencyMode !== 'local' && meta.currencyMode !== 'jpy') return false;
  if (typeof meta.groupName !== 'string') return false;
  return rows.every((r) => r && typeof r.name === 'string' && typeof r.storeNo === 'number');
}

export async function exportPeriodSummary(input: ExportPeriodInput): Promise<ExportPeriodResult> {
  // 認証チェックのみ（閲覧者なら出力可・読み取り専用）。DB への読取／書込はしない。
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
    const wb = buildPeriodSummaryWorkbook(input.rows, input.total, {
      ...input.meta,
      generatedAt,
    });
    const buf = await wb.xlsx.writeBuffer();
    const base64Xlsx = Buffer.from(buf as ArrayBuffer).toString('base64');
    return { success: true, filename: buildFilename(input.meta), base64Xlsx };
  } catch (e) {
    return {
      success: false,
      error: `Excelの生成に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
