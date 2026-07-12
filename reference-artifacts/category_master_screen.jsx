import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit3, Trash2, GripVertical, X, ChevronDown, Check, AlertTriangle, Store, ArrowUp, ArrowDown, Layers, Package } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockStores = [
  { id: 'store_aoki_thai', name: 'あお季タイ', country: 'Thailand', currency: 'THB' },
  { id: 'store_aoki_robata', name: 'AOKI ロバタ', country: 'Thailand', currency: 'THB' },
  { id: 'store_hakata_tenjin', name: '博多天神ジャカルタ', country: 'Indonesia', currency: 'IDR' },
];

// 店舗ごとのカテゴリマスタ（店舗別に独立）
const initialCategoriesByStore = {
  store_aoki_thai: [
    { id: 'c1', name: '酒類', supplierCount: 5, displayOrder: 1, isActive: true },
    { id: 'c2', name: '肉類', supplierCount: 2, displayOrder: 2, isActive: true },
    { id: 'c3', name: '鶏肉', supplierCount: 1, displayOrder: 3, isActive: true },
    { id: 'c4', name: '野菜', supplierCount: 1, displayOrder: 4, isActive: true },
    { id: 'c5', name: '食品', supplierCount: 3, displayOrder: 5, isActive: true },
    { id: 'c6', name: '魚・食品', supplierCount: 1, displayOrder: 6, isActive: true },
    { id: 'c7', name: 'うどん', supplierCount: 1, displayOrder: 7, isActive: true },
    { id: 'c8', name: '氷', supplierCount: 1, displayOrder: 8, isActive: true },
    { id: 'c9', name: '炭・藁', supplierCount: 1, displayOrder: 9, isActive: true },
    { id: 'c10', name: 'おしぼり', supplierCount: 1, displayOrder: 10, isActive: true },
  ],
  store_aoki_robata: [
    { id: 'c11', name: '酒類', supplierCount: 3, displayOrder: 1, isActive: true },
    { id: 'c12', name: '肉類', supplierCount: 2, displayOrder: 2, isActive: true },
    { id: 'c13', name: '炭', supplierCount: 1, displayOrder: 3, isActive: true },
  ],
  store_hakata_tenjin: [
    { id: 'c20', name: 'FOOD', supplierCount: 12, displayOrder: 1, isActive: true },
    { id: 'c21', name: 'Drink', supplierCount: 5, displayOrder: 2, isActive: true },
    { id: 'c22', name: '包装容器', supplierCount: 1, displayOrder: 3, isActive: true },
    { id: 'c23', name: '消耗品', supplierCount: 2, displayOrder: 4, isActive: true },
    { id: 'c24', name: '販促品', supplierCount: 1, displayOrder: 5, isActive: true },
  ],
};

