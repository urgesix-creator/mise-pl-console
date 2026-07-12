'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Edit3,
  Trash2,
  DollarSign,
  Coins,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Loader2,
  Globe,
  Power,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { RateFormDialog } from './rate-form-dialog';
import { CurrencyFormDialog } from './currency-form-dialog';
import { StaleRateWarningBanner } from './stale-rate-warning-banner';
import {
  deactivateExchangeRate,
  deleteCurrency,
  deleteExchangeRate,
  reactivateExchangeRate,
} from '../actions';
import { WRITE_ROLES } from '../_schemas';
import type { Currency, CurrencyWithMeta, RatePairWithMeta, Role } from './types';

type RateDialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; pair: RatePairWithMeta };

type CurrencyDialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; currency: Currency };

type ExchangeRatesClientProps = {
  ratePairs: RatePairWithMeta[];
  currencies: CurrencyWithMeta[];
  userRole: Role;
  includeInactive: boolean;
  staleRates: RatePairWithMeta[];
};

const STALE_THRESHOLD_DAYS = 30;

function formatRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(4);
  return rate.toFixed(6);
}

export function ExchangeRatesClient({
  ratePairs,
  currencies,
  userRole,
  includeInactive,
  staleRates,
}: ExchangeRatesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rateDialog, setRateDialog] = useState<RateDialogState>({ mode: 'closed' });
  const [currencyDialog, setCurrencyDialog] = useState<CurrencyDialogState>({ mode: 'closed' });
  const [deleteRateTarget, setDeleteRateTarget] = useState<RatePairWithMeta | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<RatePairWithMeta | null>(null);
  const [deleteCurrencyTarget, setDeleteCurrencyTarget] = useState<CurrencyWithMeta | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = (WRITE_ROLES as readonly string[]).includes(userRole);

  const handleIncludeInactiveChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (checked) {
      params.set('includeInactive', '1');
    } else {
      params.delete('includeInactive');
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  };

  const stats = useMemo(
    () => ({
      configuredPairs: ratePairs.filter((p) => p.rate !== null).length,
      unconfiguredInUse: ratePairs.filter((p) => p.rate === null && p.is_in_use_by_store).length,
      stale: ratePairs.filter((p) => p.is_stale).length,
      currencies: currencies.length,
    }),
    [ratePairs, currencies],
  );

  const nextCurrencyOrder = useMemo(() => {
    if (currencies.length === 0) return 1;
    return Math.max(...currencies.map((c) => c.display_order)) + 1;
  }, [currencies]);

  const sortedPairs = useMemo(() => {
    return [...ratePairs].sort((a, b) => {
      // 経過日数の長い順（更新が必要なものを上に）
      const aDays = a.days_since_effective ?? -1;
      const bDays = b.days_since_effective ?? -1;
      // 未設定（rate=null, days=null）と無効を最下部へ
      if ((a.rate === null) !== (b.rate === null)) {
        return a.rate === null ? 1 : -1;
      }
      if (a.is_active === false && b.is_active !== false) return 1;
      if (b.is_active === false && a.is_active !== false) return -1;
      if (aDays !== bDays) return bDays - aDays;
      return a.from_currency.display_order - b.from_currency.display_order;
    });
  }, [ratePairs]);

  const handleConfirmDeleteRate = () => {
    if (!deleteRateTarget?.rate_id) return;
    const id = deleteRateTarget.rate_id;
    startTransition(async () => {
      const result = await deleteExchangeRate(id);
      if (result.success) {
        toast.success('為替レートを削除しました');
        setDeleteRateTarget(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleConfirmDeactivate = () => {
    if (!deactivateTarget?.rate_id) return;
    const id = deactivateTarget.rate_id;
    startTransition(async () => {
      const result = await deactivateExchangeRate(id);
      if (result.success) {
        toast.success('為替レートを無効化しました');
        setDeactivateTarget(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleReactivate = (pair: RatePairWithMeta) => {
    if (!pair.rate_id) return;
    const id = pair.rate_id;
    startTransition(async () => {
      const result = await reactivateExchangeRate(id);
      if (result.success) {
        toast.success('為替レートを再有効化しました');
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleConfirmDeleteCurrency = () => {
    if (!deleteCurrencyTarget) return;
    const id = deleteCurrencyTarget.id;
    startTransition(async () => {
      const result = await deleteCurrency(id);
      if (result.success) {
        toast.success('通貨を削除しました');
        setDeleteCurrencyTarget(null);
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
        <span className="text-slate-900 font-medium">為替レート</span>
      </nav>

      {/* Header */}
      <div className="mb-6 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Master Data · Exchange Rates</span>
        </div>
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
            為替レート
          </h1>
          <p className="text-sm text-slate-600">
            月末レート方式：1ペア1値、当月の全データに統一適用。レート更新時は過去PLが遡って再計算されます
          </p>
        </div>
      </div>

      {/* Stale Warning Banner */}
      <StaleRateWarningBanner staleRates={staleRates} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="設定済" value={stats.configuredPairs} unit="ペア" icon={CheckCircle2} />
        <StatCard
          label="未設定（要対応）"
          value={stats.unconfiguredInUse}
          unit="ペア"
          icon={AlertTriangle}
          tone={stats.unconfiguredInUse > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="30日超"
          value={stats.stale}
          unit="ペア"
          icon={Clock}
          tone={stats.stale > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label="通貨数" value={stats.currencies} unit="通貨" icon={Globe} />
      </div>

      {!canWrite && (
        <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
          為替レート・通貨マスタの編集は経営層（executive）または経理（accounting）のみ可能です。閲覧モードで表示しています。
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="rates" className="w-full">
        <TabsList>
          <TabsTrigger value="rates">
            <DollarSign className="w-3.5 h-3.5 mr-1.5" />
            為替レート
          </TabsTrigger>
          <TabsTrigger value="currencies">
            <Coins className="w-3.5 h-3.5 mr-1.5" />
            通貨マスタ
          </TabsTrigger>
        </TabsList>

        {/* Rates Tab */}
        <TabsContent value="rates">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={handleIncludeInactiveChange}
              />
              <Label htmlFor="include-inactive" className="text-xs text-slate-600 cursor-pointer">
                無効も表示
              </Label>
            </div>
            {canWrite && (
              <Button
                onClick={() => setRateDialog({ mode: 'create' })}
                className="bg-brand-600 hover:bg-brand-700"
              >
                <Plus className="w-4 h-4" />
                レートを追加
              </Button>
            )}
          </div>

          {sortedPairs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <div className="text-sm text-slate-500">
                通貨ペアがまだ登録されていません
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_140px_180px_180px_180px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <div>通貨ペア</div>
                <div className="text-right">レート</div>
                <div>基準日 / 経過日数</div>
                <div>メモ</div>
                <div className="text-right">操作</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {sortedPairs.map((pair, idx) => (
                  <li
                    key={`${pair.from_currency.id}-${pair.to_currency.id}`}
                    className={cn(
                      'grid md:grid-cols-[1fr_140px_180px_180px_220px] gap-2 md:gap-4 px-5 py-3.5 items-center anim-in',
                      pair.rate === null && pair.is_in_use_by_store && 'bg-amber-50/30',
                      pair.is_active === false && 'bg-slate-50/60 opacity-70',
                    )}
                    style={{ animationDelay: `${idx * 20}ms`, animationFillMode: 'backwards' }}
                  >
                    {/* Pair */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CurrencyChip currency={pair.from_currency} />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <CurrencyChip currency={pair.to_currency} />
                        {pair.is_in_use_by_store && pair.is_active !== false && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-brand-600 text-white px-1.5 py-0.5 rounded">
                            使用中
                          </span>
                        )}
                        {pair.is_active === false && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            無効
                          </span>
                        )}
                      </div>
                      <a
                        href={`https://www.google.com/search?q=1+${pair.from_currency.code}+to+${pair.to_currency.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-slate-500 hover:text-slate-900 hover:underline underline-offset-2"
                        title={`Google で 1 ${pair.from_currency.code} → ${pair.to_currency.code} の相場を確認`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Googleで相場を確認（1 {pair.from_currency.code} → {pair.to_currency.code}）
                      </a>
                      <div className="text-[11px] text-slate-500 mt-1 md:hidden">
                        {pair.rate !== null
                          ? `1 ${pair.from_currency.code} = ${formatRate(pair.rate)} ${pair.to_currency.code}`
                          : '— 未設定'}
                        {pair.is_stale && pair.days_since_effective !== null && (
                          <span className="text-rose-700 font-semibold ml-2">
                            ⚠️ {pair.days_since_effective}日経過
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="hidden md:block text-right">
                      {pair.rate !== null ? (
                        <div className="font-num font-bold text-slate-900">{formatRate(pair.rate)}</div>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold">未設定</span>
                      )}
                    </div>

                    {/* Effective date */}
                    <div className="hidden md:block">
                      {pair.effective_date ? (
                        <>
                          <div className="font-num text-sm text-slate-700">
                            {pair.effective_date}
                          </div>
                          {pair.days_since_effective !== null && (
                            pair.is_stale ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-num font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                {pair.days_since_effective}日経過
                              </span>
                            ) : (
                              <div className="text-[11px] font-num mt-0.5 text-slate-500">
                                {pair.days_since_effective}日経過
                              </div>
                            )
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="hidden md:block text-xs text-slate-600 truncate" title={pair.notes ?? ''}>
                      {pair.notes || <span className="text-slate-400">—</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 col-span-full md:col-auto">
                      {canWrite && (
                        <>
                          {pair.rate === null ? (
                            <Button
                              size="sm"
                              onClick={() => setRateDialog({ mode: 'edit', pair })}
                              className="h-8 bg-brand-600 hover:bg-brand-700"
                            >
                              <Plus className="w-3 h-3" />
                              レートを設定
                            </Button>
                          ) : pair.is_active === false ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReactivate(pair)}
                                disabled={isPending}
                                className="h-8 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                <RotateCcw className="w-3 h-3" />
                                再有効化
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteRateTarget(pair)}
                                className="h-8 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                aria-label="削除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRateDialog({ mode: 'edit', pair })}
                                className="h-8"
                              >
                                <Edit3 className="w-3 h-3" />
                                更新
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeactivateTarget(pair)}
                                className="h-8 hover:border-slate-400 hover:bg-slate-100"
                                aria-label="無効化"
                                title="無効化"
                              >
                                <Power className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteRateTarget(pair)}
                                className="h-8 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                aria-label="削除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      {!canWrite && pair.rate !== null && (
                        <span className="text-[11px] text-slate-400">閲覧のみ</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Help */}
          <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
            <p>· 月末レート方式：レート更新時、過去全期間の売上・仕入・販管費が新レートで JPY 換算されます</p>
            <p>· 基準日は計算には使用しません（メタ情報）。30日超で要更新アラート対象になります</p>
            <p>· 「未設定（要対応）」は店舗で使用中の通貨にレート未設定のもの。優先的に設定してください</p>
          </div>
        </TabsContent>

        {/* Currencies Tab */}
        <TabsContent value="currencies">
          <div className="flex justify-end mb-3">
            {canWrite && (
              <Button
                onClick={() => setCurrencyDialog({ mode: 'create' })}
                className="bg-brand-600 hover:bg-brand-700"
              >
                <Plus className="w-4 h-4" />
                通貨を追加
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="hidden md:grid grid-cols-[80px_1fr_100px_160px_180px_160px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <div>記号</div>
              <div>名称</div>
              <div>コード</div>
              <div>ID（内部）</div>
              <div>使用状況</div>
              <div className="text-right">操作</div>
            </div>
            <ul className="divide-y divide-slate-100">
              {currencies.map((c) => (
                <li
                  key={c.id}
                  className="grid md:grid-cols-[80px_1fr_100px_160px_180px_160px] gap-2 md:gap-4 px-5 py-3.5 items-center"
                >
                  <div className="font-display text-2xl font-bold text-slate-900">
                    {c.symbol}
                  </div>
                  <div>
                    <div className="font-display text-base font-bold text-slate-900">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-slate-500 md:hidden">
                      {c.code} · {c.id}
                    </div>
                  </div>
                  <div className="hidden md:block font-mono text-sm text-slate-700">
                    {c.code}
                  </div>
                  <div className="hidden md:block font-mono text-xs text-slate-500">{c.id}</div>
                  <div className="hidden md:block text-xs text-slate-600 space-y-0.5">
                    {c.is_used_as_store_currency && (
                      <div className="text-emerald-700 font-medium">店舗で使用中</div>
                    )}
                    {c.rate_pair_count > 0 && (
                      <div className="text-slate-500 font-num">
                        レート参照 {c.rate_pair_count} 件
                      </div>
                    )}
                    {!c.is_used_as_store_currency && c.rate_pair_count === 0 && (
                      <div className="text-slate-400">未使用</div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 col-span-full md:col-auto">
                    {canWrite && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrencyDialog({ mode: 'edit', currency: c })}
                          className="h-8"
                        >
                          <Edit3 className="w-3 h-3" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteCurrencyTarget(c)}
                          disabled={c.is_used_as_store_currency || c.rate_pair_count > 0}
                          title={
                            c.is_used_as_store_currency
                              ? '店舗で使用中のため削除不可'
                              : c.rate_pair_count > 0
                                ? '為替レートで参照されているため削除不可'
                                : undefined
                          }
                          className="h-8 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          aria-label="削除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
            <p>· 通貨IDは小文字英字（例：thb）、作成後変更不可。コードは ISO 4217 大文字推奨</p>
            <p>· 店舗で使用中、または為替レートで参照されている通貨は削除できません</p>
            <p>· 通貨追加 → 為替レートタブで「新規通貨ペア」を作成 → レート設定の流れ</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rate Dialog */}
      <RateFormDialog
        open={rateDialog.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setRateDialog({ mode: 'closed' });
        }}
        mode={rateDialog.mode === 'edit' ? 'edit' : 'create'}
        pair={rateDialog.mode === 'edit' ? rateDialog.pair : null}
        currencies={currencies}
      />

      {/* Currency Dialog */}
      <CurrencyFormDialog
        open={currencyDialog.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setCurrencyDialog({ mode: 'closed' });
        }}
        mode={currencyDialog.mode === 'edit' ? 'edit' : 'create'}
        currency={currencyDialog.mode === 'edit' ? currencyDialog.currency : null}
        nextDisplayOrder={nextCurrencyOrder}
      />

      {/* Deactivate Rate Confirm */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeactivateTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-semibold mb-1">
              Deactivate Exchange Rate
            </div>
            <DialogTitle className="font-display text-xl font-bold">為替レートを無効化</DialogTitle>
            <DialogDescription>
              このペアを「無効」状態にします。一覧の通常表示から外れますが、レコードは残ります（再有効化可能）。
            </DialogDescription>
          </DialogHeader>

          {deactivateTarget && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="font-bold mb-1">
                1 {deactivateTarget.from_currency.code} ={' '}
                {deactivateTarget.rate !== null ? formatRate(deactivateTarget.rate) : '?'}{' '}
                {deactivateTarget.to_currency.code}
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                基準日: {deactivateTarget.effective_date ?? '—'}
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
            <Button onClick={handleConfirmDeactivate} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              無効化する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rate Confirm */}
      <Dialog
        open={deleteRateTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleteRateTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.2em] text-rose-600 font-semibold mb-1">
              Delete Exchange Rate
            </div>
            <DialogTitle className="font-display text-xl font-bold">為替レートを削除</DialogTitle>
            <DialogDescription>
              このペアの為替レートを削除します。該当ペアを使用する PL の JPY 換算は不可能になります（再設定するまで）。
            </DialogDescription>
          </DialogHeader>

          {deleteRateTarget && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <div className="font-bold mb-1">
                  1 {deleteRateTarget.from_currency.code} = {deleteRateTarget.rate !== null ? formatRate(deleteRateTarget.rate) : '?'} {deleteRateTarget.to_currency.code}
                </div>
                <div className="text-xs leading-relaxed">
                  通常はレート削除ではなく更新を推奨。本当に削除しますか？
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteRateTarget(null)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteRate} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Currency Confirm */}
      <Dialog
        open={deleteCurrencyTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleteCurrencyTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.2em] text-rose-600 font-semibold mb-1">
              Delete Currency
            </div>
            <DialogTitle className="font-display text-xl font-bold">通貨を削除</DialogTitle>
            <DialogDescription>
              通貨マスタからこの通貨を削除します。
            </DialogDescription>
          </DialogHeader>

          {deleteCurrencyTarget && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="font-display text-lg font-bold text-slate-900">
                {deleteCurrencyTarget.symbol} {deleteCurrencyTarget.name}（{deleteCurrencyTarget.code}）
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                ID: {deleteCurrencyTarget.id}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteCurrencyTarget(null)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteCurrency}
              disabled={isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CurrencyChip({ currency }: { currency: Currency }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-display text-base font-bold text-slate-900">{currency.symbol}</span>
      <span className="font-mono text-sm text-slate-700">{currency.code}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  unit: string;
  icon: typeof CheckCircle2;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4',
        tone === 'warning' && value > 0
          ? 'border-amber-300 bg-amber-50/40'
          : 'border-slate-200',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold truncate">
          {label}
        </div>
        <Icon
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0',
            tone === 'warning' && value > 0 ? 'text-amber-600' : 'text-slate-400',
          )}
        />
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className={cn(
            'font-num text-2xl font-bold',
            tone === 'warning' && value > 0 ? 'text-amber-900' : 'text-slate-900',
          )}
        >
          {value}
        </div>
        <div className="text-sm text-slate-500">{unit}</div>
      </div>
    </div>
  );
}
