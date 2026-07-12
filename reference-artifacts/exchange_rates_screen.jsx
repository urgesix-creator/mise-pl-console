import React, { useState, useMemo } from 'react';
import { Plus, Edit3, Trash2, X, Check, AlertTriangle, ArrowRight, Coins, Calendar, RefreshCw, TrendingUp, TrendingDown, Globe } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockCurrencies = [
  { id: 'jpy', code: 'JPY', symbol: '¥', name: '日本円', flag: '🇯🇵' },
  { id: 'thb', code: 'THB', symbol: '฿', name: 'タイバーツ', flag: '🇹🇭' },
  { id: 'idr', code: 'IDR', symbol: 'Rp', name: 'インドネシアルピア', flag: '🇮🇩' },
  { id: 'usd', code: 'USD', symbol: '$', name: '米ドル', flag: '🇺🇸' },
];

const initialRates = [
  {
    id: 'r1',
    fromCurrencyId: 'thb',
    toCurrencyId: 'jpy',
    rate: 4.4,
    effectiveDate: '2026-05-01',
    notes: '月初に三菱UFJ TTMで設定',
    daysAgo: 9,
  },
  {
    id: 'r2',
    fromCurrencyId: 'idr',
    toCurrencyId: 'jpy',
    rate: 0.0098,
    effectiveDate: '2026-05-01',
    notes: '月初に三菱UFJ TTMで設定',
    daysAgo: 9,
  },
  {
    id: 'r3',
    fromCurrencyId: 'usd',
    toCurrencyId: 'jpy',
    rate: 152.30,
    effectiveDate: '2026-04-15',
    notes: '海外送金用参考レート',
    daysAgo: 25,
  },
];

// ==================== UTILITIES ====================
const formatRate = (rate) => {
  if (rate >= 1) return rate.toFixed(2);
  if (rate >= 0.01) return rate.toFixed(4);
  return rate.toFixed(6);
};

const formatNumber = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US');
};

