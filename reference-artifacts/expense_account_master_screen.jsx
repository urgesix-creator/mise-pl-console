import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit3, Trash2, X, ChevronDown, ChevronUp, Check, AlertTriangle, Store, ArrowUp, ArrowDown, Receipt, Activity, Layers, Filter } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockStores = [
  { id: 'store_aoki_thai', name: 'あお季タイ', country: 'Thailand', currency: 'THB' },
  { id: 'store_aoki_robata', name: 'AOKI ロバタ', country: 'Thailand', currency: 'THB' },
  { id: 'store_hakata_tenjin', name: '博多天神ジャカルタ', country: 'Indonesia', currency: 'IDR' },
];

// 全店共通固定の上位分類（システム全体で統一）
const STANDARD_LEVEL1 = [
  '人件費',
  '賃料',
  '光熱費',
  '広告宣伝費',
  '減価償却費',
  '支払手数料',
  '消耗品費',
  'その他販管費',
];

const initialAccountsByStore = {
  store_aoki_thai: [
    { id: 'e1', name: '給与', level1: '人件費', displayOrder: 1, isActive: true, transactionCount: 5 },
    { id: 'e2', name: '社会保険拠出金', level1: '人件費', displayOrder: 2, isActive: true, transactionCount: 5 },
    { id: 'e3', name: 'ボーナス積立', level1: '人件費', displayOrder: 3, isActive: true, transactionCount: 3 },
    { id: 'e4', name: '事務所賃借料', level1: '賃料', displayOrder: 4, isActive: true, transactionCount: 5 },
    { id: 'e5', name: '店舗賃借料', level1: '賃料', displayOrder: 5, isActive: true, transactionCount: 5 },
    { id: 'e6', name: '電気代', level1: '光熱費', displayOrder: 6, isActive: true, transactionCount: 5 },
    { id: 'e7', name: '水道料', level1: '光熱費', displayOrder: 7, isActive: true, transactionCount: 5 },
    { id: 'e8', name: 'ガス代', level1: '光熱費', displayOrder: 8, isActive: true, transactionCount: 5 },
    { id: 'e9', name: '通信費', level1: 'その他販管費', displayOrder: 9, isActive: true, transactionCount: 5 },
    { id: 'e10', name: '広告宣伝費', level1: '広告宣伝費', displayOrder: 10, isActive: true, transactionCount: 4 },
    { id: 'e11', name: '会計サービス料', level1: '支払手数料', displayOrder: 11, isActive: true, transactionCount: 5 },
    { id: 'e12', name: 'PLAUDサブスク料', level1: 'その他販管費', displayOrder: 12, isActive: false, transactionCount: 0 },
  ],
  store_aoki_robata: [
    { id: 'e20', name: '給与', level1: '人件費', displayOrder: 1, isActive: true, transactionCount: 2 },
    { id: 'e21', name: '店舗賃借料', level1: '賃料', displayOrder: 2, isActive: true, transactionCount: 2 },
    { id: 'e22', name: '電気代', level1: '光熱費', displayOrder: 3, isActive: true, transactionCount: 2 },
  ],
  store_hakata_tenjin: [
    { id: 'e30', name: '給与（管理職）', level1: '人件費', displayOrder: 1, isActive: true, transactionCount: 3 },
    { id: 'e31', name: '給与（現場）', level1: '人件費', displayOrder: 2, isActive: true, transactionCount: 3 },
    { id: 'e32', name: 'BPJS拠出金', level1: '人件費', displayOrder: 3, isActive: true, transactionCount: 3 },
    { id: 'e33', name: '店舗賃借料', level1: '賃料', displayOrder: 4, isActive: true, transactionCount: 3 },
    { id: 'e34', name: 'PLN電気代', level1: '光熱費', displayOrder: 5, isActive: true, transactionCount: 3 },
    { id: 'e35', name: 'PDAM水道料', level1: '光熱費', displayOrder: 6, isActive: true, transactionCount: 3 },
    { id: 'e36', name: 'GoFood広告', level1: '広告宣伝費', displayOrder: 7, isActive: true, transactionCount: 2 },
    { id: 'e37', name: 'GrabFood広告', level1: '広告宣伝費', displayOrder: 8, isActive: true, transactionCount: 2 },
  ],
};

