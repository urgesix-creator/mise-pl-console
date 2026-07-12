'use server';

// ====================================================================
// 仕入先・仕入カテゴリ 一括取込 Server Actions（初期設定ページ専用）
//
//   - downloadSupplierTemplate(): 記入用テンプレ(.xlsx)を base64 で返す。
//   - dryRunSupplierImport(formData): 認証/権限/parse/DB照合 → プレビュー（書込なし）。
//   - commitSupplierImport(formData): 書込直前に再parse/再検証し、有効行のみを
//       purchase_categories / suppliers へ「店舗×名称」で手動UPSERT（無ければ作成・
//       あれば再利用かつ is_active=true・物理削除なし）。
//
//   【権限】ページ＝manage_initial_setup。実テーブル書込は createClient(RLS) のため
//   suppliers/purchase_categories の書込RLS（store_master＋can_access_store）が最終防衛線。
// ====================================================================

import { revalidatePath } from 'next/cache';
import { Workbook } from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { roleHasCapability } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/server';
import {
  parseSupplierWorkbook,
  SUPPLIER_TEMPLATE_HEADERS,
  type CostType,
  type SupplierParseError,
} from './supplier-import';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type SupplierPreviewRow = {
  row: number;
  categoryName: string;
  supplierName: string;
  costType: CostType;
  taxRate: number | null; // %（null=店舗標準/既存維持）
  isTaxExempt: boolean | null; // null=未指定（既存維持／新規false）
  status: 'new' | 'update'; // 仕入先が新規 or 既存更新
  categoryNew: boolean; // カテゴリを新規作成するか
};

export type SupplierImportPreview = {
  rows: SupplierPreviewRow[];
  errors: SupplierParseError[];
  counts: {
    valid: number;
    newSuppliers: number;
    updateSuppliers: number;
    newCategories: number;
    errors: number;
  };
};

export type SupplierDryRunResult =
  | { ok: true; preview: SupplierImportPreview }
  | { ok: false; error: string };

export type SupplierCommitResult =
  | { ok: true; createdSuppliers: number; updatedSuppliers: number; createdCategories: number }
  | { ok: false; error: string };

async function ensureCanManage(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '認証が必要です' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { ok: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'manage_initial_setup'))) {
    return { ok: false, error: '初期設定の権限がありません' };
  }
  return { ok: true };
}

/** 記入用テンプレート（.xlsx）を base64 で返す */
export async function downloadSupplierTemplate(): Promise<
  { ok: true; base64: string } | { ok: false; error: string }
> {
  const guard = await ensureCanManage();
  if (!guard.ok) return { ok: false, error: guard.error };

  const wb = new Workbook();
  const ws = wb.addWorksheet('仕入先');
  ws.addRow(SUPPLIER_TEMPLATE_HEADERS);
  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 24 }, { width: 28 }, { width: 40 }, { width: 22 }, { width: 30 }];
  // 記入例（任意・削除して使ってよい）。D=税率(%・空欄＝店舗標準) / E=非課税(1/はい/非課税＝ON)
  ws.addRow(['食材', '〇〇青果', 'cogs', '', '']); // 税率空欄＝店舗標準を適用
  ws.addRow(['酒類', '△△酒店', 'cogs', 11, '']); // 税率を明示（11%）
  ws.addRow(['備品・消耗品', '□□商店', 'sga', '', '非課税']); // 非課税（税0・税込＝税抜）

  const buf = await wb.xlsx.writeBuffer();
  return { ok: true, base64: Buffer.from(buf as ArrayBuffer).toString('base64') };
}

type StoreClient = Awaited<ReturnType<typeof createClient>>;

