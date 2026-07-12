import { redirect } from 'next/navigation';
import { AlertTriangle, ChevronRight, Target as TargetIcon } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { roleHasCapability } from '@/lib/permissions/server';
import { resolveSelectedStoreId } from '@/lib/stores/selected-store';
import { TargetExportSection } from './_components/target-export-section';
import { TargetImportPanel } from './_components/TargetImportPanel';
import { TargetCalendarSection } from './_components/target-calendar-section';
import { TargetsTabBar } from './_components/targets-tab-bar';
import type { StoreLite } from './_components/types';

export const metadata = {
  title: '売上予算 | みせPL',
};

type SearchParams = { [key: string]: string | string[] | undefined };

function pickString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function monthStartISO(): string {
  return `${currentYearMonth()}-01`;
}
function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export default async function TargetsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.is_active) redirect('/login');

  // RLS で参照可能な有効店舗のみ
  const { data: storesData } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('display_order');
  const stores: StoreLite[] = storesData ?? [];

  const canEdit = await roleHasCapability(supabase, profile.role, 'targets');

  // URL state：タブ・店舗・月
  const tab = pickString(searchParams?.tab) === 'excel' ? 'excel' : 'calendar';
  const rawStore = pickString(searchParams?.store);
  const rawMonth = pickString(searchParams?.month);
  // URL の ?store= → Cookie（前回選択）→ 先頭店 の順で既定を決める（#2）
  const selectedStoreId = await resolveSelectedStoreId(rawStore, stores);
  const yearMonth = rawMonth && MONTH_PATTERN.test(rawMonth) ? rawMonth : currentYearMonth();

  // カレンダータブ：選択月の既存予算（daily_targets）＋店休日（daily_sales.is_closed）を読み込み
  const calendarInitial: Record<string, number> = {};
  const calendarClosed: Record<string, boolean> = {};
  if (canEdit && tab === 'calendar' && selectedStoreId) {
    const [y, m] = yearMonth.split('-').map(Number);
    const monthStart = `${yearMonth}-01`;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
    const [targetsResult, salesResult] = await Promise.all([
      supabase
        .from('daily_targets')
        .select('target_date, target_sales')
        .eq('store_id', selectedStoreId)
        .gte('target_date', monthStart)
        .lte('target_date', monthEnd),
      // 店休日は daily_sales（day_period='all'）の is_closed に一本化
      supabase
        .from('daily_sales')
        .select('business_date, is_closed')
        .eq('store_id', selectedStoreId)
        .eq('day_period', 'all')
        .gte('business_date', monthStart)
        .lte('business_date', monthEnd),
    ]);
    for (const r of (targetsResult.data ?? []) as { target_date: string; target_sales: number | string }[]) {
      calendarInitial[r.target_date] = Number(r.target_sales);
    }
    for (const r of (salesResult.data ?? []) as { business_date: string; is_closed: boolean }[]) {
      if (r.is_closed) calendarClosed[r.business_date] = true;
    }
  }

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">業務</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">売上予算</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Sales Targets</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <TargetIcon className="w-7 h-7 text-slate-700" />
          売上予算
        </h1>
        <p className="text-sm text-slate-600">
          日別の売上予算（税抜・ネットセールス基準）を、カレンダーで手入力、または Excel で一括取り込みします。
        </p>
      </div>

      {!canEdit ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
          <AlertTriangle className="w-6 h-6 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600">
            売上予算の編集は店長以上（経営層・各国代表・店長）のみ可能です。
          </p>
        </div>
      ) : (
        <>
          <TargetsTabBar active={tab} />

          {tab === 'calendar' ? (
            <TargetCalendarSection
              stores={stores}
              selectedStoreId={selectedStoreId}
              yearMonth={yearMonth}
              initialValues={calendarInitial}
              initialClosed={calendarClosed}
              canWrite={canEdit}
            />
          ) : (
            <div className="space-y-10">
              <TargetExportSection
                stores={stores}
                defaultFrom={monthStartISO()}
                defaultTo={todayISO()}
                defaultStoreId={selectedStoreId}
              />
              <TargetImportPanel stores={stores} defaultStoreId={selectedStoreId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
