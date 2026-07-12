import React, { useState, useMemo } from 'react';
import { Search, Download, Filter, Calendar, Edit3, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Check, AlertTriangle, ArrowUpDown, TrendingUp, ShoppingCart, Receipt, Store, Save } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockStores = [
  { id: 'store_aoki_thai', name: 'あお季タイ', country: 'Thailand', symbol: '฿' },
  { id: 'store_aoki_robata', name: 'AOKI ロバタ', country: 'Thailand', symbol: '฿' },
  { id: 'store_hakata_tenjin', name: '博多天神ジャカルタ', country: 'Indonesia', symbol: 'Rp' },
];

const mockSuppliers = {
  store_aoki_thai: [
    { id: 's1', name: 'Bacchus Global', category: '酒類' },
    { id: 's6', name: 'KING OF BEEF', category: '肉類' },
    { id: 's8', name: 'BETAGRO', category: '鶏肉' },
    { id: 's9', name: 'Kingdom Organic', category: '野菜' },
    { id: 's13', name: 'Todokeru Foods', category: '魚・食品' },
    { id: 's15', name: 'SUZUKI ICE', category: '氷' },
  ],
  store_aoki_robata: [
    { id: 's18', name: 'Bacchus Global', category: '酒類' },
    { id: 's19', name: 'KING OF BEEF', category: '肉類' },
  ],
  store_hakata_tenjin: [
    { id: 's21', name: 'Vins', category: 'FOOD' },
    { id: 's25', name: 'Kharisma', category: 'Drink' },
  ],
};

const mockExpenseAccounts = [
  { id: 'e1', name: '給与', level1: '人件費' },
  { id: 'e2', name: '社会保険', level1: '人件費' },
  { id: 'e4', name: '店舗賃借料', level1: '賃料' },
  { id: 'e5', name: '電気代', level1: '光熱費' },
  { id: 'e6', name: '水道料', level1: '光熱費' },
  { id: 'e8', name: '通信費', level1: 'その他' },
];

// Generate sales data
const generateSalesData = () => {
  const data = [];
  const baseDate = new Date(2026, 4, 1);
  let id = 1;
  for (let day = 0; day < 10; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + day);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    
    // あお季タイ
    data.push({
      id: id++,
      date: dateStr,
      dateObj: new Date(date),
      storeId: 'store_aoki_thai',
      dayPeriod: 'all',
      grossSales: 80000 + Math.round(Math.random() * 90000),
      customers: 25 + Math.round(Math.random() * 30),
      targetSales: 85000 + (date.getDay() === 0 || date.getDay() === 6 ? 10000 : 0),
    });
    
    // AOKI ロバタ
    if (day < 8) {
      data.push({
        id: id++,
        date: dateStr,
        dateObj: new Date(date),
        storeId: 'store_aoki_robata',
        dayPeriod: 'all',
        grossSales: 22000 + Math.round(Math.random() * 25000),
        customers: 8 + Math.round(Math.random() * 8),
        targetSales: 35000,
      });
    }
    
    // ジャカルタ - lunch & dinner
    data.push({
      id: id++,
      date: dateStr,
      dateObj: new Date(date),
      storeId: 'store_hakata_tenjin',
      dayPeriod: 'lunch',
      grossSales: 2800000 + Math.round(Math.random() * 1500000),
      customers: 18 + Math.round(Math.random() * 15),
      targetSales: 3000000,
    });
    data.push({
      id: id++,
      date: dateStr,
      dateObj: new Date(date),
      storeId: 'store_hakata_tenjin',
      dayPeriod: 'dinner',
      grossSales: 3800000 + Math.round(Math.random() * 2500000),
      customers: 28 + Math.round(Math.random() * 20),
      targetSales: 4500000,
    });
  }
  return data;
};

const generatePurchaseData = () => {
  const data = [];
  const baseDate = new Date(2026, 4, 1);
  let id = 1;
  for (let day = 0; day < 10; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + day);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    
    if (day % 2 === 0) {
      const suppliers = mockSuppliers.store_aoki_thai;
      const numSuppliers = 2 + Math.round(Math.random() * 3);
      for (let i = 0; i < numSuppliers; i++) {
        const sup = suppliers[Math.floor(Math.random() * suppliers.length)];
        data.push({
          id: id++,
          date: dateStr,
          dateObj: new Date(date),
          storeId: 'store_aoki_thai',
          supplierName: sup.name,
          category: sup.category,
          amount: 5000 + Math.round(Math.random() * 25000),
        });
      }
    }
    
    if (day % 3 === 0) {
      const sup = mockSuppliers.store_hakata_tenjin[Math.floor(Math.random() * 2)];
      data.push({
        id: id++,
        date: dateStr,
        dateObj: new Date(date),
        storeId: 'store_hakata_tenjin',
        supplierName: sup.name,
        category: sup.category,
        amount: 800000 + Math.round(Math.random() * 1500000),
      });
    }
  }
  return data;
};

