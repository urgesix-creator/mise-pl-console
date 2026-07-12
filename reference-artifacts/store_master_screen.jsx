import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit3, Trash2, X, Check, AlertTriangle, Store, MapPin, Coins, Clock, Percent, CloudSun, Sparkles, Sun, Moon, Power, Globe, ChevronDown, Activity } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockCountries = [
  { id: 'th', name: 'タイ', code: 'TH', flag: '🇹🇭', taxRate: 0.07, taxBase: 'net_sales', taxLabel: 'VAT' },
  { id: 'id', name: 'インドネシア', code: 'ID', flag: '🇮🇩', taxRate: 0.10, taxBase: 'net_plus_service', taxLabel: 'PB1' },
  { id: 'jp', name: '日本', code: 'JP', flag: '🇯🇵', taxRate: 0.10, taxBase: 'net_sales', taxLabel: '消費税' },
];

const mockCurrencies = [
  { id: 'thb', code: 'THB', symbol: '฿', name: 'タイバーツ' },
  { id: 'idr', code: 'IDR', symbol: 'Rp', name: 'インドネシアルピア' },
  { id: 'jpy', code: 'JPY', symbol: '¥', name: '日本円' },
];

const mockTimezones = [
  { id: 'Asia/Bangkok', label: 'バンコク (UTC+7)' },
  { id: 'Asia/Jakarta', label: 'ジャカルタ (UTC+7)' },
  { id: 'Asia/Tokyo', label: '東京 (UTC+9)' },
];

const initialStores = [
  {
    id: 'store_aoki_thai',
    name: 'あお季タイ',
    countryId: 'th',
    currencyId: 'thb',
    timezone: 'Asia/Bangkok',
    serviceFeeRate: 0.10,
    isLunchDinnerSplit: false,
    isWeatherEnabled: true,
    isEventEnabled: false,
    isActive: true,
    transactionCount: 145,
    establishedDate: '2018-04',
    suppliersCount: 17,
    categoriesCount: 10,
  },
  {
    id: 'store_aoki_robata',
    name: 'AOKI ロバタ',
    countryId: 'th',
    currencyId: 'thb',
    timezone: 'Asia/Bangkok',
    serviceFeeRate: 0.10,
    isLunchDinnerSplit: false,
    isWeatherEnabled: true,
    isEventEnabled: false,
    isActive: true,
    transactionCount: 32,
    establishedDate: '2024-09',
    suppliersCount: 3,
    categoriesCount: 3,
  },
  {
    id: 'store_hakata_tenjin',
    name: '博多天神ジャカルタ',
    countryId: 'id',
    currencyId: 'idr',
    timezone: 'Asia/Jakarta',
    serviceFeeRate: 0.10,
    isLunchDinnerSplit: true,
    isWeatherEnabled: false,
    isEventEnabled: true,
    isActive: true,
    transactionCount: 89,
    establishedDate: '2020-06',
    suppliersCount: 7,
    categoriesCount: 5,
  },
];

