import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft, AlertCircle, Loader2, Check, Globe, Shield, Activity, Zap } from 'lucide-react';

export default function PasswordResetRequestScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }
    if (!email.includes('@')) {
      setError('正しいメールアドレスを入力してください');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // 情報漏洩防止：メールが存在するかどうかに関わらず同じメッセージ
      setSubmitted(true);
    }, 1200);
  };

  const handleResend = () => {
    setSubmitted(false);
    setEmail('');
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

      {/* LEFT PANEL - Brand */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-12 flex-col justify-between">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 pulse-soft" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-400/10 blur-[120px] rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

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
        </div>

        <div className="relative">
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-[1.1] mb-6 anim-in anim-delay-100">
            アカウント<br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              復旧
            </span>
          </h1>
          <p className="text-base text-white/70 leading-relaxed max-w-md anim-in anim-delay-200">
            登録メールアドレス宛にリセットリンクをお送りします。リンクの有効期限は1時間です。
          </p>
        </div>

        <div className="relative anim-in anim-delay-200">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <Shield className="w-4 h-4 text-white/70 mb-3" />
              <div className="font-display text-sm font-bold text-white mb-0.5">安全なフロー</div>
              <div className="text-[11px] text-white/50 leading-snug">トークンは1回のみ使用可</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <Activity className="w-4 h-4 text-white/70 mb-3" />
              <div className="font-display text-sm font-bold text-white mb-0.5">即時通知</div>
              <div className="text-[11px] text-white/50 leading-snug">数秒以内にメール到着</div>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL - Form */}
      <main className="flex-1 flex flex-col bg-white">
        <header className="lg:hidden border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <span className="font-display text-white text-base font-bold">古</span>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-slate-900 leading-tight">KOGA Holdings</div>
            <div className="text-[10px] tracking-widest uppercase text-slate-500">Sales Console</div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 sm:py-12">
          <div className="w-full max-w-sm">
            {/* Back to login */}
            <button className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5 mb-6 anim-in">
              <ArrowLeft className="w-3.5 h-3.5" />
              ログインに戻る
            </button>

            {!submitted ? (
              <>
                {/* Title */}
                <div className="mb-8 anim-in">
                  <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-semibold mb-3">
                    Reset Password
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
                    パスワードを<br />リセット
                  </h2>
                  <p className="text-sm text-slate-600">
                    登録済みのメールアドレスを入力してください。リセット用のリンクをお送りします。
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mb-5 flex items-start gap-3 anim-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-900 font-medium">{error}</div>
                  </div>
                )}

                <div className="space-y-4 anim-in anim-delay-100">
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
                        className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-slate-900 focus:ring-3 focus:ring-slate-900/8 transition-all"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full px-6 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 anim-spin" />
                        <span>送信中...</span>
                      </>
                    ) : (
                      <>
                        <span>リセットリンクを送信</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1 anim-in anim-delay-200">
                  <p>· リセットリンクの有効期限は1時間です</p>
                  <p>· 数分待ってもメールが届かない場合は迷惑メールフォルダをご確認ください</p>
                  <p>· メールアドレスを忘れた場合は管理者へお問い合わせください</p>
                </div>
              </>
            ) : (
              <div className="anim-in">
                {/* Success icon */}
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
                  <Mail className="w-7 h-7 text-emerald-600" />
                </div>

                <div className="mb-6">
                  <div className="text-xs tracking-[0.2em] uppercase text-emerald-600 font-semibold mb-3">
                    Email Sent
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-3">
                    メールを<br />ご確認ください
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    入力されたメールアドレスが登録されている場合、リセット用のリンクをお送りしました。
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-4 py-4 mb-6 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="font-num text-sm font-medium text-slate-900 truncate">{email}</div>
                </div>

                <div className="space-y-3">
                  <button className="w-full px-6 py-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition-all">
                    <ArrowLeft className="w-4 h-4" />
                    ログインに戻る
                  </button>
                  <button
                    onClick={handleResend}
                    className="w-full px-6 py-3 text-slate-600 hover:text-slate-900 text-xs font-medium"
                  >
                    別のメールアドレスで試す
                  </button>
                </div>

                <div className="mt-8 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold">セキュリティ：</span>登録されていないメールアドレスでも同じメッセージを表示します。これはアカウント情報の漏洩を防ぐためです。
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