const generateExpenseData = () => {
  const data = [];
  const baseDate = new Date(2026, 4, 1);
  let id = 1;
  // Monthly recurring expenses input on first day
  const recurringDate = new Date(baseDate);
  ['store_aoki_thai', 'store_aoki_robata', 'store_hakata_tenjin'].forEach(storeId => {
    mockExpenseAccounts.forEach(acc => {
      const multiplier = storeId === 'store_hakata_tenjin' ? 100 : 1;
      data.push({
        id: id++,
        date: '5/1',
        dateObj: new Date(recurringDate),
        storeId,
        accountName: acc.name,
        level1: acc.level1,
        amount: (acc.level1 === '人件費' ? 80000 : 15000) * multiplier + Math.round(Math.random() * 10000) * multiplier,
      });
    });
  });
  return data;
};

const allSales = generateSalesData();
const allPurchases = generatePurchaseData();
const allExpenses = generateExpenseData();

// ==================== UTILITIES ====================
const formatNumber = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US');
};

const dayPeriodLabel = (p) => {
  if (p === 'lunch') return 'ランチ';
  if (p === 'dinner') return 'ディナー';
  return '通常';
};

const TABS = [
  { id: 'sales', label: '売上', icon: TrendingUp, accent: 'indigo' },
  { id: 'purchases', label: '仕入', icon: ShoppingCart, accent: 'amber' },
  { id: 'expenses', label: '販管費', icon: Receipt, accent: 'rose' },
];

