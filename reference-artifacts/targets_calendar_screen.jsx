import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, Check, AlertTriangle, X, Store, Copy, Sparkles, Upload, Download, Calendar, TrendingUp, Activity, Wand2 } from 'lucide-react';

// ==================== MOCK DATA ====================
const mockStores = [
  { id: 'store_aoki_thai', name: 'あお季タイ', country: 'Thailand', currency: 'THB', symbol: '฿' },
  { id: 'store_aoki_robata', name: 'AOKI ロバタ', country: 'Thailand', currency: 'THB', symbol: '฿' },
  { id: 'store_hakata_tenjin', name: '博多天神ジャカルタ', country: 'Indonesia', currency: 'IDR', symbol: 'Rp' },
];

// Pre-filled mock targets for あお季タイ - May 2026
const initialTargets = {
  store_aoki_thai: {
    '2026-05-01': 85600,
    '2026-05-02': 95000,
    '2026-05-03': 95000,
    '2026-05-04': 70000,
    '2026-05-05': 70000,
    '2026-05-06': 85000,
    '2026-05-07': 85000,
    '2026-05-08': 90000,
    '2026-05-09': 95000,
    '2026-05-10': 95000,
  },
  store_aoki_robata: {},
  store_hakata_tenjin: {},
};

// Previous month targets for copy feature
const previousMonthTargets = {
  store_aoki_thai: {
    '2026-04-01': 80000,
    '2026-04-02': 80000,
    '2026-04-03': 90000,
    '2026-04-04': 90000,
    '2026-04-05': 65000,
    // ... abbreviated for demo
  },
};

// ==================== UTILITIES ====================
const formatNumber = (n) => {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('en-US');
};

const parseNumber = (str) => {
  if (typeof str === 'number') return str;
  return Number(String(str).replace(/,/g, '')) || 0;
};

const formatYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

const today = new Date();
const todayYMD = formatYMD(today);

