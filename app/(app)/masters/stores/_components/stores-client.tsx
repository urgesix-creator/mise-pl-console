'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit3,
  Power,
  PowerOff,
  Store as StoreIcon,
  Coins,
  Clock,
  Percent,
  CloudSun,
  Sparkles,
  Sun,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { StoreFormDialog } from './store-form-dialog';
import { setStoreActive } from '../actions';
import type { Country, Currency, Store } from './types';

type StoresClientProps = {
  stores: Store[];
  countries: Country[];
  currencies: Currency[];
  isExecutive: boolean;
};

type DialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; store: Store };

export function StoresClient({ stores, countries, currencies, isExecutive }: StoresClientProps) {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' });
  const [deactivateTarget, setDeactivateTarget] = useState<Store | null>(null);
  const [isPending, startTransition] = useTransition();

  const countryById = useMemo(() => {
    const m: Record<string, Country> = {};
    countries.forEach((c) => (m[c.id] = c));
    return m;
  }, [countries]);

  const currencyById = useMemo(() => {
    const m: Record<string, Currency> = {};
    currencies.forEach((c) => (m[c.id] = c));
    return m;
  }, [currencies]);

  const filtered = useMemo(() => {
    return stores
      .filter((s) => showInactive || s.is_active)
      .filter((s) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const country = countryById[s.country_id];
        return (
          s.name.toLowerCase().includes(q) || (country?.name ?? '').toLowerCase().includes(q)
        );
      });
  }, [stores, search, showInactive, countryById]);

  const stats = useMemo(
    () => ({
      total: stores.length,
      active: stores.filter((s) => s.is_active).length,
      countries: new Set(stores.filter((s) => s.is_active).map((s) => s.country_id)).size,
    }),
    [stores],
  );

  const handleToggleActive = (store: Store) => {
    if (store.is_active) {
      setDeactivateTarget(store);
      return;
    }
    startTransition(async () => {
      const result = await setStoreActive(store.id, true);
      if (result.success) {
        toast.success(`「${store.name}」を有効化しました`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    startTransition(async () => {
      const result = await setStoreActive(target.id, false);
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
        <span className="text-slate-900 font-medium">店舗マスタ</span>
      </nav>

      {/* Page header */}
      <div className="mb-8 anim-in">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-3">
          <div className="w-8 h-px bg-slate-300" />
          <span>Master Data · Stores</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
              店舗マスタ
            </h1>
            <p className="text-sm text-slate-600">
              店舗情報・通貨・税制・表示設定の管理
            </p>
          </div>
          {isExecutive && (
            <Button
              onClick={() => setDialogState({ mode: 'create' })}
              size="lg"
              className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-slate-900/10"
            >
              <Plus className="w-4 h-4" />
              新規店舗追加
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="登録店舗" value={stats.total} unit="店" icon={StoreIcon} />
        <StatCard label="有効" value={stats.active} unit="店" icon={Check} />
        <StatCard label="国数" value={stats.countries} unit="ヶ国" icon={Coins} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="店舗名・国で絞り込み..."
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
          <span className="text-sm text-slate-700">無効化された店舗も表示</span>
        </label>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <StoreIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-sm text-slate-500 mb-4">
            {search ? '該当する店舗が見つかりません' : 'まだ店舗が登録されていません'}
          </div>
          {!search && isExecutive && (
            <button
              onClick={() => setDialogState({ mode: 'create' })}
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              最初の店舗を追加
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((store, idx) => (
            <StoreCard
              key={store.id}
              store={store}
              country={countryById[store.country_id]}
              currency={currencyById[store.currency_id]}
              isExecutive={isExecutive}
              onEdit={() => setDialogState({ mode: 'edit', store })}
              onToggleActive={() => handleToggleActive(store)}
              isPending={isPending}
              animDelay={idx * 60}
            />
          ))}
        </div>
      )}

      {/* Help */}
      <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
        <p>· 店舗を無効化すると、すべての関連画面（日次入力・売上目標・データ閲覧）から非表示になります（過去データは保持）</p>
        <p>· サービス料率の変更は次回入力分から適用されます（過去データには影響しません）</p>
        <p>· 国の変更は税制も変わるため慎重に。基本的には開業時に設定して以降変更しない想定です</p>
      </div>

      {/* Form Dialog */}
      <StoreFormDialog
        open={dialogState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setDialogState({ mode: 'closed' });
        }}
        mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
        store={dialogState.mode === 'edit' ? dialogState.store : null}
        stores={stores.filter((s) => s.is_active)}
        countries={countries}
        currencies={currencies}
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
              Deactivate Store
            </div>
            <DialogTitle className="font-display text-xl font-bold">店舗を無効化</DialogTitle>
            <DialogDescription>
              以下の店舗を無効化します。過去データは保持されますが、各画面に表示されなくなります。
            </DialogDescription>
          </DialogHeader>

          {deactivateTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  無効化後は「無効化された店舗も表示」をオンにすると再有効化できます。
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">対象店舗</div>
                <div className="font-display text-xl font-bold text-slate-900">
                  {deactivateTarget.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {countryById[deactivateTarget.country_id]?.name} ·{' '}
                  {currencyById[deactivateTarget.currency_id]?.code}
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
            <Button
              variant="destructive"
              onClick={confirmDeactivate}
              disabled={isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              無効化する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoreCard({
  store,
  country,
  currency,
  isExecutive,
  onEdit,
  onToggleActive,
  isPending,
  animDelay,
}: {
  store: Store;
  country?: Country;
  currency?: Currency;
  isExecutive: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  isPending: boolean;
  animDelay: number;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all anim-in',
        store.is_active
          ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5'
          : 'border-slate-200 bg-slate-50 opacity-75',
      )}
      style={{ animationDelay: `${animDelay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{country?.flag ?? '🏳️'}</span>
              <span className="font-num text-[11px] font-bold tracking-wider text-slate-900 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                {String(store.store_no).padStart(3, '0')}
              </span>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {country?.name ?? store.country_id.toUpperCase()}
              </div>
              {!store.is_active && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                  停止中
                </span>
              )}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-tight truncate">
              {store.name}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill icon={Coins}>
            <span className="font-num font-medium">{currency?.code ?? store.currency_id.toUpperCase()}</span>
            {currency?.symbol && <span className="text-slate-400">{currency.symbol}</span>}
          </Pill>
          <Pill icon={Clock}>{store.timezone.split('/')[1] ?? store.timezone}</Pill>
          {store.established_date && (
            <Pill icon={Sparkles}>
              開業 <span className="font-num">{store.established_date.slice(0, 7)}</span>
            </Pill>
          )}
        </div>
      </div>

      {/* Params */}
      <div className="p-5 sm:p-6 space-y-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            税制・サービス料
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ParamBox
              icon={Percent}
              label="サービス料"
              value={`${(store.service_fee_rate * 100).toFixed(0)}%`}
            />
            <ParamBox
              icon={Percent}
              label={country?.tax_label ?? '税'}
              value={`${((country?.tax_rate ?? 0) * 100).toFixed(0)}%`}
              subtext={
                country?.tax_base === 'net_plus_service' ? '税抜+サービス料 課税' : '税抜売上 課税'
              }
            />
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            入力画面の設定
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FeatureTile icon={CloudSun} label="天気" enabled={store.is_weather_enabled} />
            <FeatureTile icon={Sparkles} label="イベント" enabled={store.is_event_enabled} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          表示順 <span className="font-num font-medium text-slate-700">{store.display_order}</span>
        </div>
        <div className="flex items-center gap-2">
          {isExecutive && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} disabled={isPending}>
                <Edit3 className="w-3.5 h-3.5" />
                編集
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleActive}
                disabled={isPending}
                className={
                  store.is_active
                    ? 'hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700'
                    : 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                }
              >
                {store.is_active ? (
                  <>
                    <PowerOff className="w-3.5 h-3.5" />
                    無効化
                  </>
                ) : (
                  <>
                    <Power className="w-3.5 h-3.5" />
                    有効化
                  </>
                )}
              </Button>
            </>
          )}
          {!isExecutive && (
            <div className="text-[11px] text-slate-400">編集権限なし</div>
          )}
        </div>
      </div>
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
  icon: typeof StoreIcon;
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

function Pill({ icon: Icon, children }: { icon: typeof Coins; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700">
      <Icon className="w-3 h-3 text-slate-400" />
      <span>{children}</span>
    </div>
  );
}

function ParamBox({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: typeof Percent;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <div className="font-num text-base font-bold text-slate-900">{value}</div>
      {subtext && <div className="text-[10px] text-slate-500 mt-0.5">{subtext}</div>}
    </div>
  );
}

function FeatureTile({
  icon: Icon,
  label,
  enabled,
}: {
  icon: typeof Sun;
  label: string;
  enabled: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-colors',
        enabled
          ? 'border-slate-900 bg-brand-600 text-white'
          : 'border-slate-200 bg-white text-slate-400',
      )}
    >
      <Icon className="w-4 h-4" />
      <div className="text-[10px] font-medium tracking-wider uppercase">{label}</div>
      <div className={cn('text-[9px] font-bold', enabled ? 'text-emerald-300' : 'text-slate-400')}>
        {enabled ? 'ON' : 'OFF'}
      </div>
    </div>
  );
}