// ==================== COMPONENT ====================
export default function DataBrowseScreen() {
  const [activeTab, setActiveTab] = useState('sales');
  const [storeFilter, setStoreFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-05-01');
  const [dateTo, setDateTo] = useState('2026-05-10');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [toast, setToast] = useState(null);

  const PAGE_SIZE = 10;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const storeById = useMemo(() => {
    const m = {};
    mockStores.forEach(s => { m[s.id] = s; });
    return m;
  }, []);

  // Get raw data for current tab
  const rawData = useMemo(() => {
    if (activeTab === 'sales') return allSales;
    if (activeTab === 'purchases') return allPurchases;
    return allExpenses;
  }, [activeTab]);

  // Filter
  const filteredData = useMemo(() => {
    let result = [...rawData];
    
    if (storeFilter !== 'all') {
      result = result.filter(r => r.storeId === storeFilter);
    }
    
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59);
    result = result.filter(r => r.dateObj >= fromDate && r.dateObj <= toDate);
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => {
        const store = storeById[r.storeId];
        if (store?.name.toLowerCase().includes(q)) return true;
        if (activeTab === 'purchases' && r.supplierName?.toLowerCase().includes(q)) return true;
        if (activeTab === 'purchases' && r.category?.includes(search)) return true;
        if (activeTab === 'expenses' && r.accountName?.includes(search)) return true;
        if (activeTab === 'expenses' && r.level1?.includes(search)) return true;
        return false;
      });
    }
    
    // Sort
    result.sort((a, b) => {
      let av, bv;
      if (sortColumn === 'date') {
        av = a.dateObj.getTime();
        bv = b.dateObj.getTime();
      } else if (sortColumn === 'store') {
        av = storeById[a.storeId]?.name || '';
        bv = storeById[b.storeId]?.name || '';
      } else if (sortColumn === 'amount') {
        av = activeTab === 'sales' ? a.grossSales : a.amount;
        bv = activeTab === 'sales' ? b.grossSales : b.amount;
      } else {
        av = a[sortColumn] || '';
        bv = b[sortColumn] || '';
      }
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [rawData, storeFilter, search, dateFrom, dateTo, sortColumn, sortDirection, activeTab, storeById]);

  const stats = useMemo(() => {
    if (activeTab === 'sales') {
      const totalGross = filteredData.reduce((sum, r) => sum + r.grossSales, 0);
      const totalCustomers = filteredData.reduce((sum, r) => sum + r.customers, 0);
      const totalTarget = filteredData.reduce((sum, r) => sum + r.targetSales, 0);
      const achievement = totalTarget > 0 ? Math.round((totalGross / totalTarget) * 100) : 0;
      return [
        { label: '件数', value: filteredData.length, unit: '件' },
        { label: '総売上合計', value: formatNumber(totalGross), unit: '' },
        { label: '客数合計', value: formatNumber(totalCustomers), unit: '名' },
        { label: '目標達成率', value: achievement, unit: '%', highlight: achievement >= 100 ? 'positive' : achievement >= 95 ? 'neutral' : 'negative' },
      ];
    } else if (activeTab === 'purchases') {
      const totalAmount = filteredData.reduce((sum, r) => sum + r.amount, 0);
      const uniqueSuppliers = new Set(filteredData.map(r => r.supplierName)).size;
      return [
        { label: '件数', value: filteredData.length, unit: '件' },
        { label: '仕入合計', value: formatNumber(totalAmount), unit: '' },
        { label: '取引先数', value: uniqueSuppliers, unit: '社' },
        { label: '平均単価', value: filteredData.length > 0 ? formatNumber(Math.round(totalAmount / filteredData.length)) : '—', unit: '' },
      ];
    } else {
      const totalAmount = filteredData.reduce((sum, r) => sum + r.amount, 0);
      const uniqueAccounts = new Set(filteredData.map(r => r.accountName)).size;
      return [
        { label: '件数', value: filteredData.length, unit: '件' },
        { label: '販管費合計', value: formatNumber(totalAmount), unit: '' },
        { label: '科目数', value: uniqueAccounts, unit: '科目' },
        { label: '平均単価', value: filteredData.length > 0 ? formatNumber(Math.round(totalAmount / filteredData.length)) : '—', unit: '' },
      ];
    }
  }, [filteredData, activeTab]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, storeFilter, search, dateFrom, dateTo]);

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setEditForm({ ...row });
    setEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    showToast('success', 'データを更新しました（デモ：実装時はDBに反映）');
    setEditModalOpen(false);
    setEditingRow(null);
  };

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50">
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
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .anim-fade { animation: fadeIn 0.3s ease-out backwards; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
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
              <span>データ閲覧</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              比
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Data Browser</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                データ閲覧
              </h1>
              <p className="text-sm text-slate-600">
                過去の売上・仕入・販管費を検索・フィルタ・編集できます。Excelへの出力も可能です。
              </p>
            </div>
            <button className="px-4 py-2.5 rounded-lg border border-slate-200 hover:border-slate-400 text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors bg-white">
              <Download className="w-4 h-4" />
              Excel出力
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-5 py-4 flex items-center justify-center gap-2 transition-all border-b-2 ${
                      isActive
                        ? 'border-slate-900 bg-slate-50/50 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50/30'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="font-display text-sm font-bold">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">フィルタ</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="検索..."
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </div>
            {/* Store */}
            <div className="relative">
              <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full pl-11 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer"
              >
                <option value="all">すべての店舗</option>
                {mockStores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {/* Date from */}
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </div>
            {/* Date to */}
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Table header */}
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <currentTab.icon className="w-4 h-4 text-slate-700" />
              <span className="font-display text-sm font-bold text-slate-900">
                {currentTab.label}データ
              </span>
              <span className="text-xs text-slate-500">· {filteredData.length}件</span>
            </div>
            <div className="text-xs text-slate-500">
              {filteredData.length > 0 ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredData.length)}` : '0'} / {filteredData.length}
            </div>
          </div>

          {filteredData.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <currentTab.icon className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-sm text-slate-500">
                条件に一致するデータが見つかりません
              </div>
            </div>
          ) : (
            <>
              {/* Sales table */}
              {activeTab === 'sales' && (
                <SalesTable
                  data={paginatedData}
                  storeById={storeById}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onEdit={handleEdit}
                />
              )}
              {activeTab === 'purchases' && (
                <PurchasesTable
                  data={paginatedData}
                  storeById={storeById}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onEdit={handleEdit}
                />
              )}
              {activeTab === 'expenses' && (
                <ExpensesTable
                  data={paginatedData}
                  storeById={storeById}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onEdit={handleEdit}
                />
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {currentPage} / {totalPages} ページ
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-8 h-8 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-700" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = currentPage - 2 + i;
                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-num font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-200 hover:border-slate-400 text-slate-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 rounded-lg border border-slate-200 hover:border-slate-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Help text */}
        <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 列ヘッダをクリックすると並び替えできます</p>
          <p>· 行の編集ボタンから個別に修正可能（権限内）。Excelで一括修正したい場合は出力→編集→取込の流れが効率的</p>
          <p>· 期間を狭めると絞り込みが速くなります</p>
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

      {/* Edit Modal */}
      {editModalOpen && editingRow && (
        <EditModal
          tab={activeTab}
          row={editingRow}
          form={editForm}
          setForm={setEditForm}
          storeById={storeById}
          onClose={() => { setEditModalOpen(false); setEditingRow(null); }}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

// ==================== TABLES ====================
function SalesTable({ data, storeById, sortColumn, sortDirection, onSort, onEdit }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-white border-b border-slate-200">
          <tr>
            <SortableTh col="date" current={sortColumn} dir={sortDirection} onClick={onSort}>日付</SortableTh>
            <SortableTh col="store" current={sortColumn} dir={sortDirection} onClick={onSort}>店舗</SortableTh>
            <Th>区分</Th>
            <SortableTh col="amount" current={sortColumn} dir={sortDirection} onClick={onSort} align="right">総売上</SortableTh>
            <Th align="right">客数</Th>
            <Th align="right">客単価</Th>
            <Th align="right">目標</Th>
            <Th align="right">達成率</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, idx) => {
            const store = storeById[row.storeId];
            const achievement = Math.round((row.grossSales / row.targetSales) * 100);
            const avg = Math.round(row.grossSales / row.customers);
            return (
              <tr key={row.id} className="hover:bg-slate-50 anim-fade" style={{ animationDelay: `${idx * 20}ms` }}>
                <Td><span className="font-num font-medium text-slate-900">{row.date}</span></Td>
                <Td><span className="text-slate-900 font-medium">{store?.name}</span></Td>
                <Td><DayPeriodBadge period={row.dayPeriod} /></Td>
                <Td align="right"><span className="font-num font-bold text-slate-900">{store?.symbol}{formatNumber(row.grossSales)}</span></Td>
                <Td align="right"><span className="font-num text-slate-700">{row.customers}</span></Td>
                <Td align="right"><span className="font-num text-slate-700">{store?.symbol}{formatNumber(avg)}</span></Td>
                <Td align="right"><span className="font-num text-slate-500">{store?.symbol}{formatNumber(row.targetSales)}</span></Td>
                <Td align="right"><AchievementBadge value={achievement} /></Td>
                <Td>
                  <button onClick={() => onEdit(row)} className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center">
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PurchasesTable({ data, storeById, sortColumn, sortDirection, onSort, onEdit }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-white border-b border-slate-200">
          <tr>
            <SortableTh col="date" current={sortColumn} dir={sortDirection} onClick={onSort}>日付</SortableTh>
            <SortableTh col="store" current={sortColumn} dir={sortDirection} onClick={onSort}>店舗</SortableTh>
            <SortableTh col="supplierName" current={sortColumn} dir={sortDirection} onClick={onSort}>仕入先</SortableTh>
            <Th>カテゴリ</Th>
            <SortableTh col="amount" current={sortColumn} dir={sortDirection} onClick={onSort} align="right">金額</SortableTh>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, idx) => {
            const store = storeById[row.storeId];
            return (
              <tr key={row.id} className="hover:bg-slate-50 anim-fade" style={{ animationDelay: `${idx * 20}ms` }}>
                <Td><span className="font-num font-medium text-slate-900">{row.date}</span></Td>
                <Td><span className="text-slate-900 font-medium">{store?.name}</span></Td>
                <Td><span className="text-slate-900">{row.supplierName}</span></Td>
                <Td>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                    {row.category}
                  </span>
                </Td>
                <Td align="right"><span className="font-num font-bold text-slate-900">{store?.symbol}{formatNumber(row.amount)}</span></Td>
                <Td>
                  <button onClick={() => onEdit(row)} className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center">
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpensesTable({ data, storeById, sortColumn, sortDirection, onSort, onEdit }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-white border-b border-slate-200">
          <tr>
            <SortableTh col="date" current={sortColumn} dir={sortDirection} onClick={onSort}>日付</SortableTh>
            <SortableTh col="store" current={sortColumn} dir={sortDirection} onClick={onSort}>店舗</SortableTh>
            <SortableTh col="accountName" current={sortColumn} dir={sortDirection} onClick={onSort}>科目</SortableTh>
            <Th>分類</Th>
            <SortableTh col="amount" current={sortColumn} dir={sortDirection} onClick={onSort} align="right">金額</SortableTh>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, idx) => {
            const store = storeById[row.storeId];
            return (
              <tr key={row.id} className="hover:bg-slate-50 anim-fade" style={{ animationDelay: `${idx * 20}ms` }}>
                <Td><span className="font-num font-medium text-slate-900">{row.date}</span></Td>
                <Td><span className="text-slate-900 font-medium">{store?.name}</span></Td>
                <Td><span className="text-slate-900">{row.accountName}</span></Td>
                <Td>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                    {row.level1}
                  </span>
                </Td>
                <Td align="right"><span className="font-num font-bold text-slate-900">{store?.symbol}{formatNumber(row.amount)}</span></Td>
                <Td>
                  <button onClick={() => onEdit(row)} className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center">
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ==================== EDIT MODAL ====================
function EditModal({ tab, row, form, setForm, storeById, onClose, onSave }) {
  const store = storeById[row.storeId];
  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in my-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Edit Record</div>
            <h3 className="font-display text-xl font-bold text-slate-900">
              {tab === 'sales' ? '売上' : tab === 'purchases' ? '仕入' : '販管費'}データを編集
            </h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">日付</div>
              <div className="font-num text-sm font-bold text-slate-900">{row.date}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">店舗</div>
              <div className="text-sm font-medium text-slate-900 truncate">{store?.name}</div>
            </div>
          </div>

          {/* Sales fields */}
          {tab === 'sales' && (
            <>
              <FormField label="総売上（税込）" required>
                <NumberInput value={form.grossSales} onChange={(v) => update('grossSales', v)} prefix={store?.symbol} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="客数" required>
                  <NumberInput value={form.customers} onChange={(v) => update('customers', v)} suffix="名" />
                </FormField>
                <FormField label="目標">
                  <NumberInput value={form.targetSales} onChange={(v) => update('targetSales', v)} prefix={store?.symbol} />
                </FormField>
              </div>
            </>
          )}

          {/* Purchases fields */}
          {tab === 'purchases' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="仕入先">
                  <input value={form.supplierName} disabled className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700" />
                </FormField>
                <FormField label="カテゴリ">
                  <input value={form.category} disabled className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700" />
                </FormField>
              </div>
              <FormField label="金額" required>
                <NumberInput value={form.amount} onChange={(v) => update('amount', v)} prefix={store?.symbol} />
              </FormField>
            </>
          )}

          {/* Expenses fields */}
          {tab === 'expenses' && (
            <>
              <FormField label="科目">
                <input value={form.accountName} disabled className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700" />
              </FormField>
              <FormField label="金額" required>
                <NumberInput value={form.amount} onChange={(v) => update('amount', v)} prefix={store?.symbol} />
              </FormField>
            </>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              編集内容は即時にDBに反映されます。変更履歴は保持されないため、慎重に確認してください。
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
            キャンセル
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB COMPONENTS ====================
function StatCard({ label, value, unit, highlight }) {
  let valueClass = 'text-slate-900';
  if (highlight === 'positive') valueClass = 'text-emerald-600';
  else if (highlight === 'negative') valueClass = 'text-rose-600';
  
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2 truncate">{label}</div>
      <div className="flex items-baseline gap-1">
        <div className={`font-num text-xl sm:text-2xl font-bold ${valueClass}`}>{value}</div>
        {unit && <div className="text-sm text-slate-500">{unit}</div>}
      </div>
    </div>
  );
}

function Th({ children, align }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function SortableTh({ col, current, dir, onClick, children, align }) {
  const isActive = current === col;
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button onClick={() => onClick(col)} className={`inline-flex items-center gap-1 hover:text-slate-900 ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
        {children}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function Td({ children, align }) {
  return (
    <td className={`px-4 py-3 text-sm whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}

function DayPeriodBadge({ period }) {
  if (period === 'all') {
    return <span className="text-xs text-slate-500">通常</span>;
  }
  const isLunch = period === 'lunch';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      isLunch ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    }`}>
      {isLunch ? 'ランチ' : 'ディナー'}
    </span>
  );
}

function AchievementBadge({ value }) {
  let color = 'bg-slate-100 text-slate-700';
  if (value >= 100) color = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  else if (value >= 95) color = 'bg-slate-100 text-slate-700 border border-slate-200';
  else color = 'bg-rose-50 text-rose-700 border border-rose-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-num ${color}`}>
      {value}%
    </span>
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

function NumberInput({ value, onChange, prefix, suffix }) {
  const formatted = value !== '' && value !== null && value !== undefined ? formatNumber(value) : '';
  return (
    <div className="relative">
      {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</span>}
      <input
        type="text"
        value={formatted}
        onChange={(e) => onChange(Number(e.target.value.replace(/,/g, '')) || 0)}
        className={`w-full ${prefix ? 'pl-9' : 'pl-4'} ${suffix ? 'pr-10' : 'pr-4'} py-3 border border-slate-200 rounded-lg text-right font-num font-medium bg-white text-sm`}
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{suffix}</span>}
    </div>
  );
}
