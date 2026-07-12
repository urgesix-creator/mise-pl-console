// ====================================================================
// 月次PL 販管費 Excel入出力 共通の権限チェック（通常モジュール・DB読取のみ）
//
//   - 認証・can_write（店長以上＋staff）・店舗スコープを検証し、supabase と store を返す。
//   - monthly_expenses の書込RLS／expense-actions.ts の WRITE_ROLES と一致させる
//     （executive / country_rep / store_manager / staff）。
//   - 既存 expense-actions.ts の ensureCanWriteForStore はコピー思想で踏襲（同ファイルは変更しない）。
//     export 用に store.fiscal_year_start_month も返す点だけ拡張。
//   - 書き込みは一切しない（読み取り＝SELECT のみ）。最終防衛線は RLS。
// ====================================================================

import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** 販管費の書込可能ロール（monthly_expenses RLS・expense-actions と一致） */
export const EXPENSE_WRITE_ROLES = [
  'executive',
  'country_rep',
  'store_manager',
  'staff',
] as const;

export type ExpenseStore = {
  id: string;
  name: string;
  country_id: string | null;
  is_active: boolean;
  fiscal_year_start_month: number;
};

export type EnsureCanWriteResult =
  | { ok: true; supabase: SupabaseServerClient; store: ExpenseStore }
  | { ok: false; error: string };

/** 認証・can_write・店舗スコープを検証して supabase と store を返す（読み取りのみ） */
export async function ensureCanWriteForStore(storeId: string): Promise<EnsureCanWriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '認証が必要です' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country_id, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) return { ok: false, error: '無効なユーザーです' };
  if (!(await roleHasCapability(supabase, profile.role, 'daily_input'))) {
    return { ok: false, error: '販管費の入出力権限がありません' };
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, country_id, is_active, fiscal_year_start_month')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return { ok: false, error: 'アクセス可能な店舗が見つかりません' };
  if (!store.is_active) return { ok: false, error: 'この店舗は無効化されています' };

  if (profile.role === 'country_rep' && store.country_id !== profile.country_id) {
    return { ok: false, error: '担当国外の店舗です' };
  }
  if (profile.role === 'store_manager' || profile.role === 'staff') {
    const { data: assignment } = await supabase
      .from('user_store_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .maybeSingle();
    if (!assignment) return { ok: false, error: '担当店舗外です' };
  }
  // executive は全店アクセス可

  return {
    ok: true,
    supabase,
    store: {
      id: store.id,
      name: store.name,
      country_id: store.country_id,
      is_active: store.is_active,
      fiscal_year_start_month: Number(store.fiscal_year_start_month),
    },
  };
}

/** 決算期（fyStartYear＋会計開始月）から12ヶ月の 'YYYY-MM' を生成する（純粋） */
export function buildFiscalMonthColumns(fyStartYear: number, startMonth: number): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: 12 }, (_, i) => {
    const idx = startMonth - 1 + i;
    const year = fyStartYear + Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    return `${year}-${pad(month)}`;
  });
}
