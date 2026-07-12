import React, { useState, useMemo } from 'react';
import { Calendar, CloudSun, Plus, Save, Trash2, Edit3, Check, AlertCircle, ChevronDown, ChevronUp, ArrowDownToLine, X, Search, Sparkles, TrendingUp } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockStore = {
  id: 'store_aoki_thai',
  name: 'あお季タイ',
  country: 'Thailand',
  currency: 'THB',
  symbol: '฿',
  serviceFeeRate: 0.10,
  taxRate: 0.07,
  isLunchDinnerSplit: false,
  isWeatherEnabled: true,
};

const mockSuppliers = [
  { id: 's1', name: 'Bacchus Global', category: '酒類' },
  { id: 's2', name: 'Asan service', category: '酒類' },
  { id: 's3', name: 'Shibataya Thailand', category: '酒類' },
  { id: 's4', name: 'Kobeya', category: '酒類' },
  { id: 's5', name: 'SCS Trading', category: '酒類' },
  { id: 's6', name: 'KING OF BEEF', category: '肉類' },
  { id: 's7', name: 'NEXS', category: '肉類' },
  { id: 's8', name: 'BETAGRO', category: '鶏肉' },
  { id: 's9', name: 'Kingdom Organic', category: '野菜' },
  { id: 's10', name: 'FOOD PROJECT', category: '食品' },
  { id: 's11', name: 'Koubeya Syokuhin', category: '食品' },
  { id: 's12', name: 'Nishihara', category: '食品' },
  { id: 's13', name: 'Todokeru Foods', category: '魚・食品' },
  { id: 's14', name: 'Kanezin Japan', category: 'うどん' },
  { id: 's15', name: 'SUZUKI ICE', category: '氷' },
  { id: 's16', name: 'Kamenoya', category: '炭・藁' },
  { id: 's17', name: 'Kokoro Sato Co., Ltd.', category: 'おしぼり' },
];

const mockExpenseAccounts = [
  { id: 'e1', name: '給与', level1: '人件費' },
  { id: 'e2', name: '社会保険拠出金', level1: '人件費' },
  { id: 'e3', name: '事務所賃借料', level1: '賃料' },
  { id: 'e4', name: '店舗賃借料', level1: '賃料' },
  { id: 'e5', name: '電気代', level1: '光熱費' },
  { id: 'e6', name: '水道料', level1: '光熱費' },
  { id: 'e7', name: 'ガス代', level1: '光熱費' },
  { id: 'e8', name: '通信費', level1: 'その他' },
  { id: 'e9', name: '広告宣伝費', level1: '広告' },
  { id: 'e10', name: '会計サービス料', level1: 'その他' },
];

const todayTarget = 85600;
const previousDayInventoryAmount = 500000;
const previousDayInventoryDate = '2026年5月1日';

// ==================== UTILITY ====================
const formatNumber = (n) => {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('en-US');
};

const parseNumber = (str) => {
  if (typeof str === 'number') return str;
  return Number(String(str).replace(/,/g, '')) || 0;
};

const today = new Date();
const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
const todayInputValue = today.toISOString().split('T')[0];

