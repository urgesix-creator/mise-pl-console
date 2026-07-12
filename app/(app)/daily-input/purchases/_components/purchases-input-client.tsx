'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  Save,
  Tag,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StoreDateSelector } from '../../sales/_components/store-date-selector';
import { AmountInput } from '../../sales/_components/amount-input';
import type { AccessibleStore } from '../../sales/actions';
import type { InventorySnapshot, PurchaseCategoryOption, SupplierOption } from '../actions';
import { upsertDailyPurchases, setPurchaseTaxInputMode } from '../actions';
import { InventorySection } from './inventory-section';
import { useGridNavigation } from '@/hooks/use-grid-navigation';
import { SupplierFormDialog } from '@/app/(app)/masters/suppliers/_components/supplier-form-dialog';
import { computePurchaseTax, isIntegerCurrency, type PurchaseTaxMode } from '@/lib/purchases/tax';
import { cn } from '@/lib/utils';

type PurchasesInputClientProps = {
  stores: AccessibleStore[];
  selectedStoreId: string | null;
  selectedDate: string;
  currencyCode: string;
  /** 通貨id（idr 等＝整数丸めの判定に使用） */
  currencyId: string;
  suppliers: SupplierOption[];
  categories: PurchaseCategoryOption[];
  /** 既存値（supplier_id → 入力モードに応じた表示値 net/gross）。当日・当店の保存済み値 */
  initialValues: Record<string, number>;
  /** 棚卸し：当日・当店の既存在庫額（無ければ null） */
  inventoryAmount: number | null;
  /** 棚卸し：直近履歴（参考表示） */
  recentInventory: InventorySnapshot[];
  canWrite: boolean;
  /** 仕入先マスタ編集権限（store_master）。「新規仕入先を追加」ボタンの表示可否 */
  canManageSuppliers: boolean;
  /** 店舗の仕入入力モード（税抜/税込・店舗単位で共有） */
  inputMode: PurchaseTaxMode;
  /** 店舗標準の仕入税率(%)（新規仕入先追加の既定） */
  defaultTaxRate: number;
};

// カテゴリ未設定（マスタ欠落等）の仕入先をまとめる擬似グループ
const UNCATEGORIZED = '__uncategorized__';