// ==================== COMPONENT ====================
export default function StoreMasterScreen() {
  const [stores, setStores] = useState(initialStores);
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [deleteConfirmStore, setDeleteConfirmStore] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    countryId: 'th',
    currencyId: 'thb',
    timezone: 'Asia/Bangkok',
    serviceFeeRate: 10,
    isLunchDinnerSplit: false,
    isWeatherEnabled: true,
    isEventEnabled: false,
    isActive: true,
  });

  const [toast, setToast] = useState(null);

  const countryById = useMemo(() => {
    const m = {};
    mockCountries.forEach(c => { m[c.id] = c; });
    return m;
  }, []);
  const currencyById = useMemo(() => {
    const m = {};
    mockCurrencies.forEach(c => { m[c.id] = c; });
    return m;
  }, []);

  const filteredStores = useMemo(() => {
    return stores
      .filter(s => !showActiveOnly || s.isActive)
      .filter(s => {
        if (search === '') return true;
        const q = search.toLowerCase();
        const country = countryById[s.countryId];
        return s.name.toLowerCase().includes(q) ||
          (country?.name || '').includes(search);
      });
  }, [stores, search, showActiveOnly, countryById]);

  const stats = useMemo(() => {
    const total = stores.length;
    const active = stores.filter(s => s.isActive).length;
    const countries = new Set(stores.map(s => s.countryId)).size;
    const totalSuppliers = stores.reduce((sum, s) => sum + s.suppliersCount, 0);
    return { total, active, countries, totalSuppliers };
  }, [stores]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setForm({
      name: '',
      countryId: 'th',
      currencyId: 'thb',
      timezone: 'Asia/Bangkok',
      serviceFeeRate: 10,
      isLunchDinnerSplit: false,
      isWeatherEnabled: true,
      isEventEnabled: false,
      isActive: true,
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddModalOpen(true);
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const newStore = {
      id: `store_${Date.now()}`,
      name: form.name.trim(),
      countryId: form.countryId,
      currencyId: form.currencyId,
      timezone: form.timezone,
      serviceFeeRate: Number(form.serviceFeeRate) / 100,
      isLunchDinnerSplit: form.isLunchDinnerSplit,
      isWeatherEnabled: form.isWeatherEnabled,
      isEventEnabled: form.isEventEnabled,
      isActive: form.isActive,
      transactionCount: 0,
      establishedDate: new Date().toISOString().slice(0, 7),
      suppliersCount: 0,
      categoriesCount: 0,
    };
    setStores([...stores, newStore]);
    setAddModalOpen(false);
    resetForm();
    showToast('success', `「${newStore.name}」を追加しました`);
  };

  const handleOpenEdit = (s) => {
    setEditingStore(s);
    setForm({
      name: s.name,
      countryId: s.countryId,
      currencyId: s.currencyId,
      timezone: s.timezone,
      serviceFeeRate: Math.round(s.serviceFeeRate * 100),
      isLunchDinnerSplit: s.isLunchDinnerSplit,
      isWeatherEnabled: s.isWeatherEnabled,
      isEventEnabled: s.isEventEnabled,
      isActive: s.isActive,
    });
    setEditModalOpen(true);
  };

  const handleEdit = () => {
    if (!editingStore || !form.name.trim()) return;
    setStores(stores.map(s =>
      s.id === editingStore.id
        ? {
            ...s,
            name: form.name.trim(),
            countryId: form.countryId,
            currencyId: form.currencyId,
            timezone: form.timezone,
            serviceFeeRate: Number(form.serviceFeeRate) / 100,
            isLunchDinnerSplit: form.isLunchDinnerSplit,
            isWeatherEnabled: form.isWeatherEnabled,
            isEventEnabled: form.isEventEnabled,
            isActive: form.isActive,
          }
        : s
    ));
    setEditModalOpen(false);
    setEditingStore(null);
    resetForm();
    showToast('success', '変更を保存しました');
  };

  const handleToggleActive = (id) => {
    setStores(stores.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  };

  const handleDelete = () => {
    if (!deleteConfirmStore) return;
    setStores(stores.filter(s => s.id !== deleteConfirmStore.id));
    showToast('success', `「${deleteConfirmStore.name}」を削除しました`);
    setDeleteConfirmStore(null);
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
              <span className="text-slate-900 font-medium">店舗</span>
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
            <span>Master Data · Stores</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                店舗
              </h1>
              <p className="text-sm text-slate-600">
                すべてのマスタ（カテゴリ・仕入先・販管費科目）の親。店舗ごとのパラメータをここで管理します。
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              新規店舗を追加
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="登録店舗" value={stats.total} unit="店" icon={Store} />
          <StatCard label="有効" value={stats.active} unit="店" icon={Check} />
          <StatCard label="国数" value={stats.countries} unit="ヶ国" icon={Globe} />
          <StatCard label="紐付く仕入先" value={stats.totalSuppliers} unit="社" icon={Activity} />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="店舗名・国で絞り込み..."
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-slate-900"
            />
            <span className="text-sm text-slate-700">有効のみ表示</span>
          </label>
        </div>

        {/* Store Cards Grid */}
        {filteredStores.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Store className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm text-slate-500 mb-4">
              {search ? '該当する店舗が見つかりません' : 'まだ店舗が登録されていません'}
            </div>
            {!search && (
              <button onClick={handleOpenAdd} className="text-sm font-medium text-slate-900 hover:underline">
                最初の店舗を追加
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredStores.map((store, idx) => {
              const country = countryById[store.countryId];
              const currency = currencyById[store.currencyId];
              return (
                <div
                  key={store.id}
                  className={`rounded-2xl border transition-all anim-card ${
                    store.isActive
                      ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5'
                      : 'border-slate-200 bg-slate-50 opacity-75'
                  }`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {/* Card header */}
                  <div className="p-5 sm:p-6 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{country?.flag}</span>
                          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            {country?.name}
                          </div>
                        </div>
                        <h2 className="font-display text-2xl font-bold text-slate-900 leading-tight truncate">
                          {store.name}
                        </h2>
                      </div>
                      <button
                        onClick={() => handleToggleActive(store.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                          store.isActive ? 'bg-slate-900' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            store.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Meta info pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill icon={Coins}>
                        <span className="font-num font-medium">{currency?.code}</span>
                        <span className="text-slate-400">{currency?.symbol}</span>
                      </Pill>
                      <Pill icon={Clock}>{store.timezone.split('/')[1]}</Pill>
                      <Pill icon={Activity}>
                        <span className="font-num font-medium">{store.transactionCount}</span> 取引
                      </Pill>
                    </div>
                  </div>

                  {/* Parameters */}
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Tax & Service */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        税制・サービス料
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <ParamBox
                          icon={Percent}
                          label="サービス料"
                          value={`${(store.serviceFeeRate * 100).toFixed(0)}%`}
                        />
                        <ParamBox
                          icon={Percent}
                          label={country?.taxLabel || '税'}
                          value={`${((country?.taxRate || 0) * 100).toFixed(0)}%`}
                          subtext={country?.taxBase === 'net_plus_service' ? '税抜+サービス料 課税' : '税抜売上 課税'}
                        />
                      </div>
                    </div>

                    {/* Display options */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        入力画面の設定
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <FeatureToggle
                          icon={store.isLunchDinnerSplit ? Sun : Moon}
                          label="昼夜分離"
                          enabled={store.isLunchDinnerSplit}
                        />
                        <FeatureToggle
                          icon={CloudSun}
                          label="天気"
                          enabled={store.isWeatherEnabled}
                        />
                        <FeatureToggle
                          icon={Sparkles}
                          label="イベント"
                          enabled={store.isEventEnabled}
                        />
                      </div>
                    </div>

                    {/* Master cluster info */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">カテゴリ：</span>
                          <span className="font-num font-medium text-slate-900">{store.categoriesCount}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">仕入先：</span>
                          <span className="font-num font-medium text-slate-900">{store.suppliersCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      開業: <span className="font-num font-medium text-slate-700">{store.establishedDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(store)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-white text-xs font-medium text-slate-700 flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        編集
                      </button>
                      <button
                        onClick={() => setDeleteConfirmStore(store)}
                        disabled={store.transactionCount > 0}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-xs font-medium text-slate-700 hover:text-rose-700 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-slate-200 disabled:hover:text-slate-700"
                        title={store.transactionCount > 0 ? '取引履歴があるため削除できません（無効化のみ可）' : '削除'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help text */}
        <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 店舗を無効化すると、すべての関連画面（日次入力・売上目標・データ閲覧）から非表示になります（過去データは保持）</p>
          <p>· 取引履歴がある店舗は削除できません（無効化のみ可、データ整合性を守るため）</p>
          <p>· サービス料率の変更は次回入力分から適用されます（過去データには影響しません）</p>
          <p>· 国の変更は税制も変わるため慎重に。基本的には開業時に設定して以降変更しない想定です</p>
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
        <StoreFormModal
          mode="add"
          form={form}
          setForm={setForm}
          onClose={() => { setAddModalOpen(false); resetForm(); }}
          onSubmit={handleAdd}
        />
      )}

      {/* Edit Modal */}
      {editModalOpen && editingStore && (
        <StoreFormModal
          mode="edit"
          editingStore={editingStore}
          form={form}
          setForm={setForm}
          onClose={() => { setEditModalOpen(false); setEditingStore(null); resetForm(); }}
          onSubmit={handleEdit}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirmStore && (
        <ModalShell title="削除の確認" subtitle="Confirm Delete" onClose={() => setDeleteConfirmStore(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                店舗を削除すると、配下のすべてのマスタ（カテゴリ・仕入先・販管費科目）も削除されます。この操作は取り消せません。
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-700">以下の店舗を削除します：</div>
              <div className="font-display text-xl font-bold text-slate-900 mt-2">
                {deleteConfirmStore.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {countryById[deleteConfirmStore.countryId]?.name} · カテゴリ {deleteConfirmStore.categoriesCount} · 仕入先 {deleteConfirmStore.suppliersCount}
              </div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setDeleteConfirmStore(null)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
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

// ==================== STORE FORM MODAL ====================
function StoreFormModal({ mode, editingStore, form, setForm, onClose, onSubmit }) {
  const country = mockCountries.find(c => c.id === form.countryId);

  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <ModalShell
      title={mode === 'add' ? '新規店舗を追加' : '店舗を編集'}
      subtitle={mode === 'add' ? 'Add Store' : 'Edit Store'}
      onClose={onClose}
      wide
    >
      <div className="space-y-6">
        {/* Section 1: Basic */}
        <FormSection number="01" title="基本情報">
          <FormField label="店舗名" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="例：あお季タイ、AOKI ロバタ ..."
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="国" required>
              <select
                value={form.countryId}
                onChange={(e) => update('countryId', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                {mockCountries.map(c => (
                  <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="通貨" required>
              <select
                value={form.currencyId}
                onChange={(e) => update('currencyId', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                {mockCurrencies.map(c => (
                  <option key={c.id} value={c.id}>{c.symbol} {c.code} ({c.name})</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="タイムゾーン" required>
            <select
              value={form.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
            >
              {mockTimezones.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </FormField>
        </FormSection>

        {/* Section 2: Tax & Service */}
        <FormSection number="02" title="税制・サービス料">
          <FormField label="サービス料率（%）" required>
            <div className="relative">
              <input
                type="number"
                value={form.serviceFeeRate}
                onChange={(e) => update('serviceFeeRate', e.target.value)}
                min="0"
                max="100"
                step="0.1"
                className="w-full pl-4 pr-12 py-3 border border-slate-200 rounded-lg text-sm bg-white font-num text-right"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
          </FormField>
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">{country?.name}の税制（自動設定）</div>
            <div className="flex items-center gap-3">
              <div className="font-display text-base font-bold text-slate-900">
                {country?.taxLabel} {((country?.taxRate || 0) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-slate-600">
                {country?.taxBase === 'net_plus_service' ? '税抜売上＋サービス料に課税' : '税抜売上のみに課税'}
              </div>
            </div>
          </div>
        </FormSection>

        {/* Section 3: Display options */}
        <FormSection number="03" title="入力画面の設定">
          <div className="space-y-3">
            <FormToggle
              checked={form.isLunchDinnerSplit}
              onChange={(v) => update('isLunchDinnerSplit', v)}
              icon={Sun}
              title="昼夜を分離して入力"
              description="ランチとディナーで別々に売上・客数を記録（ジャカルタ店向け）"
            />
            <FormToggle
              checked={form.isWeatherEnabled}
              onChange={(v) => update('isWeatherEnabled', v)}
              icon={CloudSun}
              title="天気を記録"
              description="日次入力で天気欄を表示（売上分析用）"
            />
            <FormToggle
              checked={form.isEventEnabled}
              onChange={(v) => update('isEventEnabled', v)}
              icon={Sparkles}
              title="イベント・特記事項を記録"
              description="日次入力でメモ欄を表示（プロモ・特殊事象の記録用）"
            />
          </div>
        </FormSection>

        {/* Section 4: Status */}
        <FormSection number="04" title="ステータス">
          <FormToggle
            checked={form.isActive}
            onChange={(v) => update('isActive', v)}
            icon={Power}
            title="この店舗を有効にする"
            description="無効化すると全ての関連画面から非表示になります"
          />
        </FormSection>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
          キャンセル
        </button>
        <button
          onClick={onSubmit}
          disabled={!form.name.trim()}
          className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mode === 'add' ? '追加する' : '保存する'}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

// ==================== SUB COMPONENTS ====================
function StatCard({ label, value, unit, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold truncate">{label}</div>
        <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </div>
      <div className="flex items-baseline gap-1">
        <div className="font-num text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{unit}</div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700">
      <Icon className="w-3 h-3 text-slate-400" />
      <span>{children}</span>
    </div>
  );
}

function ParamBox({ icon: Icon, label, value, subtext }) {
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

function FeatureToggle({ icon: Icon, label, enabled }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-all ${
      enabled
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-400'
    }`}>
      <Icon className="w-4 h-4" />
      <div className="text-[10px] font-medium tracking-wider uppercase">{label}</div>
      <div className={`text-[9px] font-bold ${enabled ? 'text-emerald-300' : 'text-slate-400'}`}>
        {enabled ? 'ON' : 'OFF'}
      </div>
    </div>
  );
}

function FormSection({ number, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-num text-[10px] font-bold tracking-widest text-slate-400">{number}</div>
        <div className="w-px h-4 bg-slate-200" />
        <h4 className="font-display text-sm font-bold text-slate-900">{title}</h4>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function FormToggle({ checked, onChange, icon: Icon, title, description }) {
  return (
    <label className="flex items-start gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-all">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
        checked ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-slate-900' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

function ModalShell({ title, subtitle, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in my-auto`}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
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
