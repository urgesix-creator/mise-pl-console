import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit3, Trash2, X, ChevronDown, Check, AlertTriangle, Store, ArrowUp, ArrowDown, Tag, Package, Activity, Filter, Layers } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockStores = [
  { id: 'store_aoki_thai', name: 'あお季タイ', country: 'Thailand', currency: 'THB' },
  { id: 'store_aoki_robata', name: 'AOKI ロバタ', country: 'Thailand', currency: 'THB' },
  { id: 'store_hakata_tenjin', name: '博多天神ジャカルタ', country: 'Indonesia', currency: 'IDR' },
];

const initialCategoriesByStore = {
  store_aoki_thai: [
    { id: 'c1', name: '酒類' },
    { id: 'c2', name: '肉類' },
    { id: 'c3', name: '鶏肉' },
    { id: 'c4', name: '野菜' },
    { id: 'c5', name: '食品' },
    { id: 'c6', name: '魚・食品' },
    { id: 'c7', name: 'うどん' },
    { id: 'c8', name: '氷' },
    { id: 'c9', name: '炭・藁' },
    { id: 'c10', name: 'おしぼり' },
  ],
  store_aoki_robata: [
    { id: 'c11', name: '酒類' },
    { id: 'c12', name: '肉類' },
    { id: 'c13', name: '炭' },
  ],
  store_hakata_tenjin: [
    { id: 'c20', name: 'FOOD' },
    { id: 'c21', name: 'Drink' },
    { id: 'c22', name: '包装容器' },
    { id: 'c23', name: '消耗品' },
    { id: 'c24', name: '販促品' },
  ],
};

const initialSuppliersByStore = {
  store_aoki_thai: [
    { id: 's1', name: 'Bacchus Global', categoryId: 'c1', displayOrder: 1, isActive: true, transactionCount: 45 },
    { id: 's2', name: 'Asan service', categoryId: 'c1', displayOrder: 2, isActive: true, transactionCount: 32 },
    { id: 's3', name: 'Shibataya Thailand', categoryId: 'c1', displayOrder: 3, isActive: true, transactionCount: 28 },
    { id: 's4', name: 'Kobeya', categoryId: 'c1', displayOrder: 4, isActive: true, transactionCount: 15 },
    { id: 's5', name: 'SCS Trading', categoryId: 'c1', displayOrder: 5, isActive: false, transactionCount: 3 },
    { id: 's6', name: 'KING OF BEEF', categoryId: 'c2', displayOrder: 6, isActive: true, transactionCount: 60 },
    { id: 's7', name: 'NEXS', categoryId: 'c2', displayOrder: 7, isActive: true, transactionCount: 22 },
    { id: 's8', name: 'BETAGRO', categoryId: 'c3', displayOrder: 8, isActive: true, transactionCount: 38 },
    { id: 's9', name: 'Kingdom Organic', categoryId: 'c4', displayOrder: 9, isActive: true, transactionCount: 41 },
    { id: 's10', name: 'FOOD PROJECT', categoryId: 'c5', displayOrder: 10, isActive: true, transactionCount: 19 },
    { id: 's11', name: 'Koubeya Syokuhin', categoryId: 'c5', displayOrder: 11, isActive: true, transactionCount: 14 },
    { id: 's12', name: 'Nishihara', categoryId: 'c5', displayOrder: 12, isActive: true, transactionCount: 8 },
    { id: 's13', name: 'Todokeru Foods', categoryId: 'c6', displayOrder: 13, isActive: true, transactionCount: 25 },
    { id: 's14', name: 'Kanezin Japan', categoryId: 'c7', displayOrder: 14, isActive: true, transactionCount: 12 },
    { id: 's15', name: 'SUZUKI ICE', categoryId: 'c8', displayOrder: 15, isActive: true, transactionCount: 30 },
    { id: 's16', name: 'Kamenoya', categoryId: 'c9', displayOrder: 16, isActive: true, transactionCount: 18 },
    { id: 's17', name: 'Kokoro Sato Co., Ltd.', categoryId: 'c10', displayOrder: 17, isActive: true, transactionCount: 24 },
  ],
  store_aoki_robata: [
    { id: 's18', name: 'Bacchus Global', categoryId: 'c11', displayOrder: 1, isActive: true, transactionCount: 8 },
    { id: 's19', name: 'KING OF BEEF', categoryId: 'c12', displayOrder: 2, isActive: true, transactionCount: 12 },
    { id: 's20', name: 'D\'CHARCOAL', categoryId: 'c13', displayOrder: 3, isActive: true, transactionCount: 4 },
  ],
  store_hakata_tenjin: [
    { id: 's21', name: 'Vins', categoryId: 'c20', displayOrder: 1, isActive: true, transactionCount: 15 },
    { id: 's22', name: 'Putra Mandiri', categoryId: 'c20', displayOrder: 2, isActive: true, transactionCount: 22 },
    { id: 's23', name: 'Sukanda Djaya', categoryId: 'c20', displayOrder: 3, isActive: true, transactionCount: 18 },
    { id: 's24', name: 'Bugasari', categoryId: 'c20', displayOrder: 4, isActive: true, transactionCount: 10 },
    { id: 's25', name: 'Kharisma Sukses Gemilang', categoryId: 'c21', displayOrder: 5, isActive: true, transactionCount: 14 },
    { id: 's26', name: 'BaliHai', categoryId: 'c21', displayOrder: 6, isActive: true, transactionCount: 8 },
    { id: 's27', name: 'japan Pack', categoryId: 'c22', displayOrder: 7, isActive: true, transactionCount: 5 },
  ],
};

