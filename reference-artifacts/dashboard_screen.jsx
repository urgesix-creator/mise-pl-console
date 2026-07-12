import React, { useState, useMemo } from 'react';
import { Bell, Search, ArrowUp, ArrowDown, Minus, Calendar, Edit3, BarChart3, Settings, ChevronRight, AlertCircle, Check, Clock, MessageSquare, TrendingUp, Activity, Target, Users, FileText, Zap, Sparkles } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts';

// ==================== MOCK DATA ====================
const today = new Date(2026, 4, 10); // May 10, 2026
const yesterday = new Date(2026, 4, 9);

const mockStores = [
  {
    id: 'store_aoki_thai',
    name: 'あお季タイ',
    country: 'Thailand',
    flag: '🇹🇭',
    currency: 'THB',
    symbol: '฿',
    jpyRate: 4.4, // 1 THB = 4.4 JPY
    yesterday: {
      grossSales: 165800,
      netSales: 142068,
      customers: 41,
      avgPerCustomer: 4044,
      targetSales: 95000,
      purchases: 28500,
      grossProfit: 113568,
    },
    monthToDate: {
      netSales: 1287000,
      target: 1450000,
      achievementPct: 89,
    },
    last7Days: [
      { day: '5/4', sales: 70000 },
      { day: '5/5', sales: 75000 },
      { day: '5/6', sales: 88000 },
      { day: '5/7', sales: 92000 },
      { day: '5/8', sales: 105000 },
      { day: '5/9', sales: 142068 },
      { day: '5/10', sales: null }, // today not yet
    ],
    inputStatus: 'inputted',
    lastInputAt: '昨日 23:45',
    trendPct: 12.3,
  },
  {
    id: 'store_aoki_robata',
    name: 'AOKI ロバタ',
    country: 'Thailand',
    flag: '🇹🇭',
    currency: 'THB',
    symbol: '฿',
    jpyRate: 4.4,
    yesterday: {
      grossSales: 38500,
      netSales: 32987,
      customers: 12,
      avgPerCustomer: 3208,
      targetSales: 35000,
      purchases: 8200,
      grossProfit: 24787,
    },
    monthToDate: {
      netSales: 285000,
      target: 350000,
      achievementPct: 81,
    },
    last7Days: [
      { day: '5/4', sales: 22000 },
      { day: '5/5', sales: 28000 },
      { day: '5/6', sales: 35000 },
      { day: '5/7', sales: 30000 },
      { day: '5/8', sales: 38000 },
      { day: '5/9', sales: 32987 },
      { day: '5/10', sales: null },
    ],
    inputStatus: 'pending',
    lastInputAt: '本日未入力',
    trendPct: -5.7,
  },
  {
    id: 'store_hakata_tenjin',
    name: '博多天神ジャカルタ',
    country: 'Indonesia',
    flag: '🇮🇩',
    currency: 'IDR',
    symbol: 'Rp',
    jpyRate: 0.0098, // 1 IDR = 0.0098 JPY
    yesterday: {
      grossSales: 8500000,
      netSales: 7050000,
      customers: 65,
      avgPerCustomer: 130769,
      targetSales: 7500000,
      purchases: 1850000,
      grossProfit: 5200000,
    },
    monthToDate: {
      netSales: 64500000,
      target: 75000000,
      achievementPct: 86,
    },
    last7Days: [
      { day: '5/4', sales: 5500000 },
      { day: '5/5', sales: 6200000 },
      { day: '5/6', sales: 6800000 },
      { day: '5/7', sales: 7100000 },
      { day: '5/8', sales: 8200000 },
      { day: '5/9', sales: 7050000 },
      { day: '5/10', sales: null },
    ],
    inputStatus: 'inputted',
    lastInputAt: '昨日 22:15',
    trendPct: 8.2,
  },
];

