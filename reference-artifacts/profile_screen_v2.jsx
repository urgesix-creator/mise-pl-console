import React, { useState, useMemo } from 'react';
import { Save, Mail, Shield, ShieldCheck, Eye, EyeOff, Check, AlertTriangle, AlertCircle, X, Crown, Globe, Store, Briefcase, Calculator, Calendar, Clock, Activity, LogOut, Smartphone, KeyRound, Languages } from 'lucide-react';

// ==================== MOCK DATA ====================
const currentUser = {
  id: 'u1',
  name: '比嘉 俊一',
  email: 'higa@koga-hd.co.jp',
  roleId: 'executive',
  storeIds: [],
  country: '日本',
  has2FA: true,
  language: 'ja',
  memberSince: '2017-04-01',
  lastLoginAt: '2分前',
  loginCount: 1287,
  recentSessions: [
    { device: 'iPhone 15 Pro', location: '東京', lastActive: '2分前', current: true },
    { device: 'MacBook Pro', location: '東京', lastActive: '1時間前', current: false },
    { device: 'iPad', location: 'バンコク', lastActive: '3日前', current: false },
  ],
};

const ROLES_CONFIG = {
  executive: { label: '経営層', sub: 'Executive', icon: Crown, badgeColor: 'bg-slate-900 text-white' },
  country_rep: { label: '各国代表', sub: 'Country Rep', icon: Globe, badgeColor: 'bg-indigo-100 text-indigo-700' },
  store_manager: { label: '店舗店長', sub: 'Store Manager', icon: Store, badgeColor: 'bg-emerald-100 text-emerald-700' },
  staff: { label: '現場社員', sub: 'Staff', icon: Briefcase, badgeColor: 'bg-amber-100 text-amber-700' },
  accounting: { label: '経理・税理士', sub: 'Accounting', icon: Calculator, badgeColor: 'bg-violet-100 text-violet-700' },
};

// 言語設定
const LANGUAGES = [
  { id: 'ja', name: '日本語', native: '日本語', flag: '🇯🇵', description: 'Japanese', sample: 'ようこそ' },
  { id: 'en', name: 'English', native: 'English', flag: '🌐', description: 'English', sample: 'Welcome' },
  { id: 'th', name: 'タイ語', native: 'ภาษาไทย', flag: '🇹🇭', description: 'Thai', sample: 'ยินดีต้อนรับ' },
  { id: 'id', name: 'インドネシア語', native: 'Bahasa Indonesia', flag: '🇮🇩', description: 'Indonesian', sample: 'Selamat datang' },
];

const getInitials = (name) => {
  const parts = name.split(' ');
  if (parts.length >= 2) return parts[0].charAt(0) + parts[1].charAt(0);
  return name.substring(0, 2);
};