// ==================== COMPONENT ====================
export default function ExchangeRatesScreen() {
  const [rates, setRates] = useState(initialRates);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [deleteConfirmRate, setDeleteConfirmRate] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    fromCurrencyId: 'thb',
    toCurrencyId: 'jpy',
    rate: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [toast, setToast] = useState(null);

  const currencyById = useMemo(() => {
    const m = {};
    mockCurrencies.forEach(c => { m[c.id] = c; });
    return m;
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    const oldestDays = rates.length > 0 ? Math.max(...rates.map(r => r.daysAgo)) : 0;
    const newestDays = rates.length > 0 ? Math.min(...rates.map(r => r.daysAgo)) : 0;
    const stale = rates.filter(r => r.daysAgo > 30).length;
    return {
      total: rates.length,
      oldestDays,
      newestDays,
      stale,
    };
  }, [rates]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setForm({
      fromCurrencyId: 'thb',
      toCurrencyId: 'jpy',
      rate: '',
      effectiveDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddModalOpen(true);
  };

  const handleAdd = () => {
    if (!form.rate || Number(form.rate) <= 0) return;
    if (form.fromCurrencyId === form.toCurrencyId) {
      showToast('error', '変換元と変換先が同じです');
      return;
    }
    // Check duplicate
    const existing = rates.find(r =>
      r.fromCurrencyId === form.fromCurrencyId &&
      r.toCurrencyId === form.toCurrencyId
    );
    if (existing) {
      showToast('error', 'この通貨ペアは既に登録されています');
      return;
    }
    const newRate = {
      id: `r_${Date.now()}`,
      fromCurrencyId: form.fromCurrencyId,
      toCurrencyId: form.toCurrencyId,
      rate: Number(form.rate),
      effectiveDate: form.effectiveDate,
      notes: form.notes,
      daysAgo: 0,
    };
    setRates([...rates, newRate]);
    setAddModalOpen(false);
    resetForm();
    const fromCur = currencyById[newRate.fromCurrencyId];
    const toCur = currencyById[newRate.toCurrencyId];
    showToast('success', `${fromCur.code} → ${toCur.code} レートを登録しました`);
  };

  const handleOpenEdit = (r) => {
    setEditingRate(r);
    setForm({
      fromCurrencyId: r.fromCurrencyId,
      toCurrencyId: r.toCurrencyId,
      rate: r.rate.toString(),
      effectiveDate: r.effectiveDate,
      notes: r.notes,
    });
    setEditModalOpen(true);
  };

  const handleEdit = () => {
    if (!editingRate || !form.rate || Number(form.rate) <= 0) return;
    setRates(rates.map(r =>
      r.id === editingRate.id
        ? {
            ...r,
            rate: Number(form.rate),
            effectiveDate: form.effectiveDate,
            notes: form.notes,
            daysAgo: 0, // Just updated
          }
        : r
    ));
    setEditModalOpen(false);
    setEditingRate(null);
    resetForm();
    showToast('success', 'レートを更新しました（過去値は上書きされ保持されません）');
  };

  const handleDelete = () => {
    if (!deleteConfirmRate) return;
    setRates(rates.filter(r => r.id !== deleteConfirmRate.id));
    const fromCur = currencyById[deleteConfirmRate.fromCurrencyId];
    const toCur = currencyById[deleteConfirmRate.toCurrencyId];
    showToast('success', `${fromCur.code} → ${toCur.code} のレートを削除しました`);
    setDeleteConfirmRate(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
        
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        .font-display { font-family: 'Bricolage Grotesque', 'Noto Sans JP', sans-serif; letter-spacing: -0.02em; }
        .font-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #0F172A;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.25s ease-out; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-card { animation: fadeIn 0.4s ease-out backwards; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="font-display text-white text-lg font-bold">K</span>
            </div>
            <div>
              <div className="font-display text-base font-bold text-slate-900 leading-tight">Sales Console</div>
              <div className="text-[11px] text-slate-500 tracking-widest uppercase">KOGA Holdings</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center text-xs text-slate-500 gap-2">
              <span>管理メニュー</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-medium">為替レート</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              比
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Master Data · Exchange Rates</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                為替レート
              </h1>
              <p className="text-sm text-slate-600">
                JPY換算用の為替レートを手動で管理。<span className="font-semibold text-slate-900">月末レート方式</span>で当月の全データに統一適用されます。
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              新規レートを登録
            </button>
          </div>
        </div>

        {/* Simplification notice */}
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">運用ルール（月末レート方式）：</span>登録レートは「当月のJPY換算レート」として機能し、当月の全データに統一適用されます。月途中で更新した場合、当月の過去データも遡って新レートで再計算されます。月末に確定レートを設定する運用が推奨です。
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="登録ペア" value={stats.total} unit="ペア" icon={Globe} />
          <StatCard label="最新更新" value={stats.newestDays === 0 ? '今日' : `${stats.newestDays}日前`} icon={RefreshCw} />
          <StatCard label="最古更新" value={stats.oldestDays === 0 ? '今日' : `${stats.oldestDays}日前`} icon={Calendar} />
          <StatCard
            label="要更新（30日超）"
            value={stats.stale}
            unit="ペア"
            icon={AlertTriangle}
            highlight={stats.stale > 0 ? 'warning' : 'normal'}
          />
        </div>

        {/* Rate Cards */}
        {rates.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Coins className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm text-slate-500 mb-4">
              まだ為替レートが登録されていません
            </div>
            <button onClick={handleOpenAdd} className="text-sm font-medium text-slate-900 hover:underline">
              最初のレートを登録
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rates.map((r, idx) => {
              const fromCur = currencyById[r.fromCurrencyId];
              const toCur = currencyById[r.toCurrencyId];
              const isStale = r.daysAgo > 30;
              const isFresh = r.daysAgo <= 7;
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 transition-all anim-card"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* From */}
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-base">{fromCur?.flag}</span>
                            <span className="font-display text-base font-bold text-slate-900">{fromCur?.code}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{fromCur?.name}</div>
                        </div>
                        {/* Arrow */}
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                        {/* To */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-base">{toCur?.flag}</span>
                            <span className="font-display text-base font-bold text-slate-900">{toCur?.code}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{toCur?.name}</div>
                        </div>
                      </div>
                      {/* Status badge */}
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isStale
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : isFresh
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {isStale ? '要更新' : isFresh ? '最新' : '通常'}
                      </div>
                    </div>

                    {/* Big rate display */}
                    <div className="text-center py-4 bg-slate-50 rounded-xl">
                      <div className="text-xs text-slate-500 mb-1.5">
                        1 {fromCur?.code} =
                      </div>
                      <div className="font-num text-4xl font-bold text-slate-900 mb-1">
                        {formatRate(r.rate)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {toCur?.code}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    {/* Sample conversion */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">変換例</div>
                      <div className="space-y-1.5">
                        <SampleRow
                          fromAmount={1000}
                          toAmount={1000 * r.rate}
                          fromSymbol={fromCur?.symbol}
                          toSymbol={toCur?.symbol}
                        />
                        <SampleRow
                          fromAmount={10000}
                          toAmount={10000 * r.rate}
                          fromSymbol={fromCur?.symbol}
                          toSymbol={toCur?.symbol}
                        />
                        <SampleRow
                          fromAmount={100000}
                          toAmount={100000 * r.rate}
                          fromSymbol={fromCur?.symbol}
                          toSymbol={toCur?.symbol}
                        />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">設定日</span>
                        <span className="font-num font-medium text-slate-900">{r.effectiveDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">最終更新</span>
                        <span className="font-medium text-slate-900">{r.daysAgo === 0 ? '今日' : `${r.daysAgo}日前`}</span>
                      </div>
                      {r.notes && (
                        <div className="pt-1.5 border-t border-slate-100">
                          <div className="text-slate-500 mb-0.5">備考</div>
                          <div className="text-slate-700">{r.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(r)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-white text-xs font-medium text-slate-700 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      レート更新
                    </button>
                    <button
                      onClick={() => setDeleteConfirmRate(r)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-xs font-medium text-slate-700 hover:text-rose-700 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help text */}
        <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· <span className="font-medium text-slate-700">月末レート方式</span>：登録されたレートは当月の全データに統一適用されます</p>
          <p>· 月途中で更新した場合、当月の過去データも遡って新レートで再計算されます（月内のJPY表示は暫定値）</p>
          <p>· 月次PLの確定値が必要な場合は、月末にレートを更新してから生成してください</p>
          <p>· 更新源は経営層の判断（三菱UFJ TTM・XE.com等）。MVPでは外部APIによる自動取得は行いません</p>
          <p>· 30日以上更新されていないペアは「要更新」アラートが表示されます</p>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 anim-in">
          <div className={`rounded-lg px-5 py-3 flex items-center gap-3 shadow-2xl ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModalOpen && (
        <RateFormModal
          mode="add"
          form={form}
          setForm={setForm}
          currencyById={currencyById}
          onClose={() => { setAddModalOpen(false); resetForm(); }}
          onSubmit={handleAdd}
        />
      )}

      {/* Edit Modal */}
      {editModalOpen && editingRate && (
        <RateFormModal
          mode="edit"
          editingRate={editingRate}
          form={form}
          setForm={setForm}
          currencyById={currencyById}
          onClose={() => { setEditModalOpen(false); setEditingRate(null); resetForm(); }}
          onSubmit={handleEdit}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirmRate && (
        <ModalShell title="削除の確認" subtitle="Confirm Delete" onClose={() => setDeleteConfirmRate(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                為替レートを削除すると、JPY換算機能が一時的に動作しなくなる可能性があります。
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-700 mb-2">以下のレートを削除します：</div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-base">{currencyById[deleteConfirmRate.fromCurrencyId]?.flag}</span>
                  <span className="font-display text-base font-bold text-slate-900">{currencyById[deleteConfirmRate.fromCurrencyId]?.code}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="text-base">{currencyById[deleteConfirmRate.toCurrencyId]?.flag}</span>
                  <span className="font-display text-base font-bold text-slate-900">{currencyById[deleteConfirmRate.toCurrencyId]?.code}</span>
                </div>
                <div className="font-num text-sm font-bold text-slate-900">
                  1 {currencyById[deleteConfirmRate.fromCurrencyId]?.code} = {formatRate(deleteConfirmRate.rate)} {currencyById[deleteConfirmRate.toCurrencyId]?.code}
                </div>
              </div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setDeleteConfirmRate(null)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
            >
              削除する
            </button>
          </ModalFooter>
        </ModalShell>
      )}
    </div>
  );
}

// ==================== RATE FORM MODAL ====================
function RateFormModal({ mode, editingRate, form, setForm, currencyById, onClose, onSubmit }) {
  const update = (field, value) => setForm({ ...form, [field]: value });
  const fromCur = currencyById[form.fromCurrencyId];
  const toCur = currencyById[form.toCurrencyId];
  const sampleAmount = 10000;
  const sampleResult = form.rate ? sampleAmount * Number(form.rate) : 0;

  return (
    <ModalShell
      title={mode === 'add' ? '新規レートを登録' : 'レートを更新'}
      subtitle={mode === 'add' ? 'Add Rate' : 'Update Rate'}
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Currency pair (only editable on add) */}
        {mode === 'add' ? (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                変換元
              </label>
              <select
                value={form.fromCurrencyId}
                onChange={(e) => update('fromCurrencyId', e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                {mockCurrencies.map(c => (
                  <option key={c.id} value={c.id}>{c.flag} {c.code}</option>
                ))}
              </select>
            </div>
            <div className="pb-3">
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                変換先
              </label>
              <select
                value={form.toCurrencyId}
                onChange={(e) => update('toCurrencyId', e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                {mockCurrencies.map(c => (
                  <option key={c.id} value={c.id}>{c.flag} {c.code}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500 mb-2">対象通貨ペア</div>
            <div className="flex items-center gap-3">
              <span className="text-base">{fromCur?.flag}</span>
              <span className="font-display text-base font-bold text-slate-900">{fromCur?.code}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="text-base">{toCur?.flag}</span>
              <span className="font-display text-base font-bold text-slate-900">{toCur?.code}</span>
            </div>
          </div>
        )}

        {/* Rate */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
            レート（1 {fromCur?.code} あたりの {toCur?.code}） <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={form.rate}
            onChange={(e) => update('rate', e.target.value)}
            placeholder="例：4.4"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-right font-num text-lg font-bold bg-white"
            autoFocus
          />
          {form.rate && Number(form.rate) > 0 && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
              <div className="text-xs text-indigo-700">
                <span className="font-num font-bold">{formatNumber(sampleAmount)} {fromCur?.code}</span>
                {' = '}
                <span className="font-num font-bold">{formatNumber(Math.round(sampleResult * 100) / 100)} {toCur?.code}</span>
              </div>
            </div>
          )}
        </div>

        {/* Effective date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
            設定日
          </label>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={(e) => update('effectiveDate', e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
            備考（任意）
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="例：月初に三菱UFJ TTMで設定"
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
          />
        </div>

        {mode === 'edit' && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">月末レート方式のため：</span>レートを更新すると、当月の全データ（過去入力分も含む）が新レートで遡って再計算されます。月次PLの値も連動して変わります。
            </div>
          </div>
        )}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
          キャンセル
        </button>
        <button
          onClick={onSubmit}
          disabled={!form.rate || Number(form.rate) <= 0}
          className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mode === 'add' ? '登録する' : '更新する'}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

// ==================== SUB COMPONENTS ====================
function StatCard({ label, value, unit, icon: Icon, highlight }) {
  let valueClass = 'text-slate-900';
  if (highlight === 'warning') valueClass = 'text-amber-600';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold truncate">{label}</div>
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${highlight === 'warning' ? 'text-amber-500' : 'text-slate-400'}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <div className={`font-num text-xl sm:text-2xl font-bold ${valueClass}`}>{value}</div>
        {unit && <div className="text-sm text-slate-500">{unit}</div>}
      </div>
    </div>
  );
}

function SampleRow({ fromAmount, toAmount, fromSymbol, toSymbol }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-num text-slate-700">
        {fromSymbol}{formatNumber(fromAmount)}
      </span>
      <ArrowRight className="w-3 h-3 text-slate-400 mx-2" />
      <span className="font-num font-medium text-slate-900">
        {toSymbol}{formatNumber(Math.round(toAmount * 100) / 100)}
      </span>
    </div>
  );
}

function ModalShell({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in my-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div>
            {subtitle && <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{subtitle}</div>}
            <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }) {
  return (
    <div className="px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 -mx-6 -mb-6 mt-6 sticky bottom-0 bg-white rounded-b-2xl">
      {children}
    </div>
  );
}