const mockActivity = [
  {
    id: 1,
    type: 'slack',
    icon: MessageSquare,
    color: 'indigo',
    title: '日報を Slack に配信しました',
    description: '3店舗の昨日実績まとめ・予算比・粗利',
    time: '今朝 9:00',
  },
  {
    id: 2,
    type: 'input',
    icon: Edit3,
    color: 'emerald',
    title: 'あお季タイ：昨日の売上を入力',
    description: '売上 ฿165,800（目標比 175%）・客数 41名',
    time: '昨日 23:45',
  },
  {
    id: 3,
    type: 'input',
    icon: Edit3,
    color: 'emerald',
    title: '博多天神ジャカルタ：昨日の売上を入力',
    description: '売上 Rp8,500,000（目標比 113%）・客数 65名',
    time: '昨日 22:15',
  },
  {
    id: 4,
    type: 'alert',
    icon: AlertCircle,
    color: 'amber',
    title: 'AOKI ロバタ：本日の売上が未入力',
    description: '昨日23:00以降の入力がありません',
    time: '5分前',
  },
  {
    id: 5,
    type: 'target',
    icon: Target,
    color: 'slate',
    title: 'あお季タイ：5月の売上目標を設定',
    description: '日別31日分・月合計 ฿2,650,000',
    time: '5月1日',
  },
];

// ==================== UTILITIES ====================
const formatNumber = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US');
};

const formatJPY = (amount, rate) => {
  const jpy = Math.round(amount * rate);
  if (jpy >= 100000000) return `¥${(jpy / 100000000).toFixed(1)}億`;
  if (jpy >= 10000) return `¥${(jpy / 10000).toFixed(1)}万`;
  return `¥${formatNumber(jpy)}`;
};