// ==================== COMPONENT ====================
export default function ProfileScreen() {
  const [user, setUser] = useState(currentUser);
  const [displayName, setDisplayName] = useState(user.name);
  const [nameDirty, setNameDirty] = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState(null);

  // 2FA
  const [twoFAModalOpen, setTwoFAModalOpen] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState('intro');

  // Logout
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [toast, setToast] = useState(null);

  const role = ROLES_CONFIG[user.roleId];
  const currentLang = LANGUAGES.find(l => l.id === user.language);

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

  const allValid = Object.values(pwValidation).every(v => v) && currentPw.length > 0;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveName = () => {
    if (!displayName.trim()) return;
    setUser({ ...user, name: displayName.trim() });
    setNameDirty(false);
    showToast('success', '表示名を更新しました');
  };

  const handleChangeLanguage = (langId) => {
    if (user.language === langId) return;
    const lang = LANGUAGES.find(l => l.id === langId);
    setUser({ ...user, language: langId });
    showToast('success', `言語を ${lang.native} に変更しました`);
  };

  const handleChangePassword = () => {
    setPwError(null);
    if (!allValid) {
      setPwError('入力内容を確認してください');
      return;
    }
    if (currentPw !== 'demo1234') {
      setPwError('現在のパスワードが正しくありません');
      return;
    }
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    showToast('success', 'パスワードを変更しました');
  };

  const handleSetup2FA = () => {
    setTwoFAStep('intro');
    setTwoFAModalOpen(true);
  };

  const handleDisable2FA = () => {
    setUser({ ...user, has2FA: false });
    showToast('success', '2要素認証を無効にしました');
  };

  const handleConfirm2FA = () => {
    setUser({ ...user, has2FA: true });
    setTwoFAModalOpen(false);
    setTwoFAStep('intro');
    showToast('success', '2要素認証を有効にしました');
  };

  const handleLogout = () => {
    setLogoutModalOpen(false);
    showToast('success', 'ログアウト処理（デモ）');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
        
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        .font-display { font-family: 'Bricolage Grotesque', 'Noto Sans JP', sans-serif; letter-spacing: -0.02em; }
        .font-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }
        .font-thai { font-family: 'Noto Sans Thai', 'Noto Sans JP', sans-serif; }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #0F172A;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.3s ease-out backwards; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
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
              <span>プロフィール</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {getInitials(user.name)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {/* Page Header */}
        <div className="mb-8 anim-in">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Profile · Personal Settings</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
            プロフィール
          </h1>
          <p className="text-sm text-slate-600">
            アカウント情報・パスワード・2要素認証・言語を管理します
          </p>
        </div>

        {/* Profile Hero Card */}
        <div className="mb-6 anim-in" style={{ animationDelay: '0.05s' }}>
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 blur-[100px] rounded-full translate-y-1/3 -translate-x-1/3" />
            
            <div className="relative flex items-center gap-5 flex-wrap">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold">{user.name}</h2>
                  <RoleBadge role={role} darkMode />
                </div>
                <div className="text-sm text-white/70 flex items-center gap-1.5 mb-3">
                  <Mail className="w-3.5 h-3.5" />
                  {user.email}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    メンバー歴 {user.memberSince}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3" />
                    {user.loginCount.toLocaleString()} 回ログイン
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    最終 {user.lastLoginAt}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Languages className="w-3 h-3" />
                    {currentLang?.flag} {currentLang?.native}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Basic Info */}
        <Section number="01" title="基本情報" delay="0.1s">
          <FormField label="表示名">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNameDirty(e.target.value !== user.name);
                }}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
              />
              {nameDirty && (
                <button
                  onClick={handleSaveName}
                  disabled={!displayName.trim()}
                  className="px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              )}
            </div>
          </FormField>
        </Section>

        {/* Section 2: Language（NEW） */}
        <Section number="02" title="言語 / Language" delay="0.13s">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Languages className="w-4 h-4 text-indigo-700" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-slate-900">表示言語</div>
                <div className="text-xs text-slate-500">UIの表示言語を選択。アカウントに保存されます</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LANGUAGES.map(lang => {
                const isSelected = user.language === lang.id;
                const isThai = lang.id === 'th';
                return (
                  <button
                    key={lang.id}
                    onClick={() => handleChangeLanguage(lang.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 hover:border-slate-400 bg-white text-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{lang.flag}</span>
                        <div>
                          <div className={`font-display text-sm font-bold ${isThai ? 'font-thai' : ''}`}>
                            {lang.native}
                          </div>
                          <div className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-white/60' : 'text-slate-500'}`}>
                            {lang.description}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                    </div>
                    <div className={`text-xs mt-2 ${isThai ? 'font-thai' : ''} ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                      "{lang.sample}"
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-slate-500 leading-relaxed">
              · 言語設定はアカウントに保存され、すべてのデバイスで反映されます
              <br />
              · 数値・日付フォーマットも言語ロケールに自動連動します
            </div>
          </div>
        </Section>

        {/* Section 3: Security */}
        <Section number="03" title="セキュリティ" delay="0.15s">
          {/* Password */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-slate-900">パスワード変更</div>
                <div className="text-xs text-slate-500">12文字以上、英大小文字・数字・記号を含む</div>
              </div>
            </div>

            <div className="space-y-3">
              <PasswordInput
                label="現在のパスワード"
                value={currentPw}
                onChange={setCurrentPw}
                show={showCurrent}
                onToggle={() => setShowCurrent(!showCurrent)}
              />
              <PasswordInput
                label="新しいパスワード"
                value={newPw}
                onChange={setNewPw}
                show={showNew}
                onToggle={() => setShowNew(!showNew)}
              />

              {newPw && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-colors ${
                          i < pwStrength
                            ? pwStrength <= 2 ? 'bg-rose-400' : pwStrength <= 3 ? 'bg-amber-400' : 'bg-emerald-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
                    <ValidationRow ok={pwValidation.length}>12文字以上</ValidationRow>
                    <ValidationRow ok={pwValidation.hasUpper}>大文字</ValidationRow>
                    <ValidationRow ok={pwValidation.hasLower}>小文字</ValidationRow>
                    <ValidationRow ok={pwValidation.hasNumber}>数字</ValidationRow>
                    <ValidationRow ok={pwValidation.hasSymbol}>記号</ValidationRow>
                  </div>
                </div>
              )}

              <PasswordInput
                label="確認用（再入力）"
                value={confirmPw}
                onChange={setConfirmPw}
                show={showConfirm}
                onToggle={() => setShowConfirm(!showConfirm)}
                error={confirmPw && !pwValidation.match ? 'パスワードが一致しません' : null}
              />

              {pwError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="text-xs text-rose-900 font-medium">{pwError}</span>
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={!allValid}
                className="w-full px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                パスワードを変更
              </button>
            </div>
          </div>

          {/* 2FA */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                user.has2FA ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                {user.has2FA
                  ? <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  : <Shield className="w-4 h-4 text-slate-700" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <div className="font-display text-sm font-bold text-slate-900">2要素認証</div>
                  {user.has2FA ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      有効
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                      無効
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  {user.has2FA
                    ? 'ログイン時に認証アプリのワンタイムコードが必要です'
                    : '認証アプリ（Google Authenticator等）でセキュリティを強化'
                  }
                </div>
                {user.has2FA ? (
                  <button onClick={handleDisable2FA} className="px-4 py-2 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-xs font-medium text-slate-700 hover:text-rose-700">
                    2FAを無効にする
                  </button>
                ) : (
                  <button onClick={handleSetup2FA} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    2FAを設定する
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-slate-900">アクティブなセッション</div>
                <div className="text-xs text-slate-500">直近のログイン端末</div>
              </div>
            </div>
            <div className="space-y-2">
              {user.recentSessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{s.device}</span>
                      {s.current && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                          <div className="w-1 h-1 rounded-full bg-emerald-500" />
                          現在のセッション
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.location} · {s.lastActive}</div>
                  </div>
                  {!s.current && (
                    <button className="text-xs text-rose-600 hover:underline font-medium flex-shrink-0">
                      終了
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Section 4: Account Info */}
        <Section number="04" title="アカウント情報" delay="0.2s">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <ReadOnlyRow label="ロール" value={<RoleBadge role={role} />} />
            <div className="border-t border-slate-100" />
            <ReadOnlyRow label="メールアドレス" value={<span className="text-sm text-slate-900">{user.email}</span>} />
            <div className="border-t border-slate-100" />
            <ReadOnlyRow label="所属国" value={<span className="text-sm text-slate-900">{user.country}</span>} />
            <div className="border-t border-slate-100" />
            <ReadOnlyRow label="メンバー歴" value={<span className="font-num text-sm text-slate-900">{user.memberSince}</span>} />
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 leading-relaxed">
            メールアドレス・ロール・所属店舗の変更は管理者（経営層）のみ可能です。
          </div>
        </Section>

        {/* Section 5: Logout */}
        <Section number="05" title="ログアウト" delay="0.25s">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm font-bold text-slate-900 mb-1">この端末からログアウト</div>
                <div className="text-xs text-slate-500 mb-3">
                  現在のセッションを終了します
                </div>
                <button onClick={() => setLogoutModalOpen(true)} className="px-4 py-2 rounded-lg border border-rose-200 hover:bg-rose-50 text-xs font-medium text-rose-700 flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </Section>
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

      {/* 2FA Modal */}
      {twoFAModalOpen && (
        <ModalShell
          title={twoFAStep === 'intro' ? '2要素認証を設定' : twoFAStep === 'qr' ? 'QRコードをスキャン' : 'コードを確認'}
          subtitle="Two-Factor Authentication"
          onClose={() => { setTwoFAModalOpen(false); setTwoFAStep('intro'); }}
        >
          {twoFAStep === 'intro' && (
            <>
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-900">
                    2要素認証でログインのセキュリティを大幅に強化できます
                  </div>
                </div>
              </div>
              <ModalFooter>
                <button onClick={() => { setTwoFAModalOpen(false); setTwoFAStep('intro'); }} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
                  キャンセル
                </button>
                <button onClick={() => setTwoFAStep('qr')} className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold">
                  続ける
                </button>
              </ModalFooter>
            </>
          )}
          {twoFAStep === 'qr' && (
            <>
              <div className="space-y-4">
                <div className="text-sm text-slate-600">認証アプリでQRコードをスキャン</div>
                <div className="flex justify-center">
                  <div className="w-48 h-48 rounded-xl bg-slate-100 flex items-center justify-center">
                    <div className="grid grid-cols-7 gap-0.5 p-3">
                      {Array.from({ length: 49 }).map((_, i) => (
                        <div key={i} className={`w-3 h-3 ${Math.random() > 0.5 ? 'bg-slate-900' : 'bg-transparent'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <ModalFooter>
                <button onClick={() => setTwoFAStep('intro')} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
                  戻る
                </button>
                <button onClick={() => setTwoFAStep('verify')} className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold">
                  スキャン完了
                </button>
              </ModalFooter>
            </>
          )}
          {twoFAStep === 'verify' && (
            <>
              <div className="space-y-4">
                <div className="text-sm text-slate-600">認証アプリの6桁のコードを入力</div>
                <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" className="w-full px-4 py-4 border border-slate-200 rounded-lg text-center font-num text-2xl font-bold tracking-[0.4em] bg-white" autoFocus />
              </div>
              <ModalFooter>
                <button onClick={() => setTwoFAStep('qr')} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
                  戻る
                </button>
                <button onClick={handleConfirm2FA} className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold">
                  有効にする
                </button>
              </ModalFooter>
            </>
          )}
        </ModalShell>
      )}

      {/* Logout */}
      {logoutModalOpen && (
        <ModalShell title="ログアウトの確認" subtitle="Confirm Logout" onClose={() => setLogoutModalOpen(false)}>
          <div className="rounded-lg bg-slate-50 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setLogoutModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button onClick={handleLogout} className="flex-1 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </ModalFooter>
        </ModalShell>
      )}
    </div>
  );
}

// SUB COMPONENTS
function Section({ number, title, children, delay }) {
  return (
    <section className="mb-6 anim-in" style={{ animationDelay: delay }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="font-num text-[10px] font-bold tracking-widest text-slate-400">{number}</div>
        <div className="w-px h-4 bg-slate-200" />
        <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FormField({ label, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <div>{value}</div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, onToggle, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 pr-12 py-2.5 border rounded-lg text-sm bg-white ${error ? 'border-rose-300' : 'border-slate-200'}`}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <div className="text-xs text-rose-600 mt-1">{error}</div>}
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

function RoleBadge({ role, darkMode }) {
  if (!role) return null;
  const Icon = role.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
      darkMode ? 'bg-white/10 text-white border border-white/20' : role.badgeColor
    }`}>
      <Icon className="w-3 h-3" />
      {role.label}
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