// ==================== COMPONENT ====================
export default function CategoryMasterScreen() {
  const [selectedStoreId, setSelectedStoreId] = useState('store_aoki_thai');
  const [categoriesByStore, setCategoriesByStore] = useState(initialCategoriesByStore);
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  
  // Toast
  const [toast, setToast] = useState(null);

  const selectedStore = mockStores.find(s => s.id === selectedStoreId);
  const categories = categoriesByStore[selectedStoreId] || [];

  const filteredCategories = useMemo(() => {
    return categories
      .filter(c => !showActiveOnly || c.isActive)
      .filter(c => search === '' || c.name.includes(search))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [categories, search, showActiveOnly]);

  const stats = useMemo(() => {
    return {
      total: categories.length,
      active: categories.filter(c => c.isActive).length,
      totalSuppliers: categories.reduce((sum, c) => sum + c.supplierCount, 0),
    };
  }, [categories]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenAdd = () => {
    setFormName('');
    setAddModalOpen(true);
  };

  const handleAdd = () => {
    if (!formName.trim()) return;
    const newCategory = {
      id: `c_${Date.now()}`,
      name: formName.trim(),
      supplierCount: 0,
      displayOrder: categories.length + 1,
      isActive: true,
    };
    setCategoriesByStore({
      ...categoriesByStore,
      [selectedStoreId]: [...categories, newCategory],
    });
    setAddModalOpen(false);
    setFormName('');
    showToast('success', `「${newCategory.name}」を追加しました`);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setEditModalOpen(true);
  };

  const handleEdit = () => {
    if (!editingCategory || !formName.trim()) return;
    setCategoriesByStore({
      ...categoriesByStore,
      [selectedStoreId]: categories.map(c =>
        c.id === editingCategory.id ? { ...c, name: formName.trim() } : c
      ),
    });
    setEditModalOpen(false);
    setEditingCategory(null);
    showToast('success', '変更を保存しました');
  };

  const handleToggleActive = (catId) => {
    setCategoriesByStore({
      ...categoriesByStore,
      [selectedStoreId]: categories.map(c =>
        c.id === catId ? { ...c, isActive: !c.isActive } : c
      ),
    });
  };

  const handleDelete = () => {
    if (!deleteConfirmCategory) return;
    setCategoriesByStore({
      ...categoriesByStore,
      [selectedStoreId]: categories.filter(c => c.id !== deleteConfirmCategory.id),
    });
    showToast('success', `「${deleteConfirmCategory.name}」を削除しました`);
    setDeleteConfirmCategory(null);
  };

  const handleMove = (catId, direction) => {
    const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex(c => c.id === catId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = sorted.map((c, i) => {
      if (i === idx) return { ...c, displayOrder: sorted[swapIdx].displayOrder };
      if (i === swapIdx) return { ...c, displayOrder: sorted[idx].displayOrder };
      return c;
    });
    setCategoriesByStore({ ...categoriesByStore, [selectedStoreId]: updated });
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

      {/* ==================== HEADER ==================== */}
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
              <span className="text-slate-900 font-medium">仕入カテゴリ</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              比
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MAIN ==================== */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Master Data · Purchase Categories</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                仕入カテゴリ
              </h1>
              <p className="text-sm text-slate-600">
                店舗ごとに自由にカテゴリを登録・編集できます。仕入入力画面でこのカテゴリ別に仕入先がグループ表示されます。
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              新規カテゴリを追加
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
              const categoryCount = (categoriesByStore[store.id] || []).length;
              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
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
                  <div className="font-display text-base font-bold mb-1 truncate">
                    {store.name}
                  </div>
                  <div className={`text-xs flex items-center gap-2 ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                    <span className="font-num">{store.currency}</span>
                    <span>·</span>
                    <span>{categoryCount} カテゴリ</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="登録カテゴリ" value={stats.total} unit="件" icon={Layers} />
          <StatCard label="有効" value={stats.active} unit="件" icon={Check} />
          <StatCard label="紐付く仕入先" value={stats.totalSuppliers} unit="社" icon={Package} />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="カテゴリ名で絞り込み..."
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

        {/* Category List */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          {filteredCategories.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Layers className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-sm text-slate-500 mb-4">
                {search ? '該当するカテゴリが見つかりません' : 'まだカテゴリが登録されていません'}
              </div>
              {!search && (
                <button
                  onClick={handleOpenAdd}
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  最初のカテゴリを追加
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-[60px_1fr_120px_140px_120px] gap-3 px-5 py-3 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <div className="text-center">順序</div>
                <div>カテゴリ名</div>
                <div className="text-center">紐付く仕入先</div>
                <div className="text-center">状態</div>
                <div className="text-right">操作</div>
              </div>
              {filteredCategories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="grid grid-cols-1 sm:grid-cols-[60px_1fr_120px_140px_120px] gap-3 px-5 py-3 items-center hover:bg-slate-50 transition-colors anim-row"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* Order controls */}
                  <div className="flex sm:flex-col items-center gap-1 sm:gap-0">
                    <button
                      onClick={() => handleMove(cat.id, 'up')}
                      disabled={idx === 0}
                      className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <div className="font-num text-xs text-slate-500 font-medium px-1">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <button
                      onClick={() => handleMove(cat.id, 'down')}
                      disabled={idx === filteredCategories.length - 1}
                      className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold text-slate-900 truncate">{cat.name}</div>
                    <div className="text-xs text-slate-500 sm:hidden mt-0.5">
                      {cat.supplierCount} 仕入先 · {cat.isActive ? '有効' : '無効'}
                    </div>
                  </div>

                  {/* Supplier count */}
                  <div className="hidden sm:flex justify-center">
                    <div className="flex items-center gap-1.5">
                      <div className="font-num text-base font-bold text-slate-900">{cat.supplierCount}</div>
                      <div className="text-xs text-slate-500">社</div>
                    </div>
                  </div>

                  {/* Status toggle */}
                  <div className="hidden sm:flex justify-center">
                    <button
                      onClick={() => handleToggleActive(cat.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        cat.isActive ? 'bg-slate-900' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          cat.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="w-8 h-8 rounded hover:bg-slate-200 flex items-center justify-center transition-colors"
                      title="編集"
                    >
                      <Edit3 className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmCategory(cat)}
                      disabled={cat.supplierCount > 0}
                      className="w-8 h-8 rounded hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title={cat.supplierCount > 0 ? '紐付く仕入先があるため削除できません' : '削除'}
                    >
                      <Trash2 className={`w-4 h-4 ${cat.supplierCount > 0 ? 'text-slate-400' : 'text-rose-600'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help text */}
        <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· カテゴリは店舗ごとに独立しています。タイの「酒類」とジャカルタの「Drink」は別カテゴリとして管理されます</p>
          <p>· 順序は仕入入力画面でのカテゴリ表示順に反映されます（よく使う順に並べると効率的）</p>
          <p>· 仕入先が紐付いているカテゴリは削除できません（先に仕入先のカテゴリを変更してください）</p>
          <p>· 「無効」にしたカテゴリは入力画面から非表示になりますが、過去データは保持されます</p>
        </div>
      </main>

      {/* ==================== Toast ==================== */}
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

      {/* ==================== Add Modal ==================== */}
      {addModalOpen && (
        <ModalShell title="新規カテゴリを追加" subtitle="Add Category" onClose={() => setAddModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">対象店舗</div>
              <div className="font-display text-base font-bold text-slate-900">{selectedStore?.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                カテゴリ名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例：酒類、肉類、FOOD ..."
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
                autoFocus
              />
              <div className="text-xs text-slate-500 mt-1.5">
                日本語・英語・現地言語いずれも入力可能です
              </div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setAddModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleAdd}
              disabled={!formName.trim()}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              追加する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* ==================== Edit Modal ==================== */}
      {editModalOpen && editingCategory && (
        <ModalShell title="カテゴリを編集" subtitle="Edit Category" onClose={() => setEditModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">店舗</div>
                <div className="text-sm font-medium text-slate-900 truncate">{selectedStore?.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">紐付く仕入先</div>
                <div className="font-num text-sm font-bold text-slate-900">{editingCategory.supplierCount} 社</div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                カテゴリ名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
                autoFocus
              />
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setEditModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleEdit}
              disabled={!formName.trim() || formName.trim() === editingCategory.name}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              保存する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* ==================== Delete Confirm Modal ==================== */}
      {deleteConfirmCategory && (
        <ModalShell title="削除の確認" subtitle="Confirm Delete" onClose={() => setDeleteConfirmCategory(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                この操作は取り消せません。慎重に確認してください。
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-700">
                以下のカテゴリを削除します：
              </div>
              <div className="font-display text-xl font-bold text-slate-900 mt-2">
                {deleteConfirmCategory.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedStore?.name} · 紐付く仕入先 {deleteConfirmCategory.supplierCount} 社
              </div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setDeleteConfirmCategory(null)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
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

// ==================== SUB COMPONENTS ====================
function StatCard({ label, value, unit, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
        <Icon className="w-3.5 h-3.5 text-slate-400" />
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