const getActivityColor = (color) => {
  const map = {
    indigo: 'bg-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return map[color] || map.slate;
};

// ==================== COMPONENT ====================
export default function DashboardScreen() {
  const [hour] = useState(new Date().getHours());

  // Greeting based on time
  const greeting = useMemo(() => {
    if (hour < 5) return 'お疲れ様です';
    if (hour < 11) return 'おはようございます';
    if (hour < 17) return 'こんにちは';
    return 'お疲れ様です';
  }, [hour]);

  // Aggregate stats across all stores (in JPY)
  const aggregate = useMemo(() => {
    let yesterdayTotalJPY = 0;
    let yesterdayTargetJPY = 0;
    let mtdNetJPY = 0;
    let mtdTargetJPY = 0;
    let inputtedCount = 0;
    let totalCustomers = 0;
    let totalGrossProfitJPY = 0;

    mockStores.forEach(s => {
      yesterdayTotalJPY += s.yesterday.netSales * s.jpyRate;
      yesterdayTargetJPY += s.yesterday.targetSales * s.jpyRate;
      mtdNetJPY += s.monthToDate.netSales * s.jpyRate;
      mtdTargetJPY += s.monthToDate.target * s.jpyRate;
      totalCustomers += s.yesterday.customers;
      totalGrossProfitJPY += s.yesterday.grossProfit * s.jpyRate;
      if (s.inputStatus === 'inputted') inputtedCount += 1;
    });

    return {
      yesterdayTotalJPY: Math.round(yesterdayTotalJPY),
      yesterdayTargetJPY: Math.round(yesterdayTargetJPY),
      yesterdayAchievement: Math.round((yesterdayTotalJPY / yesterdayTargetJPY) * 100),
      mtdNetJPY: Math.round(mtdNetJPY),
      mtdTargetJPY: Math.round(mtdTargetJPY),
      mtdAchievement: Math.round((mtdNetJPY / mtdTargetJPY) * 100),
      inputtedCount,
      totalStores: mockStores.length,
      totalCustomers,
      totalGrossProfitJPY: Math.round(totalGrossProfitJPY),
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
        
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        .font-display { font-family: 'Bricolage Grotesque', 'Noto Sans JP', sans-serif; letter-spacing: -0.02em; }
        .font-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.4s ease-out backwards; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
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
          
          <nav className="hidden md:flex items-center gap-1">
            <NavLink active>ダッシュボード</NavLink>
            <NavLink>日次入力</NavLink>
            <NavLink>売上目標</NavLink>
            <NavLink>データ閲覧</NavLink>
            <NavLink>管理 ▾</NavLink>
          </nav>
          
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center relative">
              <Bell className="w-4 h-4 text-slate-700" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500 pulse-dot" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              比
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {/* Greeting */}
        <div className="mb-8 anim-in">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Dashboard · Executive View</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-1">
                {greeting}、比嘉専務
              </h1>
              <p className="text-sm text-slate-600">
                {today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日（{['日','月','火','水','木','金','土'][today.getDay()]}）
                · 全 {aggregate.totalStores} 店舗 · {aggregate.inputtedCount}/{aggregate.totalStores} 店舗が入力済み
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-0.5">表示通貨</div>
              <div className="font-num text-sm font-bold text-slate-900">JPY 換算</div>
            </div>
          </div>
        </div>

        {/* HERO Card */}
        <div className="mb-6 anim-in" style={{ animationDelay: '0.1s' }}>
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/10 blur-[100px] rounded-full translate-y-1/3 -translate-x-1/3" />
            
            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/60 mb-3">昨日の全店合計（税抜・JPY換算）</div>
                <div className="flex items-baseline gap-3 mb-4">
                  <div className="font-num text-5xl sm:text-6xl font-bold tracking-tight">
                    ¥{formatNumber(aggregate.yesterdayTotalJPY)}
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                    aggregate.yesterdayAchievement >= 100
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                  }`}>
                    {aggregate.yesterdayAchievement >= 100 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {aggregate.yesterdayAchievement}%
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6 pt-5 border-t border-white/10">
                  <HeroStat label="目標" value={`¥${formatNumber(aggregate.yesterdayTargetJPY)}`} />
                  <HeroStat label="客数" value={`${aggregate.totalCustomers}名`} />
                  <HeroStat label="概算粗利" value={`¥${formatNumber(aggregate.totalGrossProfitJPY)}`} accent />
                </div>
              </div>

              {/* Month progress */}
              <div className="lg:w-64 lg:border-l lg:border-white/10 lg:pl-8">
                <div className="text-xs uppercase tracking-widest text-white/60 mb-3">5月の進捗</div>
                <div className="font-num text-3xl font-bold mb-2">
                  {aggregate.mtdAchievement}<span className="text-lg text-white/60">%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      aggregate.mtdAchievement >= 100 ? 'bg-emerald-400' : 'bg-white'
                    }`}
                    style={{ width: `${Math.min(aggregate.mtdAchievement, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-white/60 mb-1">月初〜昨日</div>
                <div className="font-num text-sm font-medium text-white/90">
                  ¥{formatNumber(aggregate.mtdNetJPY)} / ¥{formatNumber(aggregate.mtdTargetJPY)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 anim-in" style={{ animationDelay: '0.15s' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction icon={Edit3} label="日次入力" sub="今日の売上を記録" />
            <QuickAction icon={Calendar} label="売上目標" sub="月次の予算管理" />
            <QuickAction icon={BarChart3} label="データ閲覧" sub="過去データ分析" />
            <QuickAction icon={Settings} label="管理メニュー" sub="マスタ・設定" />
          </div>
        </div>

        {/* Stores Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 leading-tight">店舗別の状況</h2>
              <p className="text-xs text-slate-500 mt-0.5">昨日の実績と直近7日のトレンド</p>
            </div>
            <button className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1">
              すべての店舗を見る
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {mockStores.map((store, idx) => (
              <StoreCard key={store.id} store={store} delay={`${0.2 + idx * 0.05}s`} />
            ))}
          </div>
        </div>

        {/* Two-column: Activity + Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <div className="lg:col-span-2 anim-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 leading-tight">最近のアクティビティ</h2>
                <p className="text-xs text-slate-500 mt-0.5">入力・配信・アラートの履歴</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="divide-y divide-slate-100">
                {mockActivity.map((act, idx) => (
                  <div key={act.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(act.color)}`}>
                      <act.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 mb-0.5">{act.title}</div>
                      <div className="text-xs text-slate-500">{act.description}</div>
                    </div>
                    <div className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">{act.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights / Tips */}
          <div className="anim-in" style={{ animationDelay: '0.45s' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 leading-tight">注意事項</h2>
                <p className="text-xs text-slate-500 mt-0.5">対応が必要な項目</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Alert: missing input */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-amber-900">入力未完了の店舗</div>
                    <div className="text-xs text-amber-800 mt-0.5">AOKI ロバタが昨日の入力未済</div>
                  </div>
                </div>
                <button className="w-full mt-2 px-3 py-2 rounded-lg bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold">
                  店長へSlackで督促
                </button>
              </div>

              {/* Inventory reminder */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900">月末棚卸 21日後</div>
                    <div className="text-xs text-slate-600 mt-0.5">5月31日に概算棚卸の更新リマインドが届きます</div>
                  </div>
                </div>
              </div>

              {/* Insight */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-indigo-900">あお季タイ：好調</div>
                    <div className="text-xs text-indigo-800 mt-0.5">7日連続で目標達成、客単価が前週比 +12%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500 text-center">
          KOGA Holdings · Sales Console v1.0 · 最終更新 {today.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </main>
    </div>
  );
}

// ==================== STORE CARD ====================
function StoreCard({ store, delay }) {
  const isInputted = store.inputStatus === 'inputted';
  const achievement = Math.round((store.yesterday.netSales / store.yesterday.targetSales) * 100);
  const trendUp = store.trendPct > 0;
  const trendFlat = Math.abs(store.trendPct) < 1;

  // Sparkline data - filter nulls
  const sparkData = store.last7Days.filter(d => d.sales !== null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg hover:shadow-slate-900/5 hover:border-slate-300 transition-all anim-in" style={{ animationDelay: delay }}>
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl flex-shrink-0">{store.flag}</span>
            <div className="min-w-0">
              <div className="font-display text-base font-bold text-slate-900 truncate">{store.name}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">{store.country}</div>
            </div>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ${
            isInputted
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {isInputted ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
            {isInputted ? '入力済み' : '未入力'}
          </div>
        </div>

        {/* Yesterday sales */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">昨日の売上（税抜）</div>
          <div className="flex items-baseline gap-2">
            <div className="font-num text-2xl font-bold text-slate-900">
              {store.symbol}{formatNumber(store.yesterday.netSales)}
            </div>
            <div className="font-num text-xs text-slate-500">
              {formatJPY(store.yesterday.netSales, store.jpyRate)}
            </div>
          </div>
        </div>

        {/* Achievement bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">目標達成率</span>
            <span className={`font-num font-bold ${
              achievement >= 100 ? 'text-emerald-600' :
              achievement >= 95 ? 'text-slate-900' :
              'text-rose-600'
            }`}>{achievement}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                achievement >= 100 ? 'bg-emerald-500' :
                achievement >= 95 ? 'bg-slate-900' :
                'bg-rose-500'
              }`}
              style={{ width: `${Math.min(achievement, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>目標 {store.symbol}{formatNumber(store.yesterday.targetSales)}</span>
          <span>·</span>
          <span>{store.lastInputAt}</span>
        </div>
      </div>

      {/* Sparkline section */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">直近7日のトレンド</div>
          <div className={`text-xs font-num font-bold flex items-center gap-1 ${
            trendFlat ? 'text-slate-500' :
            trendUp ? 'text-emerald-600' :
            'text-rose-600'
          }`}>
            {trendFlat ? <Minus className="w-3 h-3" /> :
             trendUp ? <ArrowUp className="w-3 h-3" /> :
             <ArrowDown className="w-3 h-3" />}
            {Math.abs(store.trendPct).toFixed(1)}%
          </div>
        </div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`grad-${store.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendUp ? '#10B981' : '#F43F5E'} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={trendUp ? '#10B981' : '#F43F5E'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="sales"
                stroke={trendUp ? '#10B981' : '#F43F5E'}
                strokeWidth={2}
                fill={`url(#grad-${store.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Month-to-date */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">5月累計</span>
          <div className="text-right">
            <span className="font-num font-bold text-slate-900">{store.symbol}{formatNumber(store.monthToDate.netSales)}</span>
            <span className={`ml-1.5 font-num text-xs ${
              store.monthToDate.achievementPct >= 100 ? 'text-emerald-600' : 'text-slate-500'
            }`}>
              ({store.monthToDate.achievementPct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB COMPONENTS ====================
function NavLink({ children, active }) {
  return (
    <button className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-slate-900 text-white'
        : 'text-slate-700 hover:bg-slate-100'
    }`}>
      {children}
    </button>
  );
}

function HeroStat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold mb-1">{label}</div>
      <div className={`font-num font-bold ${accent ? 'text-emerald-300 text-xl' : 'text-white text-lg'}`}>
        {value}
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, sub }) {
  return (
    <button className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:shadow-md hover:shadow-slate-900/5 transition-all group">
      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-slate-900 flex items-center justify-center mb-3 transition-colors">
        <Icon className="w-4 h-4 text-slate-700 group-hover:text-white transition-colors" />
      </div>
      <div className="font-display text-sm font-bold text-slate-900 mb-0.5">{label}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </button>
  );
}