// ==================== COMPONENT ====================
export default function DailyInputScreen() {
  // Basic info
  const [date, setDate] = useState(todayInputValue);
  const [weather, setWeather] = useState('晴');

  // Sales
  const [grossSales, setGrossSales] = useState('');
  const [customerCount, setCustomerCount] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [discount, setDiscount] = useState('');
  const [influencerDiscount, setInfluencerDiscount] = useState('');

  // Purchase (bulk pattern)
  const [noPurchase, setNoPurchase] = useState(false);
  const [supplierAmounts, setSupplierAmounts] = useState({}); // { supplierId: amount }
  const [supplierSearch, setSupplierSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Expense
  const [expenseExpanded, setExpenseExpanded] = useState(false);
  const [expenses, setExpenses] = useState({});

  // Inventory
  const [inventoryAmount, setInventoryAmount] = useState(previousDayInventoryAmount);
  const [inventoryUpdateDate, setInventoryUpdateDate] = useState(previousDayInventoryDate);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryDraft, setInventoryDraft] = useState('');
  const [inventoryNotes, setInventoryNotes] = useState('');

  // UI state
  const [saveStatus, setSaveStatus] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // ==================== CALCULATIONS ====================
  const calc = useMemo(() => {
    const gross = parseNumber(grossSales);
    const count = parseNumber(customerCount);
    if (gross === 0) return { net: 0, service: 0, tax: 0, avg: 0 };
    const net = gross / (1 + mockStore.serviceFeeRate + mockStore.taxRate);
    return {
      net: Math.round(net * 100) / 100,
      service: Math.round(net * mockStore.serviceFeeRate * 100) / 100,
      tax: Math.round(net * mockStore.taxRate * 100) / 100,
      avg: count > 0 ? Math.round(gross / count) : 0,
    };
  }, [grossSales, customerCount]);

  const targetAchievement = useMemo(() => {
    if (calc.net === 0) return 0;
    return Math.round((calc.net / todayTarget) * 100);
  }, [calc.net]);

  // Supplier groupings
  const suppliersByCategory = useMemo(() => {
    const filtered = mockSuppliers.filter(s =>
      supplierSearch === '' ||
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.category.includes(supplierSearch)
    );
    const groups = {};
    filtered.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [supplierSearch]);

  const totalPurchases = useMemo(() => {
    if (noPurchase) return 0;
    return Object.values(supplierAmounts).reduce((sum, v) => sum + parseNumber(v), 0);
  }, [supplierAmounts, noPurchase]);

  const filledSupplierCount = useMemo(() => {
    return Object.values(supplierAmounts).filter(v => parseNumber(v) > 0).length;
  }, [supplierAmounts]);

  const categorySubtotals = useMemo(() => {
    const subs = {};
    mockSuppliers.forEach(s => {
      const v = parseNumber(supplierAmounts[s.id] || 0);
      if (!subs[s.category]) subs[s.category] = { count: 0, total: 0 };
      if (v > 0) {
        subs[s.category].count += 1;
        subs[s.category].total += v;
      }
    });
    return subs;
  }, [supplierAmounts]);

  const totalExpenses = useMemo(() => {
    return Object.values(expenses).reduce((sum, v) => sum + parseNumber(v), 0);
  }, [expenses]);

  const expenseGrouped = useMemo(() => {
    const groups = {};
    mockExpenseAccounts.forEach(acc => {
      if (!groups[acc.level1]) groups[acc.level1] = [];
      groups[acc.level1].push(acc);
    });
    return groups;
  }, []);

  // ==================== HANDLERS ====================
  const handleSupplierAmount = (id, value) => {
    setSupplierAmounts({ ...supplierAmounts, [id]: value });
  };

  const handleClearSupplier = (id) => {
    const next = { ...supplierAmounts };
    delete next[id];
    setSupplierAmounts(next);
  };

  const toggleCategory = (cat) => {
    setCollapsedCategories({ ...collapsedCategories, [cat]: !collapsedCategories[cat] });
  };

  const handleInventoryUpdate = () => {
    if (inventoryDraft && parseNumber(inventoryDraft) >= 0) {
      setInventoryAmount(parseNumber(inventoryDraft));
      setInventoryUpdateDate(todayStr);
      setInventoryModalOpen(false);
      setInventoryDraft('');
      setInventoryNotes('');
    }
  };

  const handleCopyPreviousDay = () => {
    setGrossSales('152000');
    setCustomerCount('38');
    setWeather('晴');
  };

  const handleSave = () => {
    const errors = [];
    if (!grossSales) errors.push('総売上を入力してください');
    if (!customerCount) errors.push('客数を入力してください');
    if (errors.length > 0) {
      setValidationErrors(errors);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3500);
      return;
    }
    setValidationErrors([]);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
        
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        
        .font-display { font-family: 'Bricolage Grotesque', 'Noto Sans JP', sans-serif; letter-spacing: -0.02em; }
        .font-body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        .font-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; letter-spacing: -0.01em; }
        
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #0F172A;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
        }
        
        .filled-input {
          background: linear-gradient(0deg, rgba(99, 102, 241, 0.04), rgba(99, 102, 241, 0.04));
          border-color: #6366F1 !important;
        }
        
        .gradient-border-active {
          position: relative;
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.3s ease-out; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
      `}</style>

      {/* ==================== HEADER ==================== */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                <span className="font-display text-white text-lg font-bold">K</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white pulse-dot" />
            </div>
            <div>
              <div className="font-display text-base font-bold text-slate-900 leading-tight">
                Sales Console
              </div>
              <div className="text-[11px] text-slate-500 tracking-widest uppercase">
                KOGA Holdings
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">Manager</div>
              <div className="text-sm font-medium text-slate-900">山田 太郎</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              山
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MAIN ==================== */}
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-10 pb-32">
        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Daily Input</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-3">
            日次入力
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{mockStore.name}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{mockStore.country}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="font-num font-medium">{mockStore.currency} ({mockStore.symbol})</span>
          </div>
        </div>

        {/* Hero stat card */}
        <div className="mb-8 anim-in">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 sm:p-8 relative overflow-hidden">
            {/* decorative gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/10 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/60 mb-2">本日の目標達成</div>
                  <div className="font-num text-5xl sm:text-6xl font-bold tracking-tight">
                    {targetAchievement}<span className="text-2xl text-white/60">%</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  targetAchievement >= 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                  targetAchievement >= 95 ? 'bg-white/10 text-white/80 border border-white/20' :
                  'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                }`}>
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  {targetAchievement >= 100 ? '達成' : targetAchievement >= 95 ? '許容圏' : '要注意'}
                </div>
              </div>
              
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    targetAchievement >= 100 ? 'bg-emerald-400' :
                    targetAchievement >= 95 ? 'bg-white' :
                    'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(targetAchievement, 100)}%` }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                <div>
                  <div className="text-xs text-white/60 mb-1">本日売上（税抜）</div>
                  <div className="font-num text-xl font-bold">
                    {mockStore.symbol}{formatNumber(calc.net)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">目標</div>
                  <div className="font-num text-xl font-bold text-white/70">
                    {mockStore.symbol}{formatNumber(todayTarget)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save status */}
        {saveStatus === 'success' && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 flex items-center gap-3 anim-in">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-900">保存完了</div>
              <div className="text-xs text-emerald-700">本日のデータを記録しました</div>
            </div>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 px-5 py-4 anim-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-rose-900">入力エラー</div>
                <div className="text-xs text-rose-700">必須項目を確認してください</div>
              </div>
            </div>
            <ul className="text-sm pl-11 space-y-0.5 text-rose-800">
              {validationErrors.map((err, i) => <li key={i}>· {err}</li>)}
            </ul>
          </div>
        )}

        {/* ==================== ① 基本情報 ==================== */}
        <Section number="01" label="Basic" title="基本情報">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="営業日">
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-lg text-sm font-body bg-white"
                />
              </div>
            </Field>
            {mockStore.isWeatherEnabled && (
              <Field label="天気">
                <div className="relative">
                  <CloudSun className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <select
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-lg text-sm font-body bg-white appearance-none cursor-pointer"
                  >
                    <option value="晴">☀ 晴</option>
                    <option value="曇">☁ 曇</option>
                    <option value="雨">☂ 雨</option>
                    <option value="雷雨">⚡ 雷雨</option>
                  </select>
                </div>
              </Field>
            )}
          </div>
        </Section>

        {/* ==================== ② 売上 ==================== */}
        <Section number="02" label="Revenue" title="売上" required>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Field label="総売上（税込）" required>
              <NumberInput value={grossSales} onChange={setGrossSales} prefix={mockStore.symbol} />
            </Field>
            <Field label="客数" required>
              <NumberInput value={customerCount} onChange={setCustomerCount} suffix="人" />
            </Field>
          </div>

          {/* Auto calc display */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">自動計算</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="サービス料 10%" value={`${mockStore.symbol}${formatNumber(calc.service)}`} />
              <Stat label="VAT 7%" value={`${mockStore.symbol}${formatNumber(calc.tax)}`} />
              <Stat label="税抜売上" value={`${mockStore.symbol}${formatNumber(calc.net)}`} accent />
              <Stat label="客単価" value={`${mockStore.symbol}${formatNumber(calc.avg)}`} />
            </div>
          </div>

          {/* Optional discount */}
          <button
            onClick={() => setShowOptional(!showOptional)}
            className="mt-4 text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-medium"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
            割引・インフルエンサー値引（任意）
          </button>
          {showOptional && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 anim-in">
              <Field label="割引">
                <NumberInput value={discount} onChange={setDiscount} prefix={mockStore.symbol} />
              </Field>
              <Field label="インフルエンサー値引">
                <NumberInput value={influencerDiscount} onChange={setInfluencerDiscount} prefix={mockStore.symbol} />
              </Field>
            </div>
          )}
        </Section>

        {/* ==================== ③ 仕入（一括チェックリスト方式） ==================== */}
        <Section
          number="03"
          label="Purchases"
          title="仕入"
          subtitle="発生日のみ"
          rightSlot={
            !noPurchase && filledSupplierCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500">入力済み</div>
                <div className="font-num text-sm font-bold text-indigo-600">{filledSupplierCount}件</div>
              </div>
            )
          }
        >
          <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noPurchase}
              onChange={(e) => setNoPurchase(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-slate-900"
            />
            <span className="text-sm text-slate-700">本日は仕入なし（このセクションをスキップ）</span>
          </label>

          {!noPurchase && (
            <>
              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="仕入先名・カテゴリで絞り込み..."
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm font-body bg-white"
                />
              </div>

              {/* Grouped supplier list */}
              <div className="space-y-3">
                {Object.entries(suppliersByCategory).map(([category, suppliers]) => {
                  const subtotal = categorySubtotals[category] || { count: 0, total: 0 };
                  const isCollapsed = collapsedCategories[category];
                  return (
                    <div key={category} className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-5 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="font-display text-sm font-bold text-slate-900">{category}</div>
                          <div className="text-xs text-slate-500">{suppliers.length}社</div>
                          {subtotal.count > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                              <Check className="w-3 h-3" />
                              {subtotal.count}件
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {subtotal.total > 0 && (
                            <div className="font-num text-sm font-semibold text-slate-900">
                              {mockStore.symbol}{formatNumber(subtotal.total)}
                            </div>
                          )}
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="divide-y divide-slate-100">
                          {suppliers.map(s => {
                            const value = supplierAmounts[s.id] || '';
                            const hasValue = parseNumber(value) > 0;
                            return (
                              <div key={s.id} className={`flex items-center gap-3 px-5 py-2.5 transition-colors ${hasValue ? 'bg-indigo-50/40' : 'bg-white'}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-900 truncate">{s.name}</div>
                                </div>
                                <div className="relative w-32 sm:w-40 flex-shrink-0">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{mockStore.symbol}</span>
                                  <input
                                    type="text"
                                    value={value ? formatNumber(value) : ''}
                                    onChange={(e) => handleSupplierAmount(s.id, e.target.value.replace(/,/g, ''))}
                                    placeholder="0"
                                    className={`w-full pl-7 pr-8 py-1.5 border rounded-md text-right font-num text-sm transition-all ${
                                      hasValue ? 'filled-input' : 'border-slate-200 bg-white'
                                    }`}
                                  />
                                  {hasValue && (
                                    <button
                                      onClick={() => handleClearSupplier(s.id)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                                    >
                                      <X className="w-2.5 h-2.5 text-slate-600" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {Object.keys(suppliersByCategory).length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-500">
                    該当する仕入先が見つかりません
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="mt-5 pt-5 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-900">仕入合計</div>
                <div className="font-num text-2xl font-bold text-slate-900">
                  {mockStore.symbol}{formatNumber(totalPurchases)}
                </div>
              </div>
            </>
          )}
        </Section>

        {/* ==================== ④ 販管費 ==================== */}
        <Section
          number="04"
          label="OpEx"
          title="販管費"
          collapsible
          collapsed={!expenseExpanded}
          onToggle={() => setExpenseExpanded(!expenseExpanded)}
          rightSlot={
            totalExpenses > 0 && (
              <div className="font-num text-sm font-semibold text-slate-700">
                {mockStore.symbol}{formatNumber(totalExpenses)}
              </div>
            )
          }
        >
          {expenseExpanded && (
            <div className="space-y-5 anim-in">
              {Object.entries(expenseGrouped).map(([groupName, accounts]) => (
                <div key={groupName}>
                  <div className="font-display text-xs font-bold text-slate-900 mb-3 uppercase tracking-wider">
                    {groupName}
                  </div>
                  <div className="space-y-1.5">
                    {accounts.map(acc => (
                      <div key={acc.id} className="flex items-center gap-3 py-1">
                        <div className="flex-1 text-sm text-slate-700">{acc.name}</div>
                        <div className="relative w-32 sm:w-40">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{mockStore.symbol}</span>
                          <input
                            type="text"
                            value={expenses[acc.id] ? formatNumber(expenses[acc.id]) : ''}
                            onChange={(e) => setExpenses({ ...expenses, [acc.id]: e.target.value.replace(/,/g, '') })}
                            placeholder="0"
                            className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-md text-right font-num text-sm bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ==================== ⑤ 概算棚卸 ==================== */}
        <Section number="05" label="Inventory" title="概算棚卸" subtitle="更新時のみ入力">
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">現在の概算棚卸</div>
              <div className="font-num text-3xl sm:text-4xl font-bold text-slate-900 mb-1">
                {mockStore.symbol}{formatNumber(inventoryAmount)}
              </div>
              <div className="text-xs text-slate-500">
                最終更新：<span className="font-medium text-slate-700">{inventoryUpdateDate}</span>
              </div>
            </div>
            <button
              onClick={() => setInventoryModalOpen(true)}
              className="px-5 py-2.5 rounded-lg border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-all text-sm font-medium flex items-center gap-2 group"
            >
              <Edit3 className="w-4 h-4" />
              更新する
            </button>
          </div>
        </Section>

        {/* ==================== Footer Notes ==================== */}
        <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· サービス料・税額・税抜売上・客単価は総売上から自動計算されます</p>
          <p>· 概算棚卸は次回更新まで同じ値が継続します。月末にリマインダー通知が届きます</p>
          <p>· 「保存」を押すまでデータは確定されません</p>
        </div>
      </main>

      {/* ==================== Sticky Save Bar ==================== */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur-md z-30">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row gap-3 items-stretch">
          <button
            onClick={handleCopyPreviousDay}
            className="px-5 py-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-sm font-medium flex items-center justify-center gap-2 text-slate-700"
          >
            <ArrowDownToLine className="w-4 h-4" />
            前日の値をコピー
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all"
          >
            <Save className="w-4 h-4" />
            保存する
          </button>
        </div>
      </div>

      {/* ==================== Inventory Modal ==================== */}
      {inventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Update</div>
                <h3 className="font-display text-xl font-bold text-slate-900">概算棚卸</h3>
              </div>
              <button onClick={() => setInventoryModalOpen(false)} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500 mb-1">現在の値</div>
                <div className="font-num text-lg font-bold text-slate-900">
                  {mockStore.symbol}{formatNumber(inventoryAmount)}
                </div>
              </div>
              <Field label="新しい棚卸金額" required>
                <NumberInput value={inventoryDraft} onChange={setInventoryDraft} prefix={mockStore.symbol} large />
              </Field>
              <Field label="備考（任意）">
                <textarea
                  value={inventoryNotes}
                  onChange={(e) => setInventoryNotes(e.target.value)}
                  placeholder="月末棚卸／実地確認 など"
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm font-body bg-white"
                  rows={3}
                />
              </Field>
              <div className="text-xs leading-relaxed text-slate-500 pt-1">
                棚卸金額は最新値のみ保持され、上書きされます。在庫資産の現状把握用の参考値として使用されます。
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => setInventoryModalOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleInventoryUpdate}
                disabled={!inventoryDraft || parseNumber(inventoryDraft) < 0}
                className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                更新する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SUB COMPONENTS ====================
function Section({ number, label, title, subtitle, required, children, collapsible, collapsed, onToggle, rightSlot }) {
  const HeadingWrap = collapsible ? 'button' : 'div';
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <HeadingWrap
        onClick={collapsible ? onToggle : undefined}
        className={`w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-3 ${collapsible ? 'hover:bg-slate-50 cursor-pointer' : ''} ${collapsible && !collapsed ? 'border-b border-slate-100' : ''}`}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex flex-col items-start gap-0.5">
            <div className="font-num text-[10px] font-bold text-slate-400 tracking-widest">{number}</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 truncate">{title}</h2>
            {required && <span className="text-rose-500 text-xs font-medium">必須</span>}
            {subtitle && <span className="text-xs text-slate-500 hidden sm:inline">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {rightSlot}
          {collapsible && (
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${!collapsed ? 'rotate-180' : ''}`} />
          )}
        </div>
      </HeadingWrap>
      {(!collapsible || !collapsed) && (
        <div className="px-5 sm:px-6 py-5 sm:py-6">
          {children}
        </div>
      )}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, prefix, suffix, large }) {
  return (
    <div className="relative">
      {prefix && <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 ${large ? 'text-base' : 'text-sm'}`}>{prefix}</span>}
      <input
        type="text"
        value={value ? formatNumber(value) : ''}
        onChange={(e) => onChange(e.target.value.replace(/,/g, ''))}
        placeholder="0"
        className={`w-full ${prefix ? 'pl-9' : 'pl-4'} ${suffix ? 'pr-10' : 'pr-4'} ${large ? 'py-3.5 text-lg' : 'py-3 text-sm'} border border-slate-200 rounded-lg text-right font-num font-medium bg-white`}
      />
      {suffix && <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 ${large ? 'text-base' : 'text-sm'}`}>{suffix}</span>}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-1.5 uppercase tracking-wider">{label}</div>
      <div className={`font-num font-bold ${accent ? 'text-slate-900 text-lg' : 'text-slate-700 text-base'}`}>
        {value || '—'}
      </div>
    </div>
  );
}