/** parse ＋ DB照合（store内の既存カテゴリ/仕入先と突合）してプレビューを返す */
async function buildPreview(
  supabase: StoreClient,
  storeId: string,
  buffer: ArrayBuffer,
): Promise<{ ok: true; preview: SupplierImportPreview } | { ok: false; error: string }> {
  const parsed = await parseSupplierWorkbook(buffer);

  const { data: cats } = await supabase
    .from('purchase_categories')
    .select('name')
    .eq('store_id', storeId);
  const existingCats = new Set((cats ?? []).map((c) => c.name));

  const { data: sups } = await supabase
    .from('suppliers')
    .select('name')
    .eq('store_id', storeId);
  const existingSups = new Set((sups ?? []).map((s) => s.name));

  const newCatNames = new Set<string>();
  const rows: SupplierPreviewRow[] = parsed.rows.map((r) => {
    const categoryNew = !existingCats.has(r.categoryName) && !newCatNames.has(r.categoryName);
    if (!existingCats.has(r.categoryName)) newCatNames.add(r.categoryName);
    const status: 'new' | 'update' = existingSups.has(r.supplierName) ? 'update' : 'new';
    return {
      row: r.row,
      categoryName: r.categoryName,
      supplierName: r.supplierName,
      costType: r.costType,
      taxRate: r.taxRate,
      isTaxExempt: r.isTaxExempt,
      status,
      categoryNew,
    };
  });

  const preview: SupplierImportPreview = {
    rows,
    errors: parsed.errors,
    counts: {
      valid: rows.length,
      newSuppliers: rows.filter((r) => r.status === 'new').length,
      updateSuppliers: rows.filter((r) => r.status === 'update').length,
      newCategories: newCatNames.size,
      errors: parsed.errors.length,
    },
  };
  return { ok: true, preview };
}

async function readInput(
  formData: FormData,
): Promise<{ ok: true; storeId: string; buffer: ArrayBuffer } | { ok: false; error: string }> {
  const storeId = formData.get('storeId');
  if (typeof storeId !== 'string' || !UUID_PATTERN.test(storeId)) {
    return { ok: false, error: '取込先の店舗を指定してください' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'ファイルが選択されていません' };
  }
  return { ok: true, storeId, buffer: await file.arrayBuffer() };
}

export async function dryRunSupplierImport(formData: FormData): Promise<SupplierDryRunResult> {
  const guard = await ensureCanManage();
  if (!guard.ok) return { ok: false, error: guard.error };

  const input = await readInput(formData);
  if (!input.ok) return { ok: false, error: input.error };

  const supabase = await createClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, is_active')
    .eq('id', input.storeId)
    .maybeSingle();
  if (!store) return { ok: false, error: '店舗が見つかりません' };
  if (!store.is_active) return { ok: false, error: 'この店舗は無効化されています' };

  return buildPreview(supabase, input.storeId, input.buffer);
}

