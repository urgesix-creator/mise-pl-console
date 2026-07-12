'use server';

// ====================================================================
// 月次PL 販管費テンプレート エクスポート Server Action（読み取り専用・ExcelJS）
//
//   - 店舗・決算期（fyStartYear）を受け取り、既存 monthly_expenses を読んで
//     記入済みテンプレートを生成（buildExpenseTemplateWorkbook）→ base64 で返す。
//   - 【厳守】読み取りのみ。monthly_expenses へ INSERT/UPDATE/DELETE は一切しない。
//   - 権限：can_write（店長以上＋staff・販管費手入力と一致）。
//   - lib/pl は使わない・税計算/経営データ/他テーブルには触れない。
// ====================================================================

import { sanitizeFilenamePart } from '@/lib/xlsx-utils';
import { ensureCanWriteForStore, buildFiscalMonthColumns } from './expense-auth';
import {
  buildExpenseTemplateWorkbook,
  type ExpenseTemplateRow,
} from './expense-export';
import type { CategoryTag } from './expense-constants';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type ExportExpenseResult =
  | { success: true; filename: string; base64Xlsx: string; accountCount: number }
  | { success: false; error: string };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildFilename(storeName: string, fiscalYearLabel: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `販管費テンプレート_${sanitizeFilenamePart(storeName)}_${sanitizeFilenamePart(fiscalYearLabel)}_${stamp}.xlsx`;
}

type RawExpenseRow = {
  account_name: string;
  category_tag: CategoryTag;
  year_month: string;
  amount: number | string;
  display_order: number | string;
};

/**
 * 販管費テンプレート（記入済み）を Excel(.xlsx) としてエクスポートする（読み取り専用）。
 */
export async function exportExpenseTemplate(
  storeId: string,
  fyStartYear: number,
  currencyCode: string,
): Promise<ExportExpenseResult> {
  if (!storeId || !UUID_PATTERN.test(storeId)) {
    return { success: false, error: '店舗を指定してください' };
  }
  if (!Number.isInteger(fyStartYear) || fyStartYear < 2000 || fyStartYear > 2100) {
    return { success: false, error: '決算期（年度）が不正です' };
  }

  const auth = await ensureCanWriteForStore(storeId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase, store } = auth;

  // 決算期の12ヶ月（'YYYY-MM'）と月初DATE
  const monthColumns = buildFiscalMonthColumns(fyStartYear, store.fiscal_year_start_month);
  const monthStarts = monthColumns.map((ym) => `${ym}-01`);

  // 既存販管費を読み込み（読み取りのみ・RLS適用）
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('account_name, category_tag, year_month, amount, display_order')
    .eq('store_id', storeId)
    .in('year_month', monthStarts);
  if (error) {
    return { success: false, error: `販管費の取得に失敗しました: ${error.message}` };
  }

  // 科目（account_name）ごとに集約
  const byAccount = new Map<string, ExpenseTemplateRow>();
  for (const r of (data ?? []) as RawExpenseRow[]) {
    let row = byAccount.get(r.account_name);
    if (!row) {
      row = {
        account_name: r.account_name,
        category_tag: r.category_tag,
        amounts: {},
        display_order: Number(r.display_order),
      };
      byAccount.set(r.account_name, row);
    }
    row.category_tag = r.category_tag;
    row.display_order = Number(r.display_order);
    row.amounts[r.year_month.slice(0, 7)] = Number(r.amount);
  }
  const rows = [...byAccount.values()].sort(
    (a, b) => a.display_order - b.display_order || a.account_name.localeCompare(b.account_name, 'ja'),
  );

  const fiscalYearLabel = `${fyStartYear}年度`;
  const wb = buildExpenseTemplateWorkbook(rows, {
    storeName: store.name,
    storeId,
    fiscalYearLabel,
    monthColumns,
    currencyCode: currencyCode || '',
  });
  const buf = await wb.xlsx.writeBuffer();
  const base64Xlsx = Buffer.from(buf as ArrayBuffer).toString('base64');

  return {
    success: true,
    filename: buildFilename(store.name, fiscalYearLabel),
    base64Xlsx,
    accountCount: rows.length,
  };
}
