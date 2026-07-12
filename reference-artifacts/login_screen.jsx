import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2, Check, Globe, Activity, Zap, Shield } from 'lucide-react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [now, setNow] = useState(new Date());

  // Live clock for left panel
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    if (!email.includes('@')) {
      setError('正しいメールアドレスを入力してください');
      return;
    }

    setLoading(true);
    // Demo: simulate auth
    setTimeout(() => {
      setLoading(false);
      // Demo logic: success only with demo credentials
      if (email === 'higa@koga-hd.co.jp' && password === 'demo1234') {
        setSuccess(true);
      } else {
        setError('ログインに失敗しました');
      }
    }, 1200);
  };

  const handleDemoFill = () => {
    setEmail('higa@koga-hd.co.jp');
    setPassword('demo1234');
    setError(null);
  };

  // Time formatting
  const formatTimeJST = (d) => {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };
  const formatDateJST = (d) => {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // Bangkok = UTC+7, JST = UTC+9
  const getCityTime = (offsetHours) => {
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const cityDate = new Date(utc + offsetHours * 3600000);
    return formatTimeJST(cityDate);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap');
        
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        .font-display { font-family: 'Bricolage Grotesque', 'Noto Sans JP', sans-serif; letter-spacing: -0.03em; }
        .font-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }

        input:focus { outline: none; }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.4s ease-out; }
        .anim-delay-100 { animation-delay: 0.1s; animation-fill-mode: backwards; }
        .anim-delay-200 { animation-delay: 0.2s; animation-fill-mode: backwards; }
        .anim-delay-300 { animation-delay: 0.3s; animation-fill-mode: backwards; }
        
        @keyframes shimmer {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .pulse-soft { animation: shimmer 3s ease-in-out infinite; }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-spin { animation: spin 0.8s linear infinite; }
      `}</style>

      {/* ===== LEFT PANEL (Desktop only - Brand) ===== */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-12 flex-col justify-between">
        {/* Decorative gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 pulse-soft" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-400/10 blur-[120px] rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-rose-400/8 blur-[100px] rounded-full" />
        
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        {/* Top: Brand */}
        <div className="relative anim-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center">
              <span className="font-display text-slate-900 text-xl font-bold">古</span>
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-tight">KOGA Holdings</div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-white/60">Sales Console</div>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft" />
            <span className="text-xs font-medium text-emerald-300">All systems operational</span>
          </div>
        </div>

        {/* Center: Hero text */}
        <div className="relative">
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-[1.1] mb-6 anim-in anim-delay-100">
            海外飲食店の<br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              リアルタイム
            </span>
            <br />
            経営管理
          </h1>
          <p className="text-base text-white/70 leading-relaxed mb-8 max-w-md anim-in anim-delay-200">
            タイ・インドネシアの飲食店オペレーションを、現場入力から本部分析までシームレスに繋ぐ統合プラットフォーム。
          </p>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-3 max-w-md anim-in anim-delay-300">
            <FeatureBox icon={Activity} label="日次入力" sub="現場店長による即時入力" />
            <FeatureBox icon={Zap} label="リアルタイム" sub="経営層へSlack日報自動配信" />
            <FeatureBox icon={Globe} label="多通貨対応" sub="THB / IDR / JPY" />
            <FeatureBox icon={Shield} label="安全な認証" sub="メール＋PW + 2FA" />
          </div>
        </div>

        {/* Bottom: City times */}
        <div className="relative anim-in anim-delay-300">
          <div className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-semibold mb-3">
            World Time
          </div>
          <div className="grid grid-cols-3 gap-4">
            <CityClock label="Tokyo" time={getCityTime(9)} />
            <CityClock label="Bangkok" time={getCityTime(7)} />
            <CityClock label="Jakarta" time={getCityTime(7)} />
          </div>
        </div>
      </aside>

      {/* ===== RIGHT PANEL (Login Form) ===== */}
      <main className="flex-1 flex flex-col bg-white">
        {/* Mobile header (hidden on desktop) */}
        <header className="lg:hidden border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <span className="font-display text-white text-base font-bold">古</span>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-slate-900 leading-tight">KOGA Holdings</div>
            <div className="text-[10px] tracking-widest uppercase text-slate-500">Sales Console</div>
          </div>
        </header>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 sm:py-12">
          <div className="w-full max-w-sm">
            {/* Title */}
            <div className="mb-8 anim-in">
              <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-semibold mb-3">
                Sign in
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
                ログイン
              </h2>
              <p className="text-sm text-slate-600">
                登録済みのアカウントでサインインしてください
              </p>
            </div>

            {/* Success state */}
            {success ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 anim-in">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-display text-base font-bold text-emerald-900">ログイン成功</div>
                    <div className="text-xs text-emerald-700">ダッシュボードへ移動します...</div>
                  </div>
                </div>
                <div className="text-xs text-emerald-700">
                  実装時はここで <code className="font-num bg-emerald-100 px-1.5 py-0.5 rounded">/dashboard</code> にリダイレクトされます
                </div>
              </div>
            ) : (
              <>
                {/* Error message */}
                {error && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mb-5 flex items-start gap-3 anim-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-900 font-medium">{error}</div>
                  </div>
                )}

                {/* Form */}
                <div className="space-y-4 anim-in anim-delay-100">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                      メールアドレス
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                        placeholder="name@koga-hd.co.jp"
                        disabled={loading}
                        className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-lg text-sm font-body bg-white focus:border-slate-900 focus:ring-3 focus:ring-slate-900/8 transition-all"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        パスワード
                      </label>
                      <button
                        type="button"
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium hover:underline"
                      >
                        パスワードを忘れた
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-lg text-sm font-body bg-white focus:border-slate-900 focus:ring-3 focus:ring-slate-900/8 transition-all"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer accent-slate-900"
                    />
                    <span className="text-sm text-slate-700">この端末を信頼する（30日間）</span>
                  </label>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full px-6 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 anim-spin" />
                        <span>認証中...</span>
                      </>
                    ) : (
                      <>
                        <span>ログイン</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="my-8 flex items-center gap-4 anim-in anim-delay-200">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Demo</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Demo credentials */}
                <button
                  onClick={handleDemoFill}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-xs text-slate-600 transition-all anim-in anim-delay-200"
                >
                  <span className="block text-slate-500 mb-1">デモ用クレデンシャルを入力する</span>
                  <span className="font-num text-[11px] text-slate-700">higa@koga-hd.co.jp / demo1234</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-100 px-5 sm:px-8 py-5">
          <div className="max-w-sm mx-auto flex items-center justify-between text-xs text-slate-500">
            <div>© 2026 KOGA Holdings</div>
            <div className="flex items-center gap-3">
              <a href="#" className="hover:text-slate-900">プライバシー</a>
              <span className="text-slate-300">·</span>
              <a href="#" className="hover:text-slate-900">サポート</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ==================== SUB COMPONENTS ====================
function FeatureBox({ icon: Icon, label, sub }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <Icon className="w-4 h-4 text-white/70 mb-3" />
      <div className="font-display text-sm font-bold text-white mb-0.5">{label}</div>
      <div className="text-[11px] text-white/50 leading-snug">{sub}</div>
    </div>
  );
}

function CityClock({ label, time }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] tracking-widest uppercase text-white/50 font-semibold mb-1">{label}</div>
      <div className="font-num text-base font-bold text-white tabular-nums">{time}</div>
    </div>
  );
}
