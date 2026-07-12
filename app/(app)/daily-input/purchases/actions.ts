'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { computePurchaseTax, isIntegerCurrency, type PurchaseTaxMode } from '@/lib/purchases/tax';
import {
  upsertDailyPurchasesSchema,
  upsertInventorySchema,
  type UpsertDailyPurchasesInput,
  type UpsertInventoryInput,
} from './_schemas';

// ====================================================================
// 日次仕入（daily_purchases）の取得・保存 Server Action
//
// - 仕入先別の金額を (store_id, business_date, supplier_id) で UPSERT（常に上書き）。
// - 空欄は 0 として保存する。DELETE は一切行わない（訂正は上書きで実現）。
// - 経営売上（daily_sales）・税計算（§8.1）には一切アクセスしない（別経路）。
// - 既存の suppliers / daily_purchases の構造は変更しない。
// ====================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type SupplierOption = {
  id: string;
  name: string;
  category_id: string;
  display_order: number;
  is_active: boolean;
  tax_rate: number; // 仕入税率(%)・自動適用
  is_tax_exempt: boolean; // 非課税
};

export type PurchaseCategoryOption = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

function translateDbError(error: { code?: string; message: string }): string {
  if (error.code === '23503') return '参照先の仕入先または店舗が見つかりません';
  if (error.code === '23514') return '入力値が制約に違反しています';
  if (error.code === '42501') return '権限がありません';
  return `処理に失敗しました: ${error.message}`;
}

async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, country_id, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return null;
  return profile;
}

/**
 * 仕入の書き込み可否をサーバー側で事前検証（最終防衛線は RLS）。
 * 権限は daily_sales と同一（WRITE_ROLES＝売上を入力できる人。staff も可）。
 */
async function ensureCanWriteForStore(
  storeId: string,
): Promise<{ success: false; error: string } | null> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: '認証が必要です' };

  const supabase = await createClient();
  // 仕入入力は daily_input または daily_purchase_input（仕入のみ権限）で許可
  const canWrite =
    (await roleHasCapability(supabase, profile.role, 'daily_input')) ||
    (await roleHasCapability(supabase, profile.role, 'daily_purchase_input'));
  if (!canWrite) {
    return { success: false, error: '仕入の入力権限がありません' };
  }
  const { data: store } = await supabase
    .from('stores')
    .select('id, country_id, is_active')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return { success: false, error: '店舗が見つかりません' };
  if (!store.is_active) return { success: false, error: 'この店舗は無効化されています' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { success: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager' || profile.role === 'staff') {
    const { data: assignment } = await supabase
      .from('user_store_assignments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!assignment) return { success: false, error: '担当店舗外です' };
  }
  return null;
}

/**
 * 店舗の仕入先・仕入カテゴリを取得する（RLS で参照可能店舗に絞られる）。
 * - 仕入先：全件（is_active 含む）。無効仕入先でも既存データの表示に必要なため。
 * - 並び順はクライアントで（カテゴリ display_order → 仕入先 display_order）整列する。
 */
export async function getSuppliersAndCategories(
  storeId: string,
): Promise<{ suppliers: SupplierOption[]; categories: PurchaseCategoryOption[] }> {
  const profile = await getCurrentProfile();
  if (!profile) return { suppliers: [], categories: [] };

  const supabase = await createClient();
  const [suppliersResult, categoriesResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, category_id, display_order, is_active, tax_rate, is_tax_exempt')
      .eq('store_id', storeId)
      .order('display_order'),
    supabase
      .from('purchase_categories')
      .select('id, name, display_order, is_active')
      .eq('store_id', storeId)
      .order('display_order'),
  ]);

  return {
    suppliers: suppliersResult.data ?? [],
    categories: categoriesResult.data ?? [],
  };
}

/**
 * 指定店舗・営業日の既存仕入を取得し、supplier_id → { net, gross } のマップで返す（画面初期値）。
 * 入力モード（税抜/税込）に応じて画面側が net か gross を初期表示に使う。
 */
