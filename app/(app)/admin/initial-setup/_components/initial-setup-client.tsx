'use client';

import Link from 'next/link';
import {
  ChevronRight,
  Sparkles,
  Target,
  History,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { SupplierImportCard } from './supplier-import-card';
import { TargetExportSection } from '@/app/(app)/targets/_components/target-export-section';
import { TargetImportPanel } from '@/app/(app)/targets/_components/TargetImportPanel';
import { DailySalesExportSection } from '@/app/(app)/data/_components/daily-sales-export-section';
import { IntegratedImportPanel } from '@/app/(app)/data/_components/IntegratedImportPanel';
import type { Store, Role } from '@/app/(app)/data/_components/types';

type Props = {
  stores: Store[];
  role: Role;
  defaultFrom: string;
  defaultTo: string;
};

export function InitialSetupClient({ stores, role, defaultFrom, defaultTo }: Props) {
  const storeLite = stores.map((s) => ({ id: s.id, name: s.name }));
  const defaultStoreId = stores[0]?.id ?? null;

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">ホーム</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">初期設定</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Admin · Initial setup</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2 flex items-center gap-2.5">
          <Sparkles className="w-7 h-7 text-slate-700" />
          初期設定（一括投入）
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          運用開始時のデータ投入を1か所に集約しました。各カードで「テンプレートをダウンロード → Excelに記入 → アップロードで取込」を行えます。
          取込はすべて追加/更新のみ（削除はしません）。詳細な手入力は各「手入力画面」から行えます。
        </p>
      </div>

      <div className="space-y-5">
        {/* 1. 仕入先・カテゴリ（新規・最重要） */}
        <SupplierImportCard stores={storeLite} />

        {/* 2. 売上予算 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-slate-600" />
              売上予算（日次目標）の一括取込
            </h2>
            <Link href="/targets" className="text-[12px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5 flex-shrink-0">
              手入力画面 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[12px] text-slate-500 mb-4">
            店舗・期間のテンプレートをダウンロードし、日別の予算額を記入してアップロードします（daily_targets を日付ごとに上書き）。
          </p>
          <div className="space-y-4">
            <TargetExportSection
              stores={storeLite}
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
              defaultStoreId={defaultStoreId}
            />
            <TargetImportPanel stores={storeLite} defaultStoreId={defaultStoreId} />
          </div>
        </section>

        {/* 3. 過去の売上 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              過去の売上の一括取込
            </h2>
            <Link href="/data" className="text-[12px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5 flex-shrink-0">
              データ閲覧画面 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[12px] text-slate-500 mb-3">
            店舗・期間のテンプレートをダウンロードし、日次の売上（税抜が主入力）を記入してアップロードします。
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex gap-2.5 text-[12.5px] text-amber-900 mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>過去日を再取込すると、現在の税率で税額（消費税・サービス料）が再計算されます。</strong>
              月末レート方式・税計算（税抜が主入力）の仕様により、保存時点の税率・料率で税額が算出されます。過去の税率と異なる場合はご注意ください。
            </div>
          </div>
          <div className="space-y-4">
            <DailySalesExportSection
              stores={stores}
              userRole={role}
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
              defaultStoreId={defaultStoreId}
            />
            <IntegratedImportPanel stores={stores} selectedStoreId={defaultStoreId} userRole={role} />
          </div>
        </section>

        {/* 4. 月次PL 販管費（手入力画面へ誘導） */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-600" />
              月次PL 販管費の一括取込
            </h2>
            <Link href="/pl" className="text-[12px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5 flex-shrink-0">
              月次PL画面 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[12px] text-slate-500">
            販管費のExcelテンプレート（年度・通貨に依存）の取込は、月次PL画面で店舗・決算期を選んでから行えます。上の「月次PL画面」リンクからどうぞ。
          </p>
        </section>
      </div>

      <p className="mt-6 px-1 text-[11px] text-slate-400 leading-relaxed">
        · 取込は「店舗×名称」「店舗×日付」などのキーで既存を上書き/再利用します（物理削除なし）。エラー行は取り込まれず、行番号と理由が表示されます。
        既存の各画面（手入力・出力）の機能はそのまま利用できます。
      </p>
    </div>
  );
}