// ==================== COMPONENT ====================
export default function SupplierMasterScreen() {
  const [selectedStoreId, setSelectedStoreId] = useState('store_aoki_thai');
  const [suppliersByStore, setSuppliersByStore] = useState(initialSuppliersByStore);
  const [categoriesByStore] = useState(initialCategoriesByStore);
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Toast
  const [toast, setToast] = useState(null);

  const selectedStore = mockStores.find(s => s.id === selectedStoreId);
  const categories = categoriesByStore[selectedStoreId] || [];
  const suppliers = suppliersByStore[selectedStoreId] || [];
  const categoryById = useMemo(() => {
    const map = {};
    categories.forEach(c => { map[c.id] = c; });
    return map;
  }, [categories]);

  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter(s => !showActiveOnly || s.isActive)
      .filter(s => filterCategoryId === 'all' || s.categoryId === filterCategoryId)
      .filter(s => {
        if (search === '') return true;
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) ||
          (categoryById[s.categoryId]?.name || '').toLowerCase().includes(q);
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [suppliers, search, filterCategoryId, showActiveOnly, categoryById]);

  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(s => s.isActive).length;
    const categoriesUsed = new Set(suppliers.map(s => s.categoryId)).size;
    const totalTransactions = suppliers.reduce((sum, s) => sum + s.transactionCount, 0);
    return { totalSuppliers, activeSuppliers, categoriesUsed, totalTransactions };
  }, [suppliers]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Handlers
  const handleOpenAdd = () => {
    setFormName('');
    setFormCategoryId(categories[0]?.id || '');
    setFormIsActive(true);
    setAddModalOpen(true);
  };

  const handleAdd = () => {
    if (!formName.trim() || !formCategoryId) return;
    const newSupplier = {
      id: `s_${Date.now()}`,
      name: formName.trim(),
      categoryId: formCategoryId,
      displayOrder: suppliers.length + 1,
      isActive: formIsActive,
      transactionCount: 0,
    };
    setSuppliersByStore({
      ...suppliersByStore,
      [selectedStoreId]: [...suppliers, newSupplier],
    });
    setAddModalOpen(false);
    showToast('success', `「${newSupplier.name}」を追加しました`);
  };

  const handleOpenEdit = (s) => {
    setEditingSupplier(s);
    setFormName(s.name);
    setFormCategoryId(s.categoryId);
    setFormIsActive(s.isActive);
    setEditModalOpen(true);
  };

  const handleEdit = () => {
    if (!editingSupplier || !formName.trim() || !formCategoryId) return;
    setSuppliersByStore({
      ...suppliersByStore,
      [selectedStoreId]: suppliers.map(s =>
        s.id === editingSupplier.id
          ? { ...s, name: formName.trim(), categoryId: formCategoryId, isActive: formIsActive }
          : s
      ),
    });
    setEditModalOpen(false);
    setEditingSupplier(null);
    showToast('success', '変更を保存しました');
  };

  const handleToggleActive = (id) => {
    setSuppliersByStore({
      ...suppliersByStore,
      [selectedStoreId]: suppliers.map(s =>
        s.id === id ? { ...s, isActive: !s.isActive } : s
      ),
    });
  };

  const handleDelete = () => {
    if (!deleteConfirmSupplier) return;
    setSuppliersByStore({
      ...suppliersByStore,
      [selectedStoreId]: suppliers.filter(s => s.id !== deleteConfirmSupplier.id),
    });
    showToast('success', `「${deleteConfirmSupplier.name}」を削除しました`);
    setDeleteConfirmSupplier(null);
  };

  const handleMove = (id, direction) => {
    const sorted = [...suppliers].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex(s => s.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = sorted.map((s, i) => {
      if (i === idx) return { ...s, displayOrder: sorted[swapIdx].displayOrder };
      if (i === swapIdx) return { ...s, displayOrder: sorted[idx].displayOrder };
      return s;
    });
    setSuppliersByStore({ ...suppliersByStore, [selectedStoreId]: updated });
  };

  // Get category color (consistent based on category id hash)
  const getCategoryColor = (categoryId) => {
    const colors = [
      { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
      { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
      { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
      { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
      { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
      { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    ];
    let hash = 0;
    for (let i = 0; i < categoryId.length; i++) hash += categoryId.charCodeAt(i);
    return colors[hash % colors.length];
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

        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .anim-row { animation: slideRight 0.2s ease-out backwards; }
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
              <span className="text-slate-900 font-medium">仕入先</span>
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
            <span>Master Data · Suppliers</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                仕入先
              </h1>
              <p className="text-sm text-slate-600">
                店舗ごとに仕入先を管理。各仕入先は1つのカテゴリに紐付きます。
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              disabled={categories.length === 0}
              className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              新規仕入先を追加
            </button>
          </div>
        </div>

        {/* Store Selector */}
        <div className="mb-6 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Store className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">対象店舗</span>
          </div>
          <div className="p-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {mockStores.map(store => {
              const isSelected = selectedStoreId === store.id;
              const supplierCount = (suppliersByStore[store.id] || []).length;
              return (
                <button
                  key={store.id}
                  onClick={() => {
                    setSelectedStoreId(store.id);
                    setFilterCategoryId('all');
                    setSearch('');
                  }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 hover:border-slate-400 bg-white text-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`text-xs uppercase tracking-wider ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                      {store.country}
                    </div>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                  <div className="font-display text-base font-bold mb-1 truncate">{store.name}</div>
                  <div className={`text-xs flex items-center gap-2 ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                    <span className="font-num">{store.currency}</span>
                    <span>·</span>
                    <span>{supplierCount} 仕入先</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="登録仕入先" value={stats.totalSuppliers} unit="社" icon={Package} />
          <StatCard label="有効" value={stats.activeSuppliers} unit="社" icon={Check} />
          <StatCard label="カテゴリ使用数" value={stats.categoriesUsed} unit={`/${categories.length}`} icon={Tag} />
          <StatCard label="累計取引件数" value={stats.totalTransactions} unit="件" icon={Activity} />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="仕入先名・カテゴリで絞り込み..."
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="pl-10 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
            >
              <option value="all">すべてのカテゴリ</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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

        {/* Supplier List */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          {categories.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-sm text-slate-700 font-medium mb-2">カテゴリが登録されていません</div>
              <div className="text-xs text-slate-500 mb-4">
                仕入先を登録するには、先に「仕入カテゴリマスタ」でカテゴリを作成してください。
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Package className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-sm text-slate-500 mb-4">
                {search || filterCategoryId !== 'all' ? '該当する仕入先が見つかりません' : 'まだ仕入先が登録されていません'}
              </div>
              {!search && filterCategoryId === 'all' && (
                <button onClick={handleOpenAdd} className="text-sm font-medium text-slate-900 hover:underline">
                  最初の仕入先を追加
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-[60px_1fr_140px_100px_120px_120px] gap-3 px-5 py-3 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <div className="text-center">順序</div>
                <div>仕入先名</div>
                <div>カテゴリ</div>
                <div className="text-center">取引件数</div>
                <div className="text-center">状態</div>
                <div className="text-right">操作</div>
              </div>
              {filteredSuppliers.map((s, idx) => {
                const cat = categoryById[s.categoryId];
                const catColor = cat ? getCategoryColor(s.categoryId) : null;
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-1 sm:grid-cols-[60px_1fr_140px_100px_120px_120px] gap-3 px-5 py-3 items-center hover:bg-slate-50 transition-colors anim-row"
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    {/* Order controls */}
                    <div className="flex sm:flex-col items-center gap-1 sm:gap-0">
                      <button
                        onClick={() => handleMove(s.id, 'up')}
                        disabled={idx === 0}
                        className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <div className="font-num text-xs text-slate-500 font-medium px-1">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <button
                        onClick={() => handleMove(s.id, 'down')}
                        disabled={idx === filteredSuppliers.length - 1}
                        className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>

                    {/* Name */}
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold text-slate-900 truncate">{s.name}</div>
                      {/* Mobile only: category + transaction inline */}
                      <div className="sm:hidden flex items-center gap-2 mt-1.5">
                        {cat && catColor && (
                          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catColor.bg} ${catColor.text} border ${catColor.border}`}>
                            <Tag className="w-3 h-3 mr-1" />
                            {cat.name}
                          </div>
                        )}
                        <span className="text-xs text-slate-500">取引{s.transactionCount}件</span>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="hidden sm:block">
                      {cat && catColor && (
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${catColor.bg} ${catColor.text} border ${catColor.border}`}>
                          <Tag className="w-3 h-3 mr-1" />
                          {cat.name}
                        </div>
                      )}
                    </div>

                    {/* Transaction count */}
                    <div className="hidden sm:flex justify-center items-center gap-1.5">
                      <div className="font-num text-base font-bold text-slate-900">{s.transactionCount}</div>
                      <div className="text-xs text-slate-500">件</div>
                    </div>

                    {/* Status toggle */}
                    <div className="hidden sm:flex justify-center">
                      <button
                        onClick={() => handleToggleActive(s.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          s.isActive ? 'bg-slate-900' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            s.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="w-8 h-8 rounded hover:bg-slate-200 flex items-center justify-center transition-colors"
                        title="編集"
                      >
                        <Edit3 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmSupplier(s)}
                        disabled={s.transactionCount > 0}
                        className="w-8 h-8 rounded hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        title={s.transactionCount > 0 ? '取引履歴があるため削除できません（無効化のみ可）' : '削除'}
                      >
                        <Trash2 className={`w-4 h-4 ${s.transactionCount > 0 ? 'text-slate-400' : 'text-rose-600'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Help text */}
        <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 仕入先は店舗ごとに独立しています。同じ「Bacchus Global」でも店舗ごとに別レコードとして管理</p>
          <p>· カテゴリを変更すると、日次入力画面でのグループ表示が変わります</p>
          <p>· 取引履歴がある仕入先は削除できません（無効化のみ可、過去データを保護するため）</p>
          <p>· 順序は仕入入力画面でのカテゴリ内表示順に反映されます</p>
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
        <ModalShell title="新規仕入先を追加" subtitle="Add Supplier" onClose={() => setAddModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">対象店舗</div>
              <div className="font-display text-base font-bold text-slate-900">{selectedStore?.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                仕入先名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例：Bacchus Global、KING OF BEEF ..."
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                カテゴリ <span className="text-rose-500">*</span>
              </label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="text-xs text-slate-500 mt-1.5">
                カテゴリは「仕入カテゴリマスタ」で店舗ごとに管理されます
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer accent-slate-900"
              />
              <span className="text-sm text-slate-700">有効として登録（日次入力画面で選択可能になる）</span>
            </label>
          </div>
          <ModalFooter>
            <button onClick={() => setAddModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleAdd}
              disabled={!formName.trim() || !formCategoryId}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              追加する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingSupplier && (
        <ModalShell title="仕入先を編集" subtitle="Edit Supplier" onClose={() => setEditModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">店舗</div>
                <div className="text-sm font-medium text-slate-900 truncate">{selectedStore?.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">取引件数</div>
                <div className="font-num text-sm font-bold text-slate-900">{editingSupplier.transactionCount} 件</div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                仕入先名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                カテゴリ <span className="text-rose-500">*</span>
              </label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer accent-slate-900"
              />
              <span className="text-sm text-slate-700">有効</span>
            </label>
          </div>
          <ModalFooter>
            <button onClick={() => setEditModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleEdit}
              disabled={!formName.trim() || !formCategoryId}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              保存する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmSupplier && (
        <ModalShell title="削除の確認" subtitle="Confirm Delete" onClose={() => setDeleteConfirmSupplier(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                この操作は取り消せません。慎重に確認してください。
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-700">以下の仕入先を削除します：</div>
              <div className="font-display text-xl font-bold text-slate-900 mt-2">
                {deleteConfirmSupplier.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedStore?.name} · カテゴリ「{categoryById[deleteConfirmSupplier.categoryId]?.name}」 · 取引履歴 {deleteConfirmSupplier.transactionCount} 件
              </div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setDeleteConfirmSupplier(null)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
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

// SUB COMPONENTS
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

function ModalShell({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
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
    <div className="px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 -mx-6 -mb-6 mt-6">
      {children}
    </div>
  );
}
