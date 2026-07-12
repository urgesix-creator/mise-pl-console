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
  Layers,
  Package,
  Check,
  Store as StoreIcon,
  ChevronRight,
  Loader2,
  AlertTriangle,
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
import { CategoryFormDialog } from './category-form-dialog';
import { setCategoryActive, reorderCategories } from '../actions';
import type { CategoryWithSupplierCount, Store, Role } from './types';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; category: CategoryWithSupplierCount };

type CategoriesClientProps = {
  stores: Store[];
  selectedStore: Store;
  categories: CategoryWithSupplierCount[];
  canWrite: boolean;
};

export function CategoriesClient({
  stores,
  selectedStore,
  categories,
  canWrite,
}: CategoriesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' });
  const [deactivateTarget, setDeactivateTarget] = useState<CategoryWithSupplierCount | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.display_order - b.display_order),
    [categories],
  );

  const filtered = useMemo(() => {
    return sortedCategories
      .filter((c) => showInactive || c.is_active)
      .filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [sortedCategories, search, showInactive]);

  const stats = useMemo(
    () => ({
      total: categories.length,
      active: categories.filter((c) => c.is_active).length,
      suppliers: categories.reduce((sum, c) => sum + c.supplier_count, 0),
    }),
    [categories],
  );

  const nextDisplayOrder = useMemo(() => {
    if (categories.length === 0) return 1;
    return Math.max(...categories.map((c) => c.display_order)) + 1;
  }, [categories]);

  const handleStoreChange = (newId: string) => {
    router.push(`/masters/categories?store=${newId}`);
  };

  const handleMove = (categoryId: string, direction: 'up' | 'down') => {
    const activeSorted = sortedCategories.filter((c) => c.is_active);
    const idx = activeSorted.findIndex((c) => c.id === categoryId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === activeSorted.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const reordered = [...activeSorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    // 無効カテゴリを末尾に保持しつつ全体の orderedIds を構築
    const inactiveSorted = sortedCategories.filter((c) => !c.is_active);
    const orderedIds = [...reordered.map((c) => c.id), ...inactiveSorted.map((c) => c.id)];

    startTransition(async () => {
      const result = await reorderCategories(selectedStore.id, orderedIds);
      if (!result.success) toast.error(result.error);
    });
  };

  const handleToggleActive = (category: CategoryWithSupplierCount) => {
    if (category.is_active) {
      setDeactivateTarget(category);
      return;
    }
    startTransition(async () => {
      const result = await setCategoryActive(category.id, selectedStore.id, true);
      if (result.success) {
        toast.success(`「${category.name}」を有効化しました`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    startTransition(async () => {
      const result = await setCategoryActive(target.id, selectedStore.id, false);
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
        <span className="text-slate-900 font-medium">仕入カテゴリ</span>
      </nav>

      {/* Page header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Master Data · Purchase Categories</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
              仕入カテゴリ
            </h1>
            <p className="text-sm text-slate-600">店舗別の仕入カテゴリ管理</p>
          </div>
          {canWrite && (
            <Button
              onClick={() => setDialogState({ mode: 'create' })}
              size="lg"
              className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-slate-900/10"
            >
              <Plus className="w-4 h-4" />
              カテゴリ追加
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="登録数" value={stats.total} unit="件" icon={Layers} />
        <StatCard label="有効" value={stats.active} unit="件" icon={Check} />
        <StatCard label="紐づく仕入先" value={stats.suppliers} unit="社" icon={Package} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="カテゴリ名で絞り込み..."
            className="pl-10 h-10"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer accent-brand-600"
          />
          <span className="text-sm text-slate-700">無効化されたカテゴリも表示</span>
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-sm text-slate-500 mb-4">
            {search
              ? '該当するカテゴリが見つかりません'
              : 'この店舗にはまだカテゴリが登録されていません'}
          </div>
          {!search && canWrite && (
            <button
              onClick={() => setDialogState({ mode: 'create' })}
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              最初のカテゴリを追加
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[64px_1fr_120px_100px_180px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <div className="text-right pr-2">表示順</div>
            <div>カテゴリ名</div>
            <div className="text-right">仕入先数</div>
            <div>ステータス</div>
            <div className="text-right">操作</div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-slate-100">
            {filtered.map((category, idx) => {
              const activeFilteredCount = filtered.filter((c) => c.is_active).length;
              const activeIdx = filtered
                .filter((c) => c.is_active)
                .findIndex((c) => c.id === category.id);
              const canMoveUp = category.is_active && activeIdx > 0;
              const canMoveDown =
                category.is_active && activeIdx >= 0 && activeIdx < activeFilteredCount - 1;

              return (
                <li
                  key={category.id}
                  className={cn(
                    'grid sm:grid-cols-[64px_1fr_120px_100px_180px] gap-2 sm:gap-4 px-5 py-3.5 items-center anim-in',
                    !category.is_active && 'opacity-60 bg-slate-50/50',
                  )}
                  style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
                >
                  {/* Order */}
                  <div className="font-num text-sm text-slate-500 text-right pr-2 hidden sm:block">
                    {category.display_order}
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold text-slate-900 truncate">
                      {category.name}
                    </div>
                    <div className="sm:hidden text-[11px] text-slate-500 mt-0.5 font-num">
                      表示順 {category.display_order} · 仕入先 {category.supplier_count} 社
                    </div>
                  </div>

                  {/* Supplier count */}
                  <div className="hidden sm:flex items-center justify-end gap-1.5 text-sm">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-num font-medium text-slate-900">
                      {category.supplier_count}
                    </span>
                    <span className="text-xs text-slate-500">社</span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block">
                    {category.is_active ? (
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
                  <div className="flex items-center justify-end gap-1 col-span-full sm:col-auto">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMove(category.id, 'up')}
                          disabled={!canMoveUp || isPending}
                          aria-label="上へ"
                          className="h-8 w-8"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMove(category.id, 'down')}
                          disabled={!canMoveDown || isPending}
                          aria-label="下へ"
                          className="h-8 w-8"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDialogState({ mode: 'edit', category })}
                          disabled={isPending}
                          className="h-8"
                        >
                          <Edit3 className="w-3 h-3" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(category)}
                          disabled={isPending}
                          className={cn(
                            'h-8',
                            category.is_active
                              ? 'hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700'
                              : 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
                          )}
                        >
                          {category.is_active ? (
                            <PowerOff className="w-3 h-3" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                          <span className="hidden lg:inline">
                            {category.is_active ? '無効化' : '有効化'}
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
        <p>· 仕入カテゴリは店舗ごとに独立しています。同一店舗内でカテゴリ名は重複できません</p>
        <p>· 無効化されたカテゴリは日次入力等の関連画面から非表示になります（過去データは保持）</p>
        <p>· 並べ替えは「↑↓」ボタンで1つずつ移動できます。表示順は編集モーダル内でも直接入力可能</p>
        <p>· 紐づく仕入先がある場合も無効化可能です。物理削除は採用していません</p>
      </div>

      {/* Form Dialog */}
      <CategoryFormDialog
        open={dialogState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setDialogState({ mode: 'closed' });
        }}
        mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
        storeId={selectedStore.id}
        storeName={selectedStore.name}
        category={dialogState.mode === 'edit' ? dialogState.category : null}
        nextDisplayOrder={nextDisplayOrder}
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
              Deactivate Category
            </div>
            <DialogTitle className="font-display text-xl font-bold">カテゴリを無効化</DialogTitle>
            <DialogDescription>
              以下のカテゴリを無効化します。過去データは保持されますが、各画面で非表示になります。
            </DialogDescription>
          </DialogHeader>

          {deactivateTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  {deactivateTarget.supplier_count > 0 ? (
                    <>
                      このカテゴリには <span className="font-bold">{deactivateTarget.supplier_count} 社</span>
                      の仕入先が紐づいています。無効化後、仕入先はカテゴリ未分類状態にはなりませんが、関連画面で見えなくなります。
                    </>
                  ) : (
                    <>「無効化されたカテゴリも表示」をONにすると再有効化できます。</>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">対象カテゴリ</div>
                <div className="font-display text-xl font-bold text-slate-900">
                  {deactivateTarget.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  表示順 {deactivateTarget.display_order} · 仕入先 {deactivateTarget.supplier_count} 社
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
  icon: typeof Layers;
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