// ==================== COMPONENT ====================
export default function TargetsCalendarScreen() {
  const [selectedStoreId, setSelectedStoreId] = useState('store_aoki_thai');
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(5); // 1-indexed
  const [targets, setTargets] = useState(initialTargets);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState('weekdays'); // weekdays | weekends | all
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const selectedStore = mockStores.find(s => s.id === selectedStoreId);

  // Calendar calculation
  const calendarData = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0=Sun

    // Build cells: leading empty + days + trailing empty
    const cells = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ empty: true, key: `e_${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth - 1, d);
      const ymd = formatYMD(date);
      const dow = date.getDay();
      cells.push({
        empty: false,
        date,
        ymd,
        day: d,
        dow,
        isWeekend: dow === 0 || dow === 6,
        isToday: ymd === todayYMD,
        key: ymd,
      });
    }
    // Trailing to fill last week
    while (cells.length % 7 !== 0) {
      cells.push({ empty: true, key: `t_${cells.length}` });
    }
    return { cells, daysInMonth };
  }, [viewYear, viewMonth]);

  const currentTargets = targets[selectedStoreId] || {};

  // Stats
  const stats = useMemo(() => {
    const monthDays = calendarData.cells.filter(c => !c.empty);
    const filledDays = monthDays.filter(c => parseNumber(currentTargets[c.ymd] || 0) > 0);
    const monthTotal = monthDays.reduce((sum, c) => sum + parseNumber(currentTargets[c.ymd] || 0), 0);
    const avgPerFilledDay = filledDays.length > 0 ? Math.round(monthTotal / filledDays.length) : 0;
    const weekdaysFilled = monthDays.filter(c => !c.isWeekend && parseNumber(currentTargets[c.ymd] || 0) > 0).length;
    const weekendsFilled = monthDays.filter(c => c.isWeekend && parseNumber(currentTargets[c.ymd] || 0) > 0).length;
    
    return {
      monthTotal,
      filledDays: filledDays.length,
      totalDays: monthDays.length,
      avgPerFilledDay,
      weekdaysFilled,
      weekendsFilled,
    };
  }, [calendarData, currentTargets]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAmountChange = (ymd, value) => {
    const cleaned = value.replace(/,/g, '');
    setTargets({
      ...targets,
      [selectedStoreId]: {
        ...currentTargets,
        [ymd]: cleaned,
      },
    });
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleApplyBulk = () => {
    if (!bulkAmount || parseNumber(bulkAmount) < 0) return;
    const amount = parseNumber(bulkAmount);
    const newTargets = { ...currentTargets };
    calendarData.cells.forEach(c => {
      if (c.empty) return;
      const shouldApply =
        (bulkType === 'all') ||
        (bulkType === 'weekdays' && !c.isWeekend) ||
        (bulkType === 'weekends' && c.isWeekend);
      if (shouldApply) {
        const existing = parseNumber(newTargets[c.ymd] || 0);
        if (bulkOverwrite || existing === 0) {
          newTargets[c.ymd] = String(amount);
        }
      }
    });
    setTargets({ ...targets, [selectedStoreId]: newTargets });
    setBulkModalOpen(false);
    setBulkAmount('');
    const targetLabel = bulkType === 'all' ? '全日' : bulkType === 'weekdays' ? '平日' : '土日';
    showToast('success', `${targetLabel}に ${selectedStore.symbol}${formatNumber(amount)} を適用しました`);
  };

  const handleCopyPreviousMonth = () => {
    const prev = previousMonthTargets[selectedStoreId] || {};
    if (Object.keys(prev).length === 0) {
      showToast('error', '前月のデータがありません');
      return;
    }
    // Map prev month dates to current month by day number
    const newTargets = { ...currentTargets };
    Object.entries(prev).forEach(([prevYmd, amount]) => {
      const [, , prevDay] = prevYmd.split('-');
      const dayNum = parseInt(prevDay);
      if (dayNum <= calendarData.daysInMonth) {
        const newYmd = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${prevDay}`;
        newTargets[newYmd] = String(amount);
      }
    });
    setTargets({ ...targets, [selectedStoreId]: newTargets });
    showToast('success', '前月の値をコピーしました');
  };

  const handleClearMonth = () => {
    if (!confirm('当月の入力をすべてクリアしますか？')) return;
    const newTargets = { ...currentTargets };
    calendarData.cells.forEach(c => {
      if (!c.empty) delete newTargets[c.ymd];
    });
    setTargets({ ...targets, [selectedStoreId]: newTargets });
    showToast('success', '当月の入力をクリアしました');
  };

  const handleSave = () => {
    showToast('success', `${viewYear}年${viewMonth}月の売上目標を保存しました（${stats.filledDays}日分）`);
  };

  const handleExportExcel = () => {
    showToast('success', `Excel出力：${selectedStore.name} ${viewYear}年${viewMonth}月の売上目標.xlsx`);
  };

  const monthNameLabel = `${viewYear}年${viewMonth}月`;
  const isCurrentMonth = (today.getFullYear() === viewYear && today.getMonth() + 1 === viewMonth);

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

        .calendar-input:focus {
          box-shadow: 0 0 0 2px #6366F1;
        }

        .filled-cell {
          background: linear-gradient(0deg, rgba(99, 102, 241, 0.06), rgba(99, 102, 241, 0.06));
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.25s ease-out; }
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
              <span>売上目標</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              比
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10 pb-32">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Daily Sales Targets</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                売上目標
              </h1>
              <p className="text-sm text-slate-600">
                曜日変動を反映した日別目標を月単位で入力。月初に1ヶ月分まとめて設定するのが推奨です。
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setImportModalOpen(true)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 hover:border-slate-400 text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Excel取込
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 rounded-lg border border-slate-200 hover:border-slate-400 text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Excel出力
              </button>
            </div>
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
                  <div className="font-display text-base font-bold mb-1 truncate">{store.name}</div>
                  <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                    <span className="font-num">{store.currency}</span> ({store.symbol})
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="月合計目標"
            value={`${selectedStore.symbol}${formatNumber(stats.monthTotal)}`}
            icon={TrendingUp}
            highlight
          />
          <StatCard
            label="入力済み日数"
            value={`${stats.filledDays} / ${stats.totalDays}`}
            unit="日"
            icon={Calendar}
          />
          <StatCard
            label="平均（入力日）"
            value={`${selectedStore.symbol}${formatNumber(stats.avgPerFilledDay)}`}
            icon={Activity}
          />
          <StatCard
            label="平日 / 土日"
            value={`${stats.weekdaysFilled} / ${stats.weekendsFilled}`}
            unit="日"
            icon={Sparkles}
          />
        </div>

        {/* Month Navigation + Bulk Operations */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="w-9 h-9 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
            <div className="px-4 py-2 min-w-[140px] text-center">
              <div className="font-display text-xl font-bold text-slate-900">{monthNameLabel}</div>
              {isCurrentMonth && (
                <div className="text-[10px] text-emerald-600 font-medium tracking-wider uppercase">Current</div>
              )}
            </div>
            <button
              onClick={handleNextMonth}
              className="w-9 h-9 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setBulkModalOpen(true)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              一括設定
            </button>
            <button
              onClick={handleCopyPreviousMonth}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              前月コピー
            </button>
            <button
              onClick={handleClearMonth}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-xs font-medium text-slate-700 hover:text-rose-700 flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              全クリア
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {dayNames.map((d, i) => (
              <div
                key={d}
                className={`px-2 py-3 text-xs font-bold text-center tracking-wider ${
                  i === 0 ? 'text-rose-600' : i === 6 ? 'text-blue-600' : 'text-slate-700'
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarData.cells.map((cell, idx) => {
              if (cell.empty) {
                return (
                  <div
                    key={cell.key}
                    className="aspect-square sm:min-h-[88px] border-r border-b border-slate-100 bg-slate-50/50"
                  />
                );
              }
              const value = currentTargets[cell.ymd] || '';
              const hasValue = parseNumber(value) > 0;
              const isLastCol = idx % 7 === 6;
              return (
                <div
                  key={cell.key}
                  className={`relative min-h-[80px] sm:min-h-[100px] border-b border-slate-100 ${
                    !isLastCol ? 'border-r' : ''
                  } ${cell.isWeekend ? 'bg-slate-50/40' : 'bg-white'} ${
                    hasValue ? 'filled-cell' : ''
                  } transition-colors`}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between p-2 pb-1">
                    <div className="flex items-center gap-1">
                      <span className={`font-num text-sm font-bold ${
                        cell.dow === 0 ? 'text-rose-600' :
                        cell.dow === 6 ? 'text-blue-600' :
                        'text-slate-900'
                      }`}>
                        {cell.day}
                      </span>
                      {cell.isToday && (
                        <span className="text-[8px] font-bold tracking-wider text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase">
                          Today
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Input */}
                  <div className="px-1.5 pb-1.5">
                    <input
                      type="text"
                      value={value ? formatNumber(value) : ''}
                      onChange={(e) => handleAmountChange(cell.ymd, e.target.value)}
                      placeholder="0"
                      className="calendar-input w-full px-1.5 py-1 text-xs text-right font-num bg-transparent border border-transparent rounded hover:border-slate-200 focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  {/* Symbol indicator if has value */}
                  {hasValue && (
                    <div className="absolute bottom-0.5 left-1.5 text-[9px] text-slate-400 font-num">
                      {selectedStore.symbol}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Help text */}
        <div className="mt-6 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 入力した値は3桁カンマ区切りで自動表示されます</p>
          <p>· 一括設定で平日／土日に同額を一気に適用できます</p>
          <p>· 前月コピーは前月の日付に対応する値を当月にマッピングします（5/1 ← 4/1）</p>
          <p>· Excel出力した値を編集して再取込すると、当月の目標が上書きされます</p>
          <p>· 0円のままの日は「目標なし」として扱われます（休業日や予定未定の日に使用）</p>
        </div>
      </main>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur-md z-30">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">月合計</div>
              <div className="font-num text-xl font-bold text-slate-900">
                {selectedStore.symbol}{formatNumber(stats.monthTotal)}
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-200" />
            <div className="hidden sm:block">
              <div className="text-xs text-slate-500 mb-0.5">入力進捗</div>
              <div className="font-num text-sm font-bold text-slate-900">
                {stats.filledDays} / {stats.totalDays} 日
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all"
          >
            <Save className="w-4 h-4" />
            保存する
          </button>
        </div>
      </div>

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

      {/* Bulk Apply Modal */}
      {bulkModalOpen && (
        <ModalShell title="一括設定" subtitle="Bulk Apply" onClose={() => setBulkModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">対象月</div>
              <div className="font-display text-base font-bold text-slate-900">{monthNameLabel} · {selectedStore.name}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                適用範囲 <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'weekdays', label: '平日', sub: '月〜金' },
                  { id: 'weekends', label: '土日', sub: '土・日' },
                  { id: 'all', label: '全日', sub: '月内すべて' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setBulkType(opt.id)}
                    className={`px-3 py-3 rounded-lg border text-center transition-all ${
                      bulkType === opt.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 hover:border-slate-400 bg-white text-slate-900'
                    }`}
                  >
                    <div className="font-display text-base font-bold">{opt.label}</div>
                    <div className={`text-[10px] mt-0.5 ${bulkType === opt.id ? 'text-white/70' : 'text-slate-500'}`}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                適用する金額 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">{selectedStore.symbol}</span>
                <input
                  type="text"
                  value={bulkAmount ? formatNumber(bulkAmount) : ''}
                  onChange={(e) => setBulkAmount(e.target.value.replace(/,/g, ''))}
                  placeholder="0"
                  className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-lg text-right font-num text-lg font-medium bg-white"
                  autoFocus
                />
              </div>
            </div>

            <label className="flex items-start gap-3 px-4 py-3 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkOverwrite}
                onChange={(e) => setBulkOverwrite(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer accent-slate-900 mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">既存の値も上書きする</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {bulkOverwrite ? '既存の入力済み値も新しい金額で上書きされます' : '空欄の日のみに適用され、既存値は保護されます'}
                </div>
              </div>
            </label>
          </div>
          <ModalFooter>
            <button onClick={() => setBulkModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleApplyBulk}
              disabled={!bulkAmount || parseNumber(bulkAmount) < 0}
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              適用する
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* Excel Import Modal */}
      {importModalOpen && (
        <ModalShell title="Excel取込" subtitle="Import" onClose={() => setImportModalOpen(false)}>
          <div className="space-y-5">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                取込ファイルに含まれる日付の目標値は、<span className="font-bold">既存値を上書き</span>します。<br />
                何度でも修正取込が可能で、最新の取込が常に正となります。
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl px-6 py-10 text-center hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-all">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <div className="text-sm font-medium text-slate-900 mb-1">
                Excelファイルをドラッグ＆ドロップ
              </div>
              <div className="text-xs text-slate-500">
                または クリックしてファイルを選択（.xlsx）
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed space-y-1">
              <p>· テンプレートはExcel出力ボタンから取得できます</p>
              <p>· マッチング条件：店舗ID × 対象日付</p>
              <p>· 取込ファイルに含まれない日付は変更されません</p>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setImportModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              disabled
              className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold opacity-40 cursor-not-allowed"
            >
              取込実行（デモのため無効化）
            </button>
          </ModalFooter>
        </ModalShell>
      )}
    </div>
  );
}

// ==================== SUB COMPONENTS ====================
function StatCard({ label, value, unit, icon: Icon, highlight }) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      highlight
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-900'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`text-xs uppercase tracking-wider font-semibold truncate ${
          highlight ? 'text-white/70' : 'text-slate-500'
        }`}>{label}</div>
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${highlight ? 'text-white/60' : 'text-slate-400'}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <div className="font-num text-lg sm:text-xl font-bold truncate">{value}</div>
        {unit && <div className={`text-sm flex-shrink-0 ${highlight ? 'text-white/60' : 'text-slate-500'}`}>{unit}</div>}
      </div>
    </div>
  );
}

function ModalShell({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in my-auto">
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