export async function getDailyPurchasesByKey(
  storeId: string,
  businessDate: string,
): Promise<Record<string, { net: number; gross: number }>> {
  const profile = await getCurrentProfile();
  if (!profile) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_purchases')
    .select('supplier_id, net_amount, gross_amount')
    .eq('store_id', storeId)
    .eq('business_date', businessDate);

  if (error || !data) return {};
  return data.reduce<Record<string, { net: number; gross: number }>>((acc, row) => {
    acc[row.supplier_id] = { net: Number(row.net_amount), gross: Number(row.gross_amount) };
    return acc;
  }, {});
}

/**
 * 日次仕入を UPSERT 保存する。
 *
 * - 表示中の全仕入先を保存対象とし、空欄（amount 未入力）は 0 として保存する。
 * - DELETE は一切行わない（訂正は上書きで実現＝この画面を (store,date) の権威とする）。
 * - 入力対象の supplier_id が当該店舗の仕入先であることを検証（他店仕入先の混入を防止）。
 * - daily_sales（経営売上）には一切アクセスしない。
 *
 * @returns 保存件数（data.saved）と、保存後の各仕入先の権威値（data.rows）。
 *   クライアントは data.rows で表示を確定し、再読込のタイミングに依存せず「保存→消える」を防ぐ。
 */
export async function upsertDailyPurchases(
  input: UpsertDailyPurchasesInput,
): Promise<ActionResult<{ saved: number; rows: { supplier_id: string; net: number; gross: number }[] }>> {
  const parsed = upsertDailyPurchasesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  const supabase = await createClient();

  // 当該店舗の仕入先（税率・非課税）と、店舗の入力モード・通貨を取得。
  // 税率は「取引先マスタが一元管理」＝サーバ側で確定（クライアント値は採用しない＝手動上書き不可）。
  const [{ data: suppliers, error: supError }, { data: store, error: storeError }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, tax_rate, is_tax_exempt')
      .eq('store_id', parsed.data.store_id),
    supabase
      .from('stores')
      .select('purchase_tax_input_mode, currency_id')
      .eq('id', parsed.data.store_id)
      .maybeSingle(),
  ]);
  if (supError) return { success: false, error: translateDbError(supError) };
  if (storeError || !store) return { success: false, error: '店舗情報の取得に失敗しました' };

  const supplierById = new Map(
    (suppliers ?? []).map((s) => [
      s.id,
      { taxRate: Number(s.tax_rate ?? 0), isExempt: !!s.is_tax_exempt },
    ]),
  );
  const mode = (store.purchase_tax_input_mode as PurchaseTaxMode) ?? 'excluded';
  const integerCurrency = isIntegerCurrency(store.currency_id);

  // 表示中の全仕入先を保存対象に。入力値（モードに応じ net か gross）から net/tax/gross を整合算出。
  // 空欄（null/undefined）は 0 として保存する（DELETEしない・スナップショット）。
  const rows: Array<{
    store_id: string;
    business_date: string;
    supplier_id: string;
    amount: number;
    net_amount: number;
    tax_amount: number;
    gross_amount: number;
  }> = [];
  for (const entry of parsed.data.entries) {
    const sup = supplierById.get(entry.supplier_id);
    if (!sup) {
      return { success: false, error: 'この店舗に属さない仕入先が含まれています' };
    }
    const { net, tax, gross } = computePurchaseTax({
      input: entry.amount ?? 0,
      mode,
      ratePercent: sup.taxRate,
      isExempt: sup.isExempt,
      integerCurrency,
    });
    rows.push({
      store_id: parsed.data.store_id,
      business_date: parsed.data.business_date,
      supplier_id: entry.supplier_id,
      amount: net, // 後方互換：amount は常に net と同値
      net_amount: net,
      tax_amount: tax,
      gross_amount: gross,
    });
  }

  if (rows.length === 0) {
    return { success: true, data: { saved: 0, rows: [] } };
  }

  const { data: saved, error: upsertError } = await supabase
    .from('daily_purchases')
    .upsert(rows, { onConflict: 'store_id,business_date,supplier_id' })
    .select('supplier_id, net_amount, gross_amount');

  if (upsertError) return { success: false, error: translateDbError(upsertError) };

  // 保存後の権威値（DBが返した実値）を返す。クライアントはこれで表示を確定する。
  const savedRows = (saved ?? []).map((r) => ({
    supplier_id: r.supplier_id as string,
    net: Number(r.net_amount),
    gross: Number(r.gross_amount),
  }));

  revalidatePath('/daily-input/purchases');
  return { success: true, data: { saved: rows.length, rows: savedRows } };
}

