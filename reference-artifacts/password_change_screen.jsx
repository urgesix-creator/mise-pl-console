import React, { useState, useMemo } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, Loader2, Check, KeyRound, Shield, ShieldCheck, X } from 'lucide-react';

// ==================== COMPONENT ====================
export default function PasswordChangeScreen() {
  // Demo: simulate token validity (toggle between valid / expired for testing)
  const [tokenState, setTokenState] = useState('valid'); // valid | expired

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const pwValidation = useMemo(() => ({
    length: newPw.length >= 12,
    hasUpper: /[A-Z]/.test(newPw),
    hasLower: /[a-z]/.test(newPw),
    hasNumber: /\d/.test(newPw),
    hasSymbol: /[^A-Za-z0-9]/.test(newPw),
    match: newPw && newPw === confirmPw,
  }), [newPw, confirmPw]);

  const pwStrength = useMemo(() => {
    let score = 0;
    if (pwValidation.length) score++;
    if (pwValidation.hasUpper) score++;
    if (pwValidation.hasLower) score++;
    if (pwValidation.hasNumber) score++;
    if (pwValidation.hasSymbol) score++;
    return score;
  }, [pwValidation]);

  const allValid = Object.values(pwValidation).every(v => v);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (!allValid) {
      setError('パスワード要件を満たしてください');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1200);
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
            新しい<br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              パスワード
            </span>
          </h1>
          <p className="text-base text-white/70 leading-relaxed max-w-md anim-in anim-delay-200">
            強固なパスワードを設定してアカウントを保護してください。設定後すぐにログインできます。
          </p>
        </div>

        <div className="relative anim-in anim-delay-200">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <Shield className="w-4 h-4 text-white/70 mb-3" />
              <div className="font-display text-sm font-bold text-white mb-0.5">12文字以上</div>
              <div className="text-[11px] text-white/50 leading-snug">英大小・数字・記号</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
              <ShieldCheck className="w-4 h-4 text-white/70 mb-3" />
              <div className="font-display text-sm font-bold text-white mb-0.5">2FA推奨</div>
              <div className="text-[11px] text-white/50 leading-snug">設定後プロフィールから</div>
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
            {/* Demo: Toggle token state */}
            <div className="mb-6 inline-flex p-1 rounded-lg bg-slate-100">
              <button
                onClick={() => { setTokenState('valid'); setSuccess(false); setNewPw(''); setConfirmPw(''); }}
                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                  tokenState === 'valid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Demo: 有効
              </button>
              <button
                onClick={() => { setTokenState('expired'); setSuccess(false); }}
                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                  tokenState === 'expired' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Demo: 期限切れ
              </button>
            </div>

            {/* Token expired state */}
            {tokenState === 'expired' && (
              <div className="anim-in">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mb-6">
                  <X className="w-7 h-7 text-rose-600" />
                </div>

                <div className="mb-6">
                  <div className="text-xs tracking-[0.2em] uppercase text-rose-600 font-semibold mb-3">
                    Link Expired
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-3">
                    リンクの<br />有効期限が切れています
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    このパスワードリセットリンクは無効です。有効期限切れか、既に使用済みの可能性があります。
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-6">
                  <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                    <p>· リセットリンクの有効期限は<span className="font-semibold">1時間</span>です</p>
                    <p>· 各リンクは<span className="font-semibold">1回のみ</span>使用可能</p>
                    <p>· もう一度リセット要求から始めてください</p>
                  </div>
                </div>

                <button className="w-full px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  <span>リセットを再要求</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="w-full mt-3 px-6 py-3 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  ログインに戻る
                </button>
              </div>
            )}

            {/* Token valid - success state */}
            {tokenState === 'valid' && success && (
              <div className="anim-in">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>

                <div className="mb-6">
                  <div className="text-xs tracking-[0.2em] uppercase text-emerald-600 font-semibold mb-3">
                    Password Updated
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-3">
                    パスワードを<br />変更しました
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    新しいパスワードでログインできます。すべての既存セッションは無効化されました。
                  </p>
                </div>

                <button className="w-full px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                  <span>ログインに進む</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="mt-8 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-900 leading-relaxed">
                    <span className="font-bold">推奨：</span>セキュリティ強化のため、ログイン後にプロフィール画面から2要素認証を設定してください。
                  </div>
                </div>
              </div>
            )}

            {/* Token valid - input form */}
            {tokenState === 'valid' && !success && (
              <>
                <div className="mb-8 anim-in">
                  <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-semibold mb-3">
                    New Password
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
                    新しい<br />パスワードを設定
                  </h2>
                  <p className="text-sm text-slate-600">
                    安全なパスワードを設定してください
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mb-5 flex items-start gap-3 anim-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-900 font-medium">{error}</div>
                  </div>
                )}

                <div className="space-y-4 anim-in anim-delay-100">
                  {/* New password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                      新しいパスワード
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-slate-900 focus:ring-3 focus:ring-slate-900/8 transition-all"
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Strength meter */}
                  {newPw && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`flex-1 h-1 rounded-full transition-colors ${
                              i < pwStrength
                                ? pwStrength <= 2
                                  ? 'bg-rose-400'
                                  : pwStrength <= 3
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs">
                        <ValidationRow ok={pwValidation.length}>12文字以上</ValidationRow>
                        <ValidationRow ok={pwValidation.hasUpper}>大文字</ValidationRow>
                        <ValidationRow ok={pwValidation.hasLower}>小文字</ValidationRow>
                        <ValidationRow ok={pwValidation.hasNumber}>数字</ValidationRow>
                        <ValidationRow ok={pwValidation.hasSymbol}>記号</ValidationRow>
                      </div>
                    </div>
                  )}

                  {/* Confirm password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                      確認用（再入力）
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                        placeholder="••••••••"
                        disabled={loading}
                        className={`w-full pl-11 pr-12 py-3.5 border rounded-lg text-sm bg-white focus:ring-3 focus:ring-slate-900/8 transition-all ${
                          confirmPw && !pwValidation.match
                            ? 'border-rose-300 focus:border-rose-500'
                            : 'border-slate-200 focus:border-slate-900'
                        }`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPw && !pwValidation.match && (
                      <div className="text-xs text-rose-600 mt-1.5">パスワードが一致しません</div>
                    )}
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading || !allValid}
                    className="w-full px-6 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 anim-spin" />
                        <span>更新中...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>パスワードを更新</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1 anim-in anim-delay-200">
                  <p>· 更新後、すべての既存セッションは無効化されます</p>
                  <p>· 新しいパスワードでログインし直してください</p>
                </div>
              </>
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

function ValidationRow({ ok, children }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-slate-400'}`}>
      {ok ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
      <span>{children}</span>
    </div>
  );
}