export async function commitSupplierImport(formData: FormData): Promise<SupplierCommitResult> {
  const guard = await ensureCanManage();
  if (!guard.ok) return { ok: false, error: guard.error };

  const input = await readInput(formData);
  if (!input.ok) return { ok: false, error: input.error };

  const supabase = await createClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, is_active')
    .eq('id', input.storeId)
    .maybeSingle();
  if (!store) return { ok: false, error: '店舗が見つかりません' };
  if (!store.is_active) return { ok: false, error: 'この店舗は無効化されています' };

  // 書込直前に再parse/再検証（クライアント値は信用しない）
  const parsed = await parseSupplierWorkbook(input.buffer);
  if (parsed.rows.length === 0) {
    return { ok: false, error: '取込可能な行がありません（エラー行のみ、または空ファイル）' };
  }

  const storeId = input.storeId;

  // --- 1. カテゴリを「店舗×名称」で手動UPSERT（無ければ作成・あれば再利用＆有効化） ---
  const { data: existingCats } = await supabase
    .from('purchase_categories')
    .select('id, name, is_active, display_order')
    .eq('store_id', storeId);
  const catByName = new Map<string, { id: string; is_active: boolean }>();
  let catMaxOrder = 0;
  for (const c of existingCats ?? []) {
    catByName.set(c.name, { id: c.id, is_active: c.is_active });
    if (c.display_order > catMaxOrder) catMaxOrder = c.display_order;
  }

  const categoryIdByName = new Map<string, string>();
  let createdCategories = 0;
  const uniqueCatNames = [...new Set(parsed.rows.map((r) => r.categoryName))];
  for (const name of uniqueCatNames) {
    const existing = catByName.get(name);
    if (existing) {
      categoryIdByName.set(name, existing.id);
      if (!existing.is_active) {
        const { error } = await supabase
          .from('purchase_categories')
          .update({ is_active: true })
          .eq('id', existing.id);
        if (error) return { ok: false, error: `カテゴリの有効化に失敗（${name}）: ${error.message}` };
      }
    } else {
      catMaxOrder += 1;
      const { data: inserted, error } = await supabase
        .from('purchase_categories')
        .insert({ store_id: storeId, name, display_order: catMaxOrder, is_active: true })
        .select('id')
        .single();
      if (error || !inserted) {
        return { ok: false, error: `カテゴリ作成に失敗（${name}）: ${error?.message ?? 'unknown'}` };
      }
      categoryIdByName.set(name, inserted.id);
      createdCategories += 1;
    }
  }

  // 店舗標準の仕入税率（新規仕入先で税率列が空欄のときの既定）
  const { data: storeRow } = await supabase
    .from('stores')
    .select('purchase_tax_rate_default')
    .eq('id', storeId)
    .maybeSingle();
  const storeStandardRate = Number(storeRow?.purchase_tax_rate_default ?? 0);

  // --- 2. 仕入先を「店舗×名称」で手動UPSERT（category_id 紐付け・cost_type・税率/非課税 反映） ---
  const { data: existingSups } = await supabase
    .from('suppliers')
    .select('id, name, display_order')
    .eq('store_id', storeId);
  const supByName = new Map<string, string>();
  let supMaxOrder = 0;
  for (const s of existingSups ?? []) {
    supByName.set(s.name, s.id);
    if (s.display_order > supMaxOrder) supMaxOrder = s.display_order;
  }

  let createdSuppliers = 0;
  let updatedSuppliers = 0;
  for (const r of parsed.rows) {
    const categoryId = categoryIdByName.get(r.categoryName);
    if (!categoryId) return { ok: false, error: `内部エラー：カテゴリIDが解決できません（${r.categoryName}）` };

    const existingId = supByName.get(r.supplierName);
    if (existingId) {
      // 既存更新：税率/非課税は「明示された列のみ」上書き（空欄＝未指定は既存値を維持＝後方互換）
      const update: Database['public']['Tables']['suppliers']['Update'] = {
        category_id: categoryId,
        cost_type: r.costType,
        is_active: true,
      };
      if (r.taxRate !== null) update.tax_rate = r.taxRate;
      if (r.isTaxExempt !== null) update.is_tax_exempt = r.isTaxExempt;
      const { error } = await supabase.from('suppliers').update(update).eq('id', existingId);
      if (error) return { ok: false, error: `仕入先の更新に失敗（${r.supplierName}）: ${error.message}` };
      updatedSuppliers += 1;
    } else {
      // 新規：税率列が空欄なら店舗標準・非課税は未指定なら false
      supMaxOrder += 1;
      const { error } = await supabase.from('suppliers').insert({
        store_id: storeId,
        category_id: categoryId,
        name: r.supplierName,
        cost_type: r.costType,
        tax_rate: r.taxRate ?? storeStandardRate,
        is_tax_exempt: r.isTaxExempt ?? false,
        display_order: supMaxOrder,
        is_active: true,
      });
      if (error) return { ok: false, error: `仕入先の作成に失敗（${r.supplierName}）: ${error.message}` };
      createdSuppliers += 1;
      supByName.set(r.supplierName, 'inserted'); // 同名の二重作成を防止
    }
  }

  await logAudit({
    action: 'initial_setup.import',
    targetType: 'suppliers',
    targetLabel: storeId,
    details: { createdSuppliers, updatedSuppliers, createdCategories },
  });

  revalidatePath('/admin/initial-setup');
  revalidatePath('/masters/suppliers');
  revalidatePath('/masters/categories');
  return { ok: true, createdSuppliers, updatedSuppliers, createdCategories };
}