// Level1 color mapping
const getLevel1Color = (level1) => {
  const map = {
    '人件費': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
    '賃料': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    '光熱費': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    '広告宣伝費': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
    '減価償却費': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
    '支払手数料': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
    '消耗品費': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    'その他販管費': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  };
  return map[level1] || map['その他販管費'];
};

// ==================== COMPONENT ====================
export default function ExpenseAccountMasterScreen() {
  const [selectedStoreId, setSelectedStoreId] = useState('store_aoki_thai');
  const [accountsByStore, setAccountsByStore] = useState(initialAccountsByStore);
  const [search, setSearch] = useState('');
  const [filterLevel1, setFilterLevel1] = useState('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLevel1, setFormLevel1] = useState(STANDARD_LEVEL1[0]);
  const [formIsActive, setFormIsActive] = useState(true);

  // Toast
  const [toast, setToast] = useState(null);

  const selectedStore = mockStores.find(s => s.id === selectedStoreId);
  const accounts = accountsByStore[selectedStoreId] || [];

  const filteredAccounts = useMemo(() => {
    return accounts
      .filter(a => !showActiveOnly || a.isActive)
      .filter(a => filterLevel1 === 'all' || a.level1 === filterLevel1)
      .filter(a => {
        if (search === '') return true;
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.level1.includes(search);
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [accounts, search, filterLevel1, showActiveOnly]);

  // Group by level1
  const groupedAccounts = useMemo(() => {
    const groups = {};
    filteredAccounts.forEach(a => {
      if (!groups[a.level1]) groups[a.level1] = [];
      groups[a.level1].push(a);
    });
    // Order groups by STANDARD_LEVEL1
    const ordered = {};
    STANDARD_LEVEL1.forEach(l => {
      if (groups[l]) ordered[l] = groups[l];
    });
    // Add any non-standard at the end
    Object.keys(groups).forEach(k => {
      if (!ordered[k]) ordered[k] = groups[k];
    });
    return ordered;
  }, [filteredAccounts]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.isActive).length;
    const level1Used = new Set(accounts.map(a => a.level1)).size;
    const totalTransactions = accounts.reduce((sum, a) => sum + a.transactionCount, 0);
    return { total, active, level1Used, totalTransactions };
  }, [accounts]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleGroup = (level1) => {
    setCollapsedGroups({ ...collapsedGroups, [level1]: !collapsedGroups[level1] });
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormLevel1(STANDARD_LEVEL1[0]);
    setFormIsActive(true);
    setAddModalOpen(true);
  };

  const handleAdd = () => {
    if (!formName.trim()) return;
    const newAccount = {
      id: `e_${Date.now()}`,
      name: formName.trim(),
      level1: formLevel1,
      displayOrder: accounts.length + 1,
      isActive: formIsActive,
      transactionCount: 0,
    };
    setAccountsByStore({
      ...accountsByStore,
      [selectedStoreId]: [...accounts, newAccount],
    });
    setAddModalOpen(false);
    showToast('success', `「${newAccount.name}」を追加しました`);
  };

  const handleOpenEdit = (a) => {
    setEditingAccount(a);
    setFormName(a.name);
    setFormLevel1(a.level1);
    setFormIsActive(a.isActive);
    setEditModalOpen(true);
  };

  const handleEdit = () => {
    if (!editingAccount || !formName.trim()) return;
    setAccountsByStore({
      ...accountsByStore,
      [selectedStoreId]: accounts.map(a =>
        a.id === editingAccount.id
          ? { ...a, name: formName.trim(), level1: formLevel1, isActive: formIsActive }
          : a
      ),
    });
    setEditModalOpen(false);
    setEditingAccount(null);
    showToast('success', '変更を保存しました');
  };

  const handleToggleActive = (id) => {
    setAccountsByStore({
      ...accountsByStore,
      [selectedStoreId]: accounts.map(a =>
        a.id === id ? { ...a, isActive: !a.isActive } : a
      ),
    });
  };

  const handleDelete = () => {
    if (!deleteConfirmAccount) return;
    setAccountsByStore({
      ...accountsByStore,
      [selectedStoreId]: accounts.filter(a => a.id !== deleteConfirmAccount.id),
    });
    showToast('success', `「${deleteConfirmAccount.name}」を削除しました`);
    setDeleteConfirmAccount(null);
  };

  const handleMove = (id, direction) => {
    const sorted = [...accounts].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex(a => a.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = sorted.map((a, i) => {
      if (i === idx) return { ...a, displayOrder: sorted[swapIdx].displayOrder };
      if (i === swapIdx) return { ...a, displayOrder: sorted[idx].displayOrder };
      return a;
    });
    setAccountsByStore({ ...accountsByStore, [selectedStoreId]: updated });
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
          from { opacity: 0; transform: translateX(-8px); }
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
              <span className="text-slate-900 font-medium">販管費科目</span>
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
            <span>Master Data · Expense Accounts</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                販管費科目
              </h1>
              <p className="text-sm text-slate-600">
                店舗ごとに科目を管理。上位分類は全店共通固定で月次PLの科目集計に使用されます。
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              新規科目を追加
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
              const accountCount = (accountsByStore[store.id] || []).length;
              return (
                <button
                  key={store.id}
                  onClick={() => {
                    setSelectedStoreId(store.id);
                    setFilterLevel1('all');
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
                    <span>{accountCount} 科目</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="登録科目" value={stats.total} unit="科目" icon={Receipt} />
          <StatCard label="有効" value={stats.active} unit="科目" icon={Check} />
          <StatCard label="使用分類" value={stats.level1Used} unit={`/${STANDARD_LEVEL1.length}`} icon={Layers} />
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
              placeholder="科目名・分類で絞り込み..."
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
            <select
              value={filterLevel1}
              onChange={(e) => setFilterLevel1(e.target.value)}
              className="pl-10 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
            >
              <option value="all">すべての分類</option>
              {STANDARD_LEVEL1.map(l => (
                <option key={l} value={l}>{l}</option>
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

        {/* Account List - Grouped by Level1 */}
        {filteredAccounts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm text-slate-500 mb-4">
              {search || filterLevel1 !== 'all' ? '該当する科目が見つかりません' : 'まだ科目が登録されていません'}
            </div>
            {!search && filterLevel1 === 'all' && (
              <button onClick={handleOpenAdd} className="text-sm font-medium text-slate-900 hover:underline">
                最初の科目を追加
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedAccounts).map(([level1, items]) => {
              const color = getLevel1Color(level1);
              const isCollapsed = collapsedGroups[level1];
              return (
                <div key={level1} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <button
                    onClick={() => toggleGroup(level1)}
                    className="w-full px-5 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <div className="font-display text-sm font-bold text-slate-900">{level1}</div>
                      <div className="text-xs text-slate-500">{items.length} 科目</div>
                    </div>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </button>
                  {!isCollapsed && (
                    <>
                      {/* Header */}
                      <div className="hidden sm:grid grid-cols-[60px_1fr_120px_140px_120px] gap-3 px-5 py-3 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                        <div className="text-center">順序</div>
                        <div>科目名</div>
                        <div className="text-center">取引件数</div>
                        <div className="text-center">状態</div>
                        <div className="text-right">操作</div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {items.map((acc, idx) => {
                          const totalIdx = filteredAccounts.findIndex(a => a.id === acc.id);
                          return (
                            <div
                              key={acc.id}
                              className="grid grid-cols-1 sm:grid-cols-[60px_1fr_120px_140px_120px] gap-3 px-5 py-3 items-center hover:bg-slate-50 transition-colors anim-row"
                              style={{ animationDelay: `${idx * 20}ms` }}
                            >
                              {/* Order controls */}
                              <div className="flex sm:flex-col items-center gap-1 sm:gap-0">
                                <button
                                  onClick={() => handleMove(acc.id, 'up')}
                                  disabled={totalIdx === 0}
                                  className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                                <div className="font-num text-xs text-slate-500 font-medium px-1">
                                  {String(totalIdx + 1).padStart(2, '0')}
                                </div>
                                <button
                                  onClick={() => handleMove(acc.id, 'down')}
                                  disabled={totalIdx === filteredAccounts.length - 1}
                                  className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              </div>
                              {/* Name */}
                              <div className="min-w-0">
                                <div className="font-display text-base font-bold text-slate-900 truncate">{acc.name}</div>
                                <div className="text-xs text-slate-500 sm:hidden mt-0.5">
                                  取引{acc.transactionCount}件 · {acc.isActive ? '有効' : '無効'}
                                </div>
                              </div>
                              {/* Transaction count */}
                              <div className="hidden sm:flex justify-center items-center gap-1.5">
                                <div className="font-num text-base font-bold text-slate-900">{acc.transactionCount}</div>
                                <div className="text-xs text-slate-500">件</div>
                              </div>
                              {/* Status toggle */}
                              <div className="hidden sm:flex justify-center">
                                <button
                                  onClick={() => handleToggleActive(acc.id)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    acc.isActive ? 'bg-slate-900' : 'bg-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      acc.isActive ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                              {/* Actions */}
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenEdit(acc)}
                                  className="w-8 h-8 rounded hover:bg-slate-200 flex items-center justify-center transition-colors"
                                  title="編集"
                                >
                                  <Edit3 className="w-4 h-4 text-slate-600" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmAccount(acc)}
                                  disabled={acc.transactionCount > 0}
                                  className="w-8 h-8 rounded hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  title={acc.transactionCount > 0 ? '取引履歴があるため削除できません（無効化のみ可）' : '削除'}
                                >
                                  <Trash2 className={`w-4 h-4 ${acc.transactionCount > 0 ? 'text-slate-400' : 'text-rose-600'}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Help text */}
        <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 上位分類（人件費・賃料・光熱費・広告宣伝費 等）は全店共通固定。月次PLの集計単位として機能します</p>
          <p>· 科目名は店舗ごとに自由定義可能（例：「PLN電気代」「PDAM水道料」など現地名称も可）</p>
          <p>· 取引履歴がある科目は削除できません（無効化のみ可、過去データを保護するため）</p>
          <p>· 順序は日次入力画面の科目表示順に反映されます</p>
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
        <ModalShell title="新規科目を追加" subtitle="Add Account" onClose={() => setAddModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">対象店舗</div>
              <div className="font-display text-base font-bold text-slate-900">{selectedStore?.name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                科目名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例：給与、店舗賃借料、PLN電気代 ..."
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
                autoFocus
              />
              <div className="text-xs text-slate-500 mt-1.5">
                日本語・英語・現地言語いずれも入力可能
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                上位分類 <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STANDARD_LEVEL1.map(l => {
                  const isSelected = formLevel1 === l;
                  const color = getLevel1Color(l);
                  return (
                    <button
                      key={l}
                      onClick={() => setFormLevel1(l)}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 hover:border-slate-400 bg-white'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : color.dot}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-900'}`}>{l}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                上位分類は全店共通固定。月次PLの集計単位として機能します
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
              disabled={!formName.trim()}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              追加する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingAccount && (
        <ModalShell title="科目を編集" subtitle="Edit Account" onClose={() => setEditModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">店舗</div>
                <div className="text-sm font-medium text-slate-900 truncate">{selectedStore?.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">取引件数</div>
                <div className="font-num text-sm font-bold text-slate-900">{editingAccount.transactionCount} 件</div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                科目名 <span className="text-rose-500">*</span>
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
                上位分類 <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STANDARD_LEVEL1.map(l => {
                  const isSelected = formLevel1 === l;
                  const color = getLevel1Color(l);
                  return (
                    <button
                      key={l}
                      onClick={() => setFormLevel1(l)}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 hover:border-slate-400 bg-white'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : color.dot}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-900'}`}>{l}</span>
                    </button>
                  );
                })}
              </div>
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
              disabled={!formName.trim()}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              保存する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmAccount && (
        <ModalShell title="削除の確認" subtitle="Confirm Delete" onClose={() => setDeleteConfirmAccount(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                この操作は取り消せません。慎重に確認してください。
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-700">以下の科目を削除します：</div>
              <div className="font-display text-xl font-bold text-slate-900 mt-2">
                {deleteConfirmAccount.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedStore?.name} · {deleteConfirmAccount.level1} · 取引履歴 {deleteConfirmAccount.transactionCount} 件
              </div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setDeleteConfirmAccount(null)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
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