export function PurchasesInputClient({
  stores,
  selectedStoreId,
  selectedDate,
  currencyCode,
  suppliers,
  categories,
  initialValues,
  inventoryAmount,
  recentInventory,
  canWrite,
  canManageSuppliers,
  currencyId,
  inputMode,
  defaultTaxRate,
}: PurchasesInputClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modePending, startModeChange] = useTransition();
  // 「新規仕入先を追加」モーダルの開閉
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  // カテゴリ絞り込み（表示のみ・保存対象は全件のまま）。''＝全て
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const integerCurrency = useMemo(() => isIntegerCurrency(currencyId), [currencyId]);

  // 入力モード切替（店舗単位で共有保持）。保存後リロードして初期値を新モードの基準で再表示。
  const changeMode = (mode: PurchaseTaxMode) => {
    if (mode === inputMode || !selectedStoreId) return;
    startModeChange(async () => {
      const res = await setPurchaseTaxInputMode(selectedStoreId, mode);
      if (res.success) {
        toast.success(mode === 'included' ? '税込入力に切り替えました' : '税抜入力に切り替えました');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  // 仕入先ごとの税率・非課税（自動適用）
  const supplierTaxById = useMemo(() => {
    const m = new Map<string, { rate: number; exempt: boolean }>();
    for (const s of suppliers) m.set(s.id, { rate: Number(s.tax_rate ?? 0), exempt: !!s.is_tax_exempt });
    return m;
  }, [suppliers]);

  // 入力値（モードに応じ net/gross）から net/tax/gross を算出（表示・合計用。保存はサーバが再計算）
  const calc = (supplierId: string, input: number | undefined) => {
    const t = supplierTaxById.get(supplierId) ?? { rate: 0, exempt: false };
    return computePurchaseTax({
      input: input ?? 0,
      mode: inputMode,
      ratePercent: t.rate,
      isExempt: t.exempt,
      integerCurrency,
    });
  };

  // モーダル用：当店の店名・有効カテゴリ・次の表示順（仕入先マスタの登録ダイアログを再利用）
  const storeName = useMemo(
    () => stores.find((s) => s.id === selectedStoreId)?.name ?? '',
    [stores, selectedStoreId],
  );
  const activeCategoryOptions = useMemo(
    () => categories.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name })),
    [categories],
  );
  const nextSupplierOrder = useMemo(
    () => (suppliers.length === 0 ? 1 : Math.max(...suppliers.map((s) => s.display_order)) + 1),
    [suppliers],
  );

  // supplier_id → 入力値。空欄は undefined（保存時に 0 として扱う）
  const [amounts, setAmounts] = useState<Record<string, number | undefined>>(initialValues);

  // 移動時保存（onBlur）の dirty 判定用に「保存済みの値」を保持（0 正規化で比較）
  const savedRef = useRef<Record<string, number | undefined>>({ ...initialValues });

  // キー移動（Enter下・↑↓）。縦1列グリッドとして共通フックを再利用。
  const gridNav = useGridNavigation();

  // 店舗・日付・入力モードの切替（＝初期値の基準変化）でローカル状態を再同期
  useEffect(() => {
    setAmounts(initialValues);
    savedRef.current = { ...initialValues };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedDate, inputMode]);

  // 表示対象の仕入先：有効、または既存データを持つ無効仕入先（訂正のため残す）
  const visibleSuppliers = useMemo(
    () => suppliers.filter((s) => s.is_active || initialValues[s.id] !== undefined),
    [suppliers, initialValues],
  );

  // カテゴリ display_order 順 → 各グループ内は仕入先 display_order 順にグループ化
  const groups = useMemo(() => {
    const byCategory = new Map<string, SupplierOption[]>();
    for (const s of visibleSuppliers) {
      const key = s.category_id ?? UNCATEGORIZED;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(s);
    }
    const ordered: { id: string; name: string; suppliers: SupplierOption[] }[] = [];
    for (const c of categories) {
      const list = byCategory.get(c.id);
      if (list && list.length > 0) {
        ordered.push({ id: c.id, name: c.name, suppliers: list });
        byCategory.delete(c.id);
      }
    }
    // カテゴリマスタに無い category_id（欠落）や未分類は末尾にまとめて表示
    const leftovers: SupplierOption[] = [];
    for (const list of byCategory.values()) leftovers.push(...list);
    if (leftovers.length > 0) {
      ordered.push({ id: UNCATEGORIZED, name: 'その他（カテゴリ未設定）', suppliers: leftovers });
    }
    return ordered;
  }, [visibleSuppliers, categories]);

  // カテゴリ絞り込み後に表示するグループ（全て=groups／指定時=該当カテゴリのみ）。表示のみ。
  const displayGroups = useMemo(
    () => (categoryFilter === '' ? groups : groups.filter((g) => g.id === categoryFilter)),
    [groups, categoryFilter],
  );

  // グループをまたいだ「表示順の通し番号」（data-nav-row 用・Enter下/↑↓ の移動順）。
  // 実際に表示している行（displayGroups）で採番し、絞り込み時のキー移動と一致させる。
  const navIndex = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const g of displayGroups) for (const s of g.suppliers) m.set(s.id, i++);
    return m;
  }, [displayGroups]);

  // 入力中の合計（表示のみ・保存しない）。net/tax/gross を仕入先税率で集計。
  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    let gross = 0;
    for (const s of visibleSuppliers) {
      const r = calc(s.id, amounts[s.id]);
      net += r.net;
      tax += r.tax;
      gross += r.gross;
    }
    return { net, tax, gross };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSuppliers, amounts, inputMode, supplierTaxById, integerCurrency]);

  // 保存アクションが返した権威値（DB実値）で、入力欄と dirty 基準を確定する。
  //   再読込（router.refresh）の結果に依存しないため、「保存→再表示で消える」を防ぐ。
  //   表示はモードに応じて included=gross / excluded=net を採用。
  const applySavedRows = (rows: { supplier_id: string; net: number; gross: number }[]) => {
    if (rows.length === 0) return;
    setAmounts((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const v = inputMode === 'included' ? r.gross : r.net;
        next[r.supplier_id] = v;
        savedRef.current[r.supplier_id] = v;
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!selectedStoreId) return;
    startTransition(async () => {
      const entries = visibleSuppliers.map((s) => ({
        supplier_id: s.id,
        amount: amounts[s.id], // undefined はサーバ側で 0 に正規化（DELETEしない）
      }));
      const result = await upsertDailyPurchases({
        store_id: selectedStoreId,
        business_date: selectedDate,
        entries,
      });
      if (result.success) {
        applySavedRows(result.data?.rows ?? []); // 権威値で表示確定（消えるのを防ぐ）
        toast.success(`仕入を保存しました（${result.data?.saved ?? 0}件）`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // 移動時保存：値が変化した1仕入先だけを保存（既存の一括保存と同じ Action・同じ UPSERT 単位）。
  // 既存の「仕入を保存」ボタンは安全網として残す。両者は同一 Action のため二重保存にならない。
  const saveSupplierOnBlur = (supplierId: string) => {
    if (!canWrite || !selectedStoreId) return;
    const val = amounts[supplierId];
    const prev = savedRef.current[supplierId];
    // 0 正規化で比較（空欄=0・変化なしなら保存しない）
    if ((val ?? 0) === (prev ?? 0)) return;
    // 多重保存を避けるため先に baseline を更新（失敗時は戻す）
    savedRef.current[supplierId] = val;
    void (async () => {
      const result = await upsertDailyPurchases({
        store_id: selectedStoreId,
        business_date: selectedDate,
        entries: [{ supplier_id: supplierId, amount: val }],
      });
      if (result.success) {
        applySavedRows(result.data?.rows ?? []); // 権威値で baseline/表示を確定
      } else {
        savedRef.current[supplierId] = prev;
        toast.error(result.error);
      }
    })();
  };

  const hasSuppliers = visibleSuppliers.length > 0;

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-4xl mx-auto pb-28">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">業務</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">日次仕入入力</span>
      </nav>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Daily Input · Purchases</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
          日次仕入入力
        </h1>
        <p className="text-sm text-slate-600">
          仕入先ごとに当日の仕入額を入力します。過去日付の入力・修正もできます。
        </p>
      </div>

      {/* 店舗・日付選択（売上入力と共通） */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
        <StoreDateSelector
          stores={stores}
          selectedStoreId={selectedStoreId}
          selectedDate={selectedDate}
        />
      </div>

      {/* カテゴリで絞り込み（店舗の下・仕入額の上）。表示のみ＝保存は全カテゴリ対象 */}
      {selectedStoreId && hasSuppliers && groups.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-5">
          <label
            htmlFor="purchase-category-filter"
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2"
          >
            <Tag className="w-3 h-3" /> カテゴリで絞り込み
          </label>
          <select
            id="purchase-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 w-full sm:w-[300px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          >
            <option value="">全て（{visibleSuppliers.length}）</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}（{g.suppliers.length}）
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-500">
            表示の絞り込みだけです。保存（仕入を保存）は全カテゴリが対象です。
          </p>
        </div>
      )}

      {/* 仕入先チェックリスト */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-600" />
              仕入先別 仕入額
            </h2>
            {canManageSuppliers && selectedStoreId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddSupplierOpen(true)}
                className="flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                新規仕入先を追加
              </Button>
            )}
          </div>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              仕入れた仕入先に金額を入力してください。空欄は 0 として保存されます（記録は削除されません。訂正は再保存で上書きします）。
              税率は取引先マスタで自動適用され、net/税/税込の3値で保存します。
            </p>
          </div>

          {/* 入力モード（税抜/税込）切替。店舗単位で共有保持。 */}
          {selectedStoreId && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                入力モード
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  disabled={!canWrite || modePending}
                  onClick={() => changeMode('excluded')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60',
                    inputMode === 'excluded' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  税抜で入力
                </button>
                <button
                  type="button"
                  disabled={!canWrite || modePending}
                  onClick={() => changeMode('included')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-semibold border-l border-slate-200 transition-colors disabled:opacity-60',
                    inputMode === 'included' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  税込で入力
                </button>
              </div>
              {modePending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              <span className="text-[11px] text-slate-500">
                店舗共通の設定です（全員に反映）。税率は取引先マスタで管理（入力欄での上書き不可）。
              </span>
            </div>
          )}
        </div>

        {!selectedStoreId ? (
          stores.length === 0 ? (
            /* 仕入権限はあるが、アクセスできる店舗が割り当てられていない（RLSで店舗・仕入先が空になる）。
               この場合は理由が分からず「合計が出ない／保存できない」状態になるため、明示する。 */
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
              <div className="text-sm font-semibold text-amber-900 mb-1">
                担当店舗が割り当てられていません
              </div>
              <div className="text-xs text-amber-800 leading-relaxed">
                仕入の入力権限はありますが、アクセスできる店舗がありません。これでは仕入先一覧・合計が表示されず、
                保存もできません。管理者に「店舗の割り当て」を依頼してください（ユーザー管理 → 担当店舗）。
              </div>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              店舗を選択してください
            </div>
          )
        ) : !hasSuppliers ? (
          /* 仕入先マスタ未登録 */
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-10 text-center">
            <div className="text-sm text-slate-600 mb-3">
              この店舗には仕入先が登録されていません
            </div>
            {canManageSuppliers ? (
              <Button type="button" onClick={() => setAddSupplierOpen(true)}>
                <Plus className="w-4 h-4" />
                新規仕入先を追加
              </Button>
            ) : (
              <Link
                href={`/masters/suppliers?store=${selectedStoreId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:underline"
              >
                先に仕入先マスタを登録する
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6" onKeyDown={gridNav.onKeyDown}>
            {displayGroups.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-slate-500">
                選択したカテゴリに該当する仕入先がありません（「全て」に戻すと表示されます）。
              </div>
            )}
            {displayGroups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2.5">
                  <Tag className="w-3 h-3" />
                  <span>{group.name}</span>
                  <span className="font-num text-slate-400">· {group.suppliers.length}</span>
                </div>
                <div className="space-y-2.5">
                  {group.suppliers.map((s) => (
                    <div
                      key={s.id}
                      data-nav-row={navIndex.get(s.id)}
                      data-nav-col={0}
                      className="grid grid-cols-[1fr_180px] items-center gap-3"
                    >
                      <div className="min-w-0">
                        <Label
                          htmlFor={`sup-${s.id}`}
                          className="text-sm text-slate-700 font-medium flex items-center gap-1.5 min-w-0"
                        >
                          <span className="truncate">{s.name}</span>
                          {!s.is_active && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              無効
                            </span>
                          )}
                        </Label>
                        <RowTaxHint
                          input={amounts[s.id]}
                          mode={inputMode}
                          tax={supplierTaxById.get(s.id) ?? { rate: 0, exempt: false }}
                          result={calc(s.id, amounts[s.id])}
                          currencyCode={currencyCode}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <AmountInput
                          id={`sup-${s.id}`}
                          disabled={!canWrite}
                          placeholder="0"
                          className="font-num text-right"
                          value={amounts[s.id]}
                          onChange={(v) =>
                            setAmounts((prev) => ({ ...prev, [s.id]: v }))
                          }
                          onBlur={() => saveSupplierOnBlur(s.id)}
                        />
                        <span className="text-xs text-slate-500 font-num whitespace-nowrap w-10">
                          {currencyCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 合計（表示のみ・net/税/税込） */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">税抜（net）合計</span>
                <span className="font-num text-sm font-semibold text-slate-700">
                  {totals.net.toLocaleString('ja-JP')}
                  <span className="text-[10px] text-slate-400 ml-1">{currencyCode}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">税額 合計</span>
                <span className="font-num text-sm font-semibold text-slate-700">
                  {totals.tax.toLocaleString('ja-JP')}
                  <span className="text-[10px] text-slate-400 ml-1">{currencyCode}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">税込（gross）合計</span>
                <span className="font-num text-lg font-bold text-slate-900">
                  {totals.gross.toLocaleString('ja-JP')}
                  <span className="text-xs text-slate-500 ml-1">{currencyCode}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 棚卸し（在庫）セクション：仕入とは独立した保存経路 */}
      {selectedStoreId && (
        <InventorySection
          storeId={selectedStoreId}
          businessDate={selectedDate}
          currencyCode={currencyCode}
          initialAmount={inventoryAmount}
          recent={recentInventory}
          canWrite={canWrite}
        />
      )}

      {/* Sticky 保存バー（仕入の保存） */}
      {selectedStoreId && hasSuppliers && canWrite && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] z-30 bg-white/90 backdrop-blur border-t border-slate-200 px-5 sm:px-8 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 hidden sm:block">
              経営売上とは別に保存されます（この保存は売上に影響しません）。
            </p>
            <Button onClick={handleSave} disabled={isPending} className="flex-shrink-0">
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              仕入を保存
            </Button>
          </div>
        </div>
      )}

      {!canWrite && selectedStoreId && hasSuppliers && (
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
          閲覧のみ（仕入の入力権限がありません）
        </div>
      )}

      {/* 新規仕入先を追加（仕入先マスタの登録ダイアログを再利用・類似名チェック込み）。
          登録成功で再取得し、その場で選択肢へ反映する。 */}
      {selectedStoreId && canManageSuppliers && (
        <SupplierFormDialog
          open={addSupplierOpen}
          onOpenChange={setAddSupplierOpen}
          mode="create"
          storeId={selectedStoreId}
          storeName={storeName}
          supplier={null}
          activeCategories={activeCategoryOptions}
          nextDisplayOrder={nextSupplierOrder}
          defaultTaxRate={defaultTaxRate}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}

/** 行ごとの税ヒント（自動適用された税率での net/税/税込の補助表示） */
function RowTaxHint({
  input,
  mode,
  tax,
  result,
  currencyCode,
}: {
  input: number | undefined;
  mode: PurchaseTaxMode;
  tax: { rate: number; exempt: boolean };
  result: { net: number; tax: number; gross: number };
  currencyCode: string;
}) {
  const fmt = (n: number) => n.toLocaleString('ja-JP');
  if (tax.exempt) {
    return <div className="text-[10px] text-emerald-600 mt-0.5">非課税（税0・税込＝税抜）</div>;
  }
  // 値未入力時は税率のみ表示
  if (!input || input <= 0) {
    return <div className="text-[10px] text-slate-400 mt-0.5">税率 {Number(tax.rate)}%</div>;
  }
  return (
    <div className="text-[10px] text-slate-500 mt-0.5 font-num">
      {mode === 'included'
        ? `税抜 ${fmt(result.net)} ・ 税 ${fmt(result.tax)}`
        : `税込 ${fmt(result.gross)} ・ 税 ${fmt(result.tax)}`}
      <span className="text-slate-400"> （{Number(tax.rate)}% {currencyCode}）</span>
    </div>
  );
}