/**
 * 店舗の仕入入力モード（税抜/税込）を更新する（店舗単位で共有・全ユーザー/全端末で共通）。
 * 仕入の入力権限（daily_input or daily_purchase_input）と当該店舗アクセスを検証。
 * stores の更新RLSは exec_master 想定のため、権限確認後に管理クライアントで該当列のみ更新。
 */
export async function setPurchaseTaxInputMode(
  storeId: string,
  mode: PurchaseTaxMode,
): Promise<ActionResult> {
  if (mode !== 'excluded' && mode !== 'included') {
    return { success: false, error: '入力モードが不正です' };
  }
  const denied = await ensureCanWriteForStore(storeId);
  if (denied) return denied;

  const admin = createAdminClient();
  const { error } = await admin
    .from('stores')
    .update({ purchase_tax_input_mode: mode })
    .eq('id', storeId);
  if (error) return { success: false, error: `入力モードの保存に失敗しました: ${error.message}` };

  revalidatePath('/daily-input/purchases');
  return { success: true };
}

// ====================================================================
// 棚卸し（在庫）の取得・保存 Server Action
//
// - inventory_estimates（011で履歴化）を店舗×営業日で1値保持。
// - 仕入の保存（upsertDailyPurchases）とは独立した経路。互いに影響しない。
// - 空欄は記録を作らない（仕入の「空欄=0」とは逆）。DELETE は一切行わない。
// - daily_sales（経営売上）・税計算には一切アクセスしない。
// ====================================================================

export type InventorySnapshot = {
  business_date: string;
  amount: number;
};

/** 指定店舗・営業日の在庫合計額を取得（無ければ null） */
export async function getInventoryByKey(
  storeId: string,
  businessDate: string,
): Promise<number | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inventory_estimates')
    .select('amount')
    .eq('store_id', storeId)
    .eq('business_date', businessDate)
    .maybeSingle();

  if (error || !data) return null;
  return Number(data.amount);
}

/** 直近の棚卸し履歴（参考表示用）を新しい順で取得 */
export async function getRecentInventory(
  storeId: string,
  limit = 5,
): Promise<InventorySnapshot[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inventory_estimates')
    .select('business_date, amount')
    .eq('store_id', storeId)
    .order('business_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((r) => ({ business_date: r.business_date, amount: Number(r.amount) }));
}

/**
 * 棚卸し（在庫合計額）を UPSERT 保存する。
 *
 * - amount が空欄（null/undefined）のときは保存しない（記録を作らない）。
 *   既存レコードがあっても DELETE はしない（そのまま残す）。
 * - amount があるときは (store_id, business_date) で UPSERT 上書き。
 * - 仕入の保存とは独立（この成否は daily_purchases に影響しない）。
 *
 * @returns saved: 1（保存した）/ 0（空欄でスキップ）
 */
export async function upsertInventoryEstimate(
  input: UpsertInventoryInput,
): Promise<ActionResult<{ saved: number }>> {
  const parsed = upsertInventorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容を確認してください',
    };
  }

  const denied = await ensureCanWriteForStore(parsed.data.store_id);
  if (denied) return denied;

  // 空欄はスキップ（記録を作らない・DELETEもしない）
  if (parsed.data.amount === null || parsed.data.amount === undefined) {
    return { success: true, data: { saved: 0 } };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('inventory_estimates').upsert(
    {
      store_id: parsed.data.store_id,
      business_date: parsed.data.business_date,
      amount: parsed.data.amount,
    },
    { onConflict: 'store_id,business_date' },
  );

  if (error) return { success: false, error: translateDbError(error) };

  revalidatePath('/daily-input/purchases');
  return { success: true, data: { saved: 1 } };
}
