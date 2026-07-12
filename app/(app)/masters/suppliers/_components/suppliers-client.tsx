'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Edit3,
  ArrowUp,
  ArrowDown,
  PowerOff,
  Power,
  Truck,
  Package,
  Check,
  Store as StoreIcon,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Tag,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { SupplierFormDialog } from './supplier-form-dialog';
import { setSupplierActive, reorderSuppliers } from '../actions';
import type { PurchaseCategory, Role, Store, SupplierWithMeta } from './types';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; supplier: SupplierWithMeta };

type SuppliersClientProps = {
  stores: Store[];
  selectedStore: Store;
  suppliers: SupplierWithMeta[];
  categories: PurchaseCategory[];
  canWrite: boolean;
};

export function SuppliersClient({
  stores,
  selectedStore,
  suppliers,
  categories,
  canWrite,
}: SuppliersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' });
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierWithMeta | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active).sort((a, b) => a.display_order - b.display_order),
    [categories],
  );

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.display_order - b.display_order),
    [suppliers],
  );

  const filtered = useMemo(() => {
    return sortedSuppliers
      .filter((s) => showInactive || s.is_active)
      .filter((s) => categoryFilter === 'all' || s.category_id === categoryFilter)
      .filter((s) =>
        !search.trim() ? true : s.name.toLowerCase().includes(search.trim().toLowerCase()),
      );
  }, [sortedSuppliers, search, categoryFilter, showInactive]);

  const stats = useMemo(
    () => ({
      total: suppliers.length,
      active: suppliers.filter((s) => s.is_active).length,
      transactions: suppliers.reduce((sum, s) => sum + s.transaction_count, 0),
      categoriesUsed: new Set(suppliers.filter((s) => s.is_active).map((s) => s.category_id)).size,
    }),
    [suppliers],
  );

  const nextDisplayOrder = useMemo(() => {
    if (suppliers.length === 0) return 1;
    return Math.max(...suppliers.map((s) => s.display_order)) + 1;
  }, [suppliers]);

  const handleStoreChange = (newId: string) => {
    router.push(`/masters/suppliers?store=${newId}`);
  };

  const handleMove = (supplierId: string, direction: 'up' | 'down') => {
    const activeSorted = sortedSuppliers.filter((s) => s.is_active);
    const idx = activeSorted.findIndex((s) => s.id === supplierId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === activeSorted.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const reordered = [...activeSorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    const inactiveSorted = sortedSuppliers.filter((s) => !s.is_active);
    const orderedIds = [...reordered.map((s) => s.id), ...inactiveSorted.map((s) => s.id)];

    startTransition(async () => {
      const result = await reorderSuppliers(selectedStore.id, orderedIds);
      if (!result.success) toast.error(result.error);
    });
  };

  const handleToggleActive = (supplier: SupplierWithMeta) => {
    if (supplier.is_active) {
      setDeactivateTarget(supplier);
      return;
    }
    startTransition(async () => {
      const result = await setSupplierActive(supplier.id, selectedStore.id, true);
      if (result.success) {
        toast.success(`「${supplier.name}」を有効化しました`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    startTransition(async () => {
      const result = await setSupplierActive(target.id, selectedStore.id, false);
      if (result.success) {
        toast.success(`「${target.name}」を無効化しました`);
        setDeactivateTarget(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4" aria-label="パンくず">
        <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
          ホーム
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">マスタ管理</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-900 font-medium">仕入先</span>
      </nav>

      {/* Page header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Master Data · Suppliers</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
              仕入先マスタ
            </h1>
            <p className="text-sm text-slate-600">店舗別の仕入先管理、カテゴリ連動</p>
          </div>
          {canWrite && (
            <Button
              onClick={() => setDialogState({ mode: 'create' })}
              size="lg"
              disabled={activeCategories.length === 0}
              className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-slate-900/10"
              title={
                activeCategories.length === 0 ? '先に仕入カテゴリの登録が必要です' : undefined
              }
            >
              <Plus className="w-4 h-4" />
              仕入先追加
            </Button>
          )}
        </div>
      </div>

      {/* Store Selector */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <StoreIcon className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-0.5">
              対象店舗
            </div>
            {stores.length > 1 ? (
              <Select value={selectedStore.id} onValueChange={handleStoreChange}>
                <SelectTrigger className="h-9 max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="font-display text-base font-bold text-slate-900">
                {selectedStore.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="登録仕入先" value={stats.total} unit="社" icon={Truck} />
        <StatCard label="有効" value={stats.active} unit="社" icon={Check} />
        <StatCard label="利用カテゴリ" value={stats.categoriesUsed} unit="種" icon={Tag} />
        <StatCard label="取引履歴" value={stats.transactions} unit="件" icon={Activity} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="仕入先名で絞り込み..."
            className="pl-10 h-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 w-full sm:w-[200px]">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのカテゴリ</SelectItem>
            {activeCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer accent-brand-600"
          />
          <span className="text-sm text-slate-700">無効化された仕入先も表示</span>
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Truck className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-sm text-slate-500 mb-4">
            {search || categoryFilter !== 'all'
              ? '該当する仕入先が見つかりません'
              : 'この店舗にはまだ仕入先が登録されていません'}
          </div>
          {!search && categoryFilter === 'all' && canWrite && activeCategories.length > 0 && (
            <button
              onClick={() => setDialogState({ mode: 'create' })}
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              最初の仕入先を追加
            </button>
          )}
          {activeCategories.length === 0 && (
            <div className="text-xs text-amber-700 mt-2">
              ※ この店舗には有効なカテゴリがありません。先に仕入カテゴリの登録が必要です
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[56px_1fr_160px_120px_100px_180px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <div className="text-right pr-2">順</div>
            <div>仕入先名</div>
            <div>カテゴリ</div>
            <div className="text-right">取引履歴</div>
            <div>ステータス</div>
            <div className="text-right">操作</div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-slate-100">
            {filtered.map((supplier, idx) => {
              const activeSorted = filtered.filter((s) => s.is_active);
              const activeIdx = activeSorted.findIndex((s) => s.id === supplier.id);
              const canMoveUp = supplier.is_active && activeIdx > 0;
              const canMoveDown =
                supplier.is_active && activeIdx >= 0 && activeIdx < activeSorted.length - 1;

              return (
                <li
                  key={supplier.id}
                  className={cn(
                    'grid md:grid-cols-[56px_1fr_160px_120px_100px_180px] gap-2 md:gap-4 px-5 py-3.5 items-center anim-in',
                    !supplier.is_active && 'opacity-60 bg-slate-50/50',
                  )}
                  style={{ animationDelay: `${idx * 20}ms`, animationFillMode: 'backwards' }}
                >
                  {/* Order */}
                  <div className="hidden md:block font-num text-sm text-slate-500 text-right pr-2">
                    {supplier.display_order}
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold text-slate-900 truncate">
                      {supplier.name}
                    </div>
                    <div className="md:hidden flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                      <CategoryPill name={supplier.category_name} muted={!supplier.category_is_active} />
                      <CostTypePill costType={supplier.cost_type} />
                      <TaxPill rate={supplier.tax_rate} exempt={supplier.is_tax_exempt} />
                      <span className="font-num">取引 {supplier.transaction_count}</span>
                      {!supplier.is_active && (
                        <span className="text-rose-700">停止中</span>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="hidden md:flex flex-col gap-1 items-start">
                    <CategoryPill name={supplier.category_name} muted={!supplier.category_is_active} />
                    <div className="flex items-center gap-1">
                      <CostTypePill costType={supplier.cost_type} />
                      <TaxPill rate={supplier.tax_rate} exempt={supplier.is_tax_exempt} />
                    </div>
                  </div>

                  {/* Transaction count */}
                  <div className="hidden md:flex items-center justify-end gap-1.5 text-sm">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-num font-medium text-slate-900">
                      {supplier.transaction_count}
                    </span>
                    <span className="text-xs text-slate-500">件</span>
                  </div>

                  {/* Status */}
                  <div className="hidden md:block">
                    {supplier.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        営業中
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        停止中
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 col-span-full md:col-auto">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMove(supplier.id, 'up')}
                          disabled={!canMoveUp || isPending}
                          aria-label="上へ"
                          className="h-8 w-8"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMove(supplier.id, 'down')}
                          disabled={!canMoveDown || isPending}
                          aria-label="下へ"
                          className="h-8 w-8"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogState({ mode: 'edit', supplier })}
                          disabled={isPending}
                          className="h-8"
                        >
                          <Edit3 className="w-3 h-3" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(supplier)}
                          disabled={isPending}
                          className={cn(
                            'h-8',
                            supplier.is_active
                              ? 'hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700'
                              : 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
                          )}
                        >
                          {supplier.is_active ? (
                            <PowerOff className="w-3 h-3" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                          <span className="hidden lg:inline">
                            {supplier.is_active ? '無効化' : '有効化'}
                          </span>
                        </Button>
                      </>
                    )}
                    {!canWrite && (
                      <span className="text-[11px] text-slate-400">編集権限なし</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Help text */}
      <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· 仕入先は店舗ごとに独立。同一店舗内で仕入先名は重複できません</p>
        <p>· カテゴリが無効化されても既存の仕入先表示は維持されます（過去データ保護のため）</p>
        <p>· 新規登録時は有効なカテゴリのみ選択可能。並べ替えは↑↓ボタンで1つずつ移動</p>
        <p>· 取引履歴のある仕入先も無効化可能（過去データは保持）</p>
      </div>

      {/* Form Dialog */}
      <SupplierFormDialog
        open={dialogState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setDialogState({ mode: 'closed' });
        }}
        mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
        storeId={selectedStore.id}
        storeName={selectedStore.name}
        supplier={dialogState.mode === 'edit' ? dialogState.supplier : null}
        activeCategories={activeCategories}
        nextDisplayOrder={nextDisplayOrder}
        defaultTaxRate={Number(selectedStore.purchase_tax_rate_default ?? 0)}
      />

      {/* Deactivate Confirm */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeactivateTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
              Deactivate Supplier
            </div>
            <DialogTitle className="font-display text-xl font-bold">仕入先を無効化</DialogTitle>
            <DialogDescription>
              以下の仕入先を無効化します。過去データは保持されますが、各画面で非表示になります。
            </DialogDescription>
          </DialogHeader>

          {deactivateTarget && (
            <div className="space-y-4 py-2">
              {deactivateTarget.transaction_count > 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900 leading-relaxed">
                    この仕入先には <span className="font-bold font-num">{deactivateTarget.transaction_count} 件</span>
                    の取引履歴があります。無効化すると今後の取引登録はできなくなりますが、過去データは保持されます。よろしいですか？
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  「無効化された仕入先も表示」をONにすると、後から再有効化できます。
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500 mb-1">対象仕入先</div>
                <div className="font-display text-xl font-bold text-slate-900">
                  {deactivateTarget.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  カテゴリ: {deactivateTarget.category_name} · 表示順 {deactivateTarget.display_order} · 取引 {deactivateTarget.transaction_count} 件
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDeactivate} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              無効化する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  icon: typeof Truck;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold truncate">
          {label}
        </div>
        <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </div>
      <div className="flex items-baseline gap-1">
        <div className="font-num text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{unit}</div>
      </div>
    </div>
  );
}

function CostTypePill({ costType }: { costType: 'cogs' | 'sga' }) {
  const isSga = costType === 'sga';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
        isSga
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-100 text-slate-600 border-slate-200',
      )}
      title={isSga ? '販管費（売上原価から除外）' : '売上原価'}
    >
      {isSga ? '販管費' : '売上原価'}
    </span>
  );
}

function TaxPill({ rate, exempt }: { rate: number; exempt: boolean }) {
  if (exempt) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200"
        title="非課税（税額0・税込＝税抜）"
      >
        非課税
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center font-num text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200"
      title="仕入税率（自動適用）"
    >
      税 {Number(rate)}%
    </span>
  );
}

function CategoryPill({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border max-w-full',
        muted
          ? 'bg-slate-100 text-slate-500 border-slate-200 line-through decoration-slate-400'
          : 'bg-slate-900/[0.04] text-slate-700 border-slate-200',
      )}
      title={muted ? `${name}（カテゴリは無効化済み）` : name}
    >
      <Tag className="w-2.5 h-2.5 flex-shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}
