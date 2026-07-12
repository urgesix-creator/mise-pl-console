'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Globe,
  Activity,
  Zap,
  Shield,
  QrCode,
} from 'lucide-react';
import { signIn, type LoginState } from '../actions';

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction] = useFormState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [clock, setClock] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);

  // クライアントマウント後にのみ時刻を描画（SSRとの hydration mismatch を避ける）
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      setClock(`${h}:${m}:${s}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // メールリンク（リセット/招待）が無効・期限切れだった場合の案内（/auth/confirm から誘導）
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'link_invalid') {
      setLinkInvalid(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-12 flex-col justify-between">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 pulse-soft" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-400/10 blur-[120px] rounded-full translate-y-1/3 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-rose-400/[0.08] blur-[100px] rounded-full" />
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
            <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
              <span className="font-display text-xl font-bold tracking-tight text-white">PL</span>
            </div>
            <div>
              <div className="font-display text-2xl font-bold tracking-tight">みせPL</div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-white/60">Store P/L Console</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft" />
            <span className="text-xs font-medium text-emerald-300">All systems operational</span>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-[1.1] mb-6 anim-in anim-delay-100">
            店舗経営の
            <br />
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              リアルタイム
            </span>
            <br />
            月次PL自動化
          </h1>
          <p className="text-base text-white/70 leading-relaxed mb-8 max-w-md anim-in anim-delay-200">
            飲食店の日次オペレーションを、現場入力から本部分析までシームレスに繋ぐ店舗PLダッシュボード。
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-md anim-in anim-delay-300">
            <FeatureBox icon={Activity} label="日次入力" sub="現場店長による即時入力" />
            <FeatureBox icon={Zap} label="リアルタイム" sub="経営層へSlack日報自動配信" />
            <FeatureBox icon={Globe} label="月次PL" sub="FL比率・原価率を自動集計" />
            <FeatureBox icon={Shield} label="安全な認証" sub="メール＋パスワード" />
          </div>
        </div>

        <div className="relative anim-in anim-delay-300">
          <div className="font-num text-4xl font-bold text-white tabular-nums">{clock}</div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-semibold mt-1">
            Tokyo · JST
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-white">
        <header className="lg:hidden border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="font-display text-sm font-bold text-white">PL</span>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-slate-900 leading-tight">みせPL</div>
            <div className="text-[10px] tracking-widest uppercase text-slate-500">Store P/L</div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 sm:py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 anim-in">
              <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-semibold mb-3">Sign in</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-2">
                ログイン
              </h2>
              <p className="text-sm text-slate-600">登録済みのアカウントでサインインしてください</p>
            </div>

            {linkInvalid && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-5 flex items-start gap-3 anim-in">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 font-medium">
                  リンクが無効か期限切れです。
                  <Link href="/reset-password" className="underline font-bold">
                    パスワード再設定
                  </Link>
                  から新しいリンクを発行してください。
                </div>
              </div>
            )}

            {state?.error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mb-5 flex items-start gap-3 anim-in">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-rose-900 font-medium">{state.error}</div>
              </div>
            )}

            <form action={formAction} className="space-y-4 anim-in anim-delay-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    required
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15 transition-all"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    パスワード
                  </label>
                  <Link
                    href="/reset-password"
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline"
                  >
                    パスワードを忘れた
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="••••••••"
                    required
                    className="w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15 transition-all"
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

              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  name="rememberMe"
                  className="w-4 h-4 rounded cursor-pointer accent-brand-600"
                />
                <span className="text-sm text-slate-700">この端末を信頼する（30日間）</span>
              </label>

              <SubmitButton />
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center">
              <Link
                href="/qr"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700"
              >
                <QrCode className="w-4 h-4" />
                スマホで開く（QRコード）
              </Link>
            </div>
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-6 py-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
    >
      {pending ? (
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
  );
}

function FeatureBox({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <Icon className="w-4 h-4 text-white/70 mb-3" />
      <div className="font-display text-sm font-bold text-white mb-0.5">{label}</div>
      <div className="text-[11px] text-white/50 leading-snug">{sub}</div>
    </div>
  );
}

