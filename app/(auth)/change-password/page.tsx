'use client';

import { useState, useMemo } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Check,
  KeyRound,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { changePassword, type LoginState } from '../actions';

const initialState: LoginState = {};

export default function ChangePasswordPage() {
  const [state, formAction] = useFormState(changePassword, initialState);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validation = useMemo(
    () => ({
      length: newPw.length >= 8,
      hasUpper: /[A-Z]/.test(newPw),
      hasLower: /[a-z]/.test(newPw),
      hasNumber: /\d/.test(newPw),
      hasSymbol: /[^A-Za-z0-9]/.test(newPw),
      match: newPw.length > 0 && newPw === confirmPw,
    }),
    [newPw, confirmPw]
  );

  const strength = useMemo(() => {
    let score = 0;
    if (validation.length) score++;
    if (validation.hasUpper) score++;
    if (validation.hasLower) score++;
    if (validation.hasNumber) score++;
    if (validation.hasSymbol) score++;
    return score;
  }, [validation]);

  const allValid = Object.values(validation).every((v) => v);

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-12 flex-col justify-between">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 pulse-soft" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-400/10 blur-[120px] rounded-full translate-y-1/3 -translate-x-1/3" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative anim-in">
          <div className="flex items-center gap-4 mb-8">
            <Image
              src="/koga-group-logo.png"
              alt="みせPL"
              width={840}
              height={600}
              className="h-14 w-auto"
              priority
            />
            <div>
              <div className="font-display text-base font-bold tracking-tight">みせPL</div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-white/60">みせPL</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-[1.1] mb-6 anim-in anim-delay-100">
            新しい
            <br />
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
              <div className="font-display text-sm font-bold text-white mb-0.5">8文字以上</div>
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

      <main className="flex-1 flex flex-col bg-white">
        <header className="lg:hidden border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <Image
            src="/koga-group-logo.png"
            alt="みせPL"
            width={840}
            height={600}
            className="h-9 w-auto"
          />
          <div>
            <div className="font-display text-sm font-bold text-slate-900 leading-tight">みせPL</div>
            <div className="text-[10px] tracking-widest uppercase text-slate-500">みせPL</div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 sm:py-12">
          <div className="w-full max-w-sm">
            {state?.success ? (
              <SuccessState />
            ) : (
              <>
                <div className="mb-8 anim-in">
                  <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-semibold mb-3">
                    New Password
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
                    新しい
                    <br />
                    パスワードを設定
                  </h2>
                  <p className="text-sm text-slate-600">安全なパスワードを設定してください</p>
                </div>

                {state?.error && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mb-5 flex items-start gap-3 anim-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-900 font-medium">{state.error}</div>
                  </div>
                )}

                <form action={formAction} className="space-y-4 anim-in anim-delay-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                      新しいパスワード
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showNew ? 'text' : 'password'}
                        name="newPassword"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoFocus
                        autoComplete="new-password"
                        className="w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15 transition-all"
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

                  {newPw && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1 rounded-full transition-colors ${
                              i < strength
                                ? strength <= 2
                                  ? 'bg-rose-400'
                                  : strength <= 3
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs">
                        <ValidationRow ok={validation.length}>8文字以上</ValidationRow>
                        <ValidationRow ok={validation.hasUpper}>大文字</ValidationRow>
                        <ValidationRow ok={validation.hasLower}>小文字</ValidationRow>
                        <ValidationRow ok={validation.hasNumber}>数字</ValidationRow>
                        <ValidationRow ok={validation.hasSymbol}>記号</ValidationRow>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                      確認用（再入力）
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        name="confirmPassword"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className={`w-full pl-11 pr-12 py-3.5 border rounded-lg text-sm bg-white focus:ring-[3px] focus:ring-brand-500/15 transition-all ${
                          confirmPw && !validation.match
                            ? 'border-rose-300 focus:border-rose-500'
                            : 'border-slate-200 focus:border-brand-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPw && !validation.match && (
                      <div className="text-xs text-rose-600 mt-1.5">パスワードが一致しません</div>
                    )}
                  </div>

                  <SubmitButton disabled={!allValid} />
                </form>

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
            <div>© 2026 みせPL</div>
            <div className="flex items-center gap-3">
              <span>プライバシー</span>
              <span className="text-slate-300">·</span>
              <span>サポート</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full px-6 py-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
    >
      {pending ? (
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
  );
}

function SuccessState() {
  return (
    <div className="anim-in">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
        <Check className="w-7 h-7 text-emerald-600" />
      </div>

      <div className="mb-6">
        <div className="text-xs tracking-[0.2em] uppercase text-emerald-600 font-semibold mb-3">
          Password Updated
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-3">
          パスワードを
          <br />
          変更しました
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          新しいパスワードでログインできます。すべての既存セッションは無効化されました。
        </p>
      </div>

      <Link
        href="/login"
        className="w-full px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
      >
        <span>ログインに進む</span>
        <ArrowRight className="w-4 h-4" />
      </Link>

      <div className="mt-8 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 leading-relaxed">
          <span className="font-bold">推奨：</span>セキュリティ強化のため、ログイン後にプロフィール画面から2要素認証を設定してください。
        </div>
      </div>
    </div>
  );
}

function ValidationRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-slate-400'}`}>
      {ok ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
      <span>{children}</span>
    </div>
  );
}

