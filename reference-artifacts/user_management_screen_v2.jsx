import React, { useState, useMemo } from 'react';
import { Users, Plus, Search, Mail, Shield, ShieldCheck, MoreHorizontal, Crown, Globe, Store, Briefcase, Calculator, X, Check, AlertTriangle, AlertCircle, ChevronDown, Filter, RotateCcw, UserX, UserCheck, Send, Edit3, Trash2, Calendar, Activity, Clock, Languages, Sparkles } from 'lucide-react';

// ==================== MOCK DATA ====================
const ROLES_CONFIG = {
  executive: { label: '経営層', sub: 'Executive', icon: Crown, badgeColor: 'bg-slate-900 text-white', dotColor: 'bg-slate-900', desc: '全店全機能アクセス、最高権限' },
  country_rep: { label: '各国代表', sub: 'Country Rep', icon: Globe, badgeColor: 'bg-indigo-100 text-indigo-700', dotColor: 'bg-indigo-500', desc: '担当国の全店舗を管理' },
  store_manager: { label: '店舗店長', sub: 'Store Manager', icon: Store, badgeColor: 'bg-emerald-100 text-emerald-700', dotColor: 'bg-emerald-500', desc: '担当店舗の入力・管理' },
  staff: { label: '現場社員', sub: 'Staff', icon: Briefcase, badgeColor: 'bg-amber-100 text-amber-700', dotColor: 'bg-amber-500', desc: '担当店舗の入力のみ' },
  accounting: { label: '経理・税理士', sub: 'Accounting', icon: Calculator, badgeColor: 'bg-violet-100 text-violet-700', dotColor: 'bg-violet-500', desc: '全店読取・出力（編集不可）' },
};

const COUNTRIES = [
  { id: 'jp', name: '日本', flag: '🇯🇵' },
  { id: 'th', name: 'タイ', flag: '🇹🇭' },
  { id: 'id', name: 'インドネシア', flag: '🇮🇩' },
  { id: 'tw', name: '台湾', flag: '🇹🇼' },
];

const LANGUAGES = [
  { id: 'ja', name: '日本語', native: '日本語', flag: '🇯🇵' },
  { id: 'en', name: 'English', native: 'English', flag: '🌐' },
  { id: 'th', name: 'タイ語', native: 'ภาษาไทย', flag: '🇹🇭' },
  { id: 'id', name: 'インドネシア語', native: 'Bahasa Indonesia', flag: '🇮🇩' },
];

// 国コードから推奨言語を取得（lib_i18n_locales.ts と一致）
const suggestLanguageByCountry = (countryId) => {
  switch (countryId) {
    case 'jp': return 'ja';
    case 'th': return 'th';
    case 'id': return 'id';
    case 'tw': return 'en';
    default: return 'ja';
  }
};

const STORES = [
  { id: 's1', name: 'あお季タイ', country: 'th' },
  { id: 's2', name: 'AOKI ロバタ', country: 'th' },
  { id: 's3', name: '博多天神ジャカルタ', country: 'id' },
];

const initialUsers = [
  { id: 'u1', name: '比嘉 俊一', email: 'higa@koga-hd.co.jp', roleId: 'executive', country: 'jp', storeIds: [], language: 'ja', has2FA: true, status: 'active', lastLoginAt: '2分前', createdAt: '2017-04-01' },
  { id: 'u2', name: '古賀 善敏', email: 'koga@koga-hd.co.jp', roleId: 'executive', country: 'jp', storeIds: [], language: 'ja', has2FA: true, status: 'active', lastLoginAt: '15分前', createdAt: '2015-01-01' },
  { id: 'u3', name: '山本 賢一', email: 'yamamoto@koga-hd.co.jp', roleId: 'country_rep', country: 'th', storeIds: ['s1', 's2'], language: 'ja', has2FA: true, status: 'active', lastLoginAt: '1時間前', createdAt: '2018-04-01' },
  { id: 'u4', name: '西村 英朗', email: 'nishimura@koga-hd.co.jp', roleId: 'country_rep', country: 'id', storeIds: ['s3'], language: 'ja', has2FA: false, status: 'active', lastLoginAt: '昨日', createdAt: '2026-03-01' },
  { id: 'u5', name: 'Somchai P.', email: 'somchai@aoki-thai.com', roleId: 'store_manager', country: 'th', storeIds: ['s1'], language: 'th', has2FA: false, status: 'active', lastLoginAt: '30分前', createdAt: '2024-09-01' },
  { id: 'u6', name: 'Anong K.', email: 'anong@aoki-thai.com', roleId: 'staff', country: 'th', storeIds: ['s1'], language: 'th', has2FA: false, status: 'active', lastLoginAt: '2時間前', createdAt: '2025-01-15' },
  { id: 'u7', name: 'Budi Santoso', email: 'budi@hakata-jakarta.id', roleId: 'store_manager', country: 'id', storeIds: ['s3'], language: 'id', has2FA: false, status: 'active', lastLoginAt: '4時間前', createdAt: '2020-06-01' },
  { id: 'u8', name: 'Sari W.', email: 'sari@hakata-jakarta.id', roleId: 'staff', country: 'id', storeIds: ['s3'], language: 'id', has2FA: false, status: 'pending', lastLoginAt: '—', createdAt: '2026-05-08' },
  { id: 'u9', name: '鈴木 会計士', email: 'suzuki@suzuki-tax.jp', roleId: 'accounting', country: 'jp', storeIds: [], language: 'ja', has2FA: true, status: 'active', lastLoginAt: '3日前', createdAt: '2019-04-01' },
  { id: 'u10', name: '元店長 田中', email: 'tanaka@old.co.jp', roleId: 'staff', country: 'th', storeIds: ['s1'], language: 'ja', has2FA: false, status: 'deactivated', lastLoginAt: '6ヶ月前', createdAt: '2022-04-01' },
];

const getInitials = (name) => {
  const parts = name.split(' ');
  if (parts.length >= 2) return parts[0].charAt(0) + parts[1].charAt(0);
  return name.substring(0, 2);
};

// ==================== COMPONENT ====================
export default function UserManagementScreen() {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'all' && u.roleId !== filterRole) return false;
      if (filterStatus !== 'all' && u.status !== filterStatus) return false;
      if (filterLanguage !== 'all' && u.language !== filterLanguage) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, searchQuery, filterRole, filterStatus, filterLanguage]);

  const stats = useMemo(() => {
    const active = users.filter(u => u.status === 'active').length;
    const pending = users.filter(u => u.status === 'pending').length;
    const with2FA = users.filter(u => u.has2FA).length;
    return { total: users.length, active, pending, with2FA };
  }, [users]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInvite = (newUserData) => {
    const id = `u${Date.now()}`;
    setUsers([...users, {
      id,
      ...newUserData,
      has2FA: false,
      status: 'pending',
      lastLoginAt: '—',
      createdAt: new Date().toISOString().split('T')[0],
    }]);
    setInviteModalOpen(false);
    const lang = LANGUAGES.find(l => l.id === newUserData.language);
    showToast('success', `${newUserData.email} に${lang.native}で招待メールを送信しました`);
  };

  const handleUpdate = (userData) => {
    setUsers(users.map(u => u.id === userData.id ? { ...u, ...userData } : u));
    setEditingUser(null);
    showToast('success', `${userData.name} の情報を更新しました`);
  };

  const handleDeactivate = (user) => {
    setUsers(users.map(u => u.id === user.id ? { ...u, status: 'deactivated' } : u));
    setConfirmAction(null);
    showToast('success', `${user.name} を無効化しました`);
  };

  const handleReactivate = (user) => {
    setUsers(users.map(u => u.id === user.id ? { ...u, status: 'active' } : u));
    showToast('success', `${user.name} を再有効化しました`);
  };

  const handleResendInvite = (user) => {
    const lang = LANGUAGES.find(l => l.id === user.language);
    showToast('success', `${user.email} に招待メールを${lang.native}で再送しました`);
  };

  const handleReset2FA = (user) => {
    setUsers(users.map(u => u.id === user.id ? { ...u, has2FA: false } : u));
    setConfirmAction(null);
    showToast('success', `${user.name} の2FAをリセットしました`);
  };

  const activeFiltersCount = [
    filterRole !== 'all',
    filterStatus !== 'all',
    filterLanguage !== 'all',
    searchQuery !== '',
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
        
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { font-family: 'Manrope', 'Noto Sans JP', sans-serif; }
        .font-display { font-family: 'Bricolage Grotesque', 'Noto Sans JP', sans-serif; letter-spacing: -0.02em; }
        .font-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }
        .font-thai { font-family: 'Noto Sans Thai', 'Noto Sans JP', sans-serif; }

        input:focus, select:focus { outline: none; border-color: #0F172A; box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08); }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.3s ease-out backwards; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
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
              <span>管理メニュー</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-medium">ユーザー管理</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              比
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {/* Page Header */}
        <div className="mb-6 anim-in flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
              <div className="w-8 h-px bg-slate-300" />
              <span>Admin · User Management</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
              ユーザー
            </h1>
            <p className="text-sm text-slate-600">
              メンバーの招待・ロール割当・言語設定・アカウント管理
            </p>
          </div>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10"
          >
            <Plus className="w-4 h-4" />
            ユーザーを招待
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 anim-in" style={{ animationDelay: '0.05s' }}>
          <StatCard label="総ユーザー" value={stats.total} unit="名" icon={Users} />
          <StatCard label="アクティブ" value={stats.active} unit="名" icon={UserCheck} colorClass="text-emerald-700" />
          <StatCard label="招待中" value={stats.pending} unit="名" icon={Send} colorClass="text-amber-700" />
          <StatCard label="2FA有効" value={stats.with2FA} unit={`/${stats.total}`} icon={ShieldCheck} colorClass="text-indigo-700" />
        </div>

        {/* Filters */}
        <div className="mb-4 flex items-center gap-2 flex-wrap anim-in" style={{ animationDelay: '0.1s' }}>
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前・メールで検索"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </div>
          <FilterSelect value={filterRole} onChange={setFilterRole} options={[
            { value: 'all', label: '全ロール' },
            ...Object.entries(ROLES_CONFIG).map(([id, c]) => ({ value: id, label: c.label }))
          ]} />
          <FilterSelect value={filterStatus} onChange={setFilterStatus} options={[
            { value: 'all', label: '全ステータス' },
            { value: 'active', label: 'アクティブ' },
            { value: 'pending', label: '招待中' },
            { value: 'deactivated', label: '無効化' },
          ]} />
          <FilterSelect value={filterLanguage} onChange={setFilterLanguage} options={[
            { value: 'all', label: '全言語' },
            ...LANGUAGES.map(l => ({ value: l.id, label: `${l.flag} ${l.name}` }))
          ]} />
          {activeFiltersCount > 0 && (
            <button
              onClick={() => { setSearchQuery(''); setFilterRole('all'); setFilterStatus('all'); setFilterLanguage('all'); }}
              className="px-3 py-2.5 rounded-lg border border-slate-200 hover:border-slate-400 text-xs font-medium text-slate-700 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              フィルタクリア（{activeFiltersCount}）
            </button>
          )}
        </div>

        {/* User List */}
        <div className="anim-in" style={{ animationDelay: '0.15s' }}>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <div className="text-sm text-slate-500">該当するユーザーがありません</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUsers.map(user => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onEdit={() => setEditingUser(user)}
                    onDeactivate={() => setConfirmAction({ type: 'deactivate', user })}
                    onReactivate={() => handleReactivate(user)}
                    onResendInvite={() => handleResendInvite(user)}
                    onReset2FA={() => setConfirmAction({ type: 'reset2fa', user })}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>{filteredUsers.length} 名表示中（全 {users.length} 名）</span>
          </div>
        </div>

        {/* Help */}
        <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 招待メールはユーザーの言語で送信されます。所属国に応じて自動推奨</p>
          <p>· 退職等で利用停止する場合は「無効化」を使用（過去データは保持）</p>
          <p>· メールアドレスの変更は本人ログイン後にプロフィール画面で操作不可。サポート対応となります</p>
        </div>
      </main>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <InviteModal onClose={() => setInviteModalOpen(false)} onSubmit={handleInvite} />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditModal user={editingUser} onClose={() => setEditingUser(null)} onSubmit={handleUpdate} />
      )}

      {/* Confirm Action */}
      {confirmAction?.type === 'deactivate' && (
        <ConfirmModal
          title="アカウントの無効化"
          subtitle="Confirm Deactivation"
          icon={UserX}
          iconColor="bg-rose-100 text-rose-600"
          message={`${confirmAction.user.name} のアカウントを無効化します。ログイン不可となりますが、過去データは保持されます。`}
          confirmLabel="無効化"
          confirmClass="bg-rose-600 hover:bg-rose-700"
          onConfirm={() => handleDeactivate(confirmAction.user)}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {confirmAction?.type === 'reset2fa' && (
        <ConfirmModal
          title="2FAをリセット"
          subtitle="Reset Two-Factor Authentication"
          icon={Shield}
          iconColor="bg-amber-100 text-amber-600"
          message={`${confirmAction.user.name} の2要素認証設定をリセットします。次回ログイン時に再設定が必要となります。`}
          confirmLabel="リセット"
          confirmClass="bg-amber-600 hover:bg-amber-700"
          onConfirm={() => handleReset2FA(confirmAction.user)}
          onClose={() => setConfirmAction(null)}
        />
      )}

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
    </div>
  );
}

// ==================== USER ROW ====================
function UserRow({ user, onEdit, onDeactivate, onReactivate, onResendInvite, onReset2FA }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = ROLES_CONFIG[user.roleId];
  const country = COUNTRIES.find(c => c.id === user.country);
  const language = LANGUAGES.find(l => l.id === user.language);
  const Icon = role.icon;
  const isThaiName = user.language === 'th' && /[\u0E00-\u0E7F]/.test(user.name);

  return (
    <div className={`px-5 py-4 hover:bg-slate-50 transition-colors ${
      user.status === 'deactivated' ? 'opacity-60' : ''
    }`}>
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold ${
            user.status === 'pending' ? 'bg-slate-300' : `bg-gradient-to-br from-${role.dotColor.replace('bg-', '')} to-slate-700`
          }`} style={user.status !== 'pending' ? { background: `linear-gradient(135deg, var(--tw-gradient-from), #475569)` } : {}}>
            {getInitials(user.name)}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
            user.status === 'active' ? 'bg-emerald-500' :
            user.status === 'pending' ? 'bg-amber-500' :
            'bg-slate-400'
          }`} />
        </div>

        {/* Name & Email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-display text-sm font-bold text-slate-900 truncate ${isThaiName ? 'font-thai' : ''}`}>
              {user.name}
            </span>
            <RoleBadge role={role} />
            {!user.has2FA && user.status === 'active' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700">
                <Shield className="w-2.5 h-2.5" />
                2FA未設定
              </span>
            )}
            {user.status === 'pending' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700">
                招待中
              </span>
            )}
            {user.status === 'deactivated' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                無効化
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            <span className="truncate flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </span>
            {country && (
              <span className="hidden sm:flex items-center gap-1">
                <span>{country.flag}</span>
                {country.name}
              </span>
            )}
          </div>
        </div>

        {/* Language */}
        <div className="hidden md:flex flex-col items-end text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            <span className="text-sm">{language.flag}</span>
            <span className={`font-medium text-[11px] ${user.language === 'th' ? 'font-thai' : ''}`}>
              {language.native}
            </span>
          </div>
        </div>

        {/* Last login */}
        <div className="hidden lg:flex flex-col items-end text-xs flex-shrink-0 w-24">
          <span className="text-slate-500">最終ログイン</span>
          <span className="font-num text-slate-700 font-medium">{user.lastLoginAt}</span>
        </div>

        {/* Actions */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center"
          >
            <MoreHorizontal className="w-4 h-4 text-slate-600" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-48 rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  編集
                </button>
                {user.status === 'pending' && (
                  <button
                    onClick={() => { onResendInvite(); setMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    招待を再送
                  </button>
                )}
                {user.status === 'active' && user.has2FA && (
                  <button
                    onClick={() => { onReset2FA(); setMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    2FAをリセット
                  </button>
                )}
                <div className="border-t border-slate-100" />
                {user.status === 'deactivated' ? (
                  <button
                    onClick={() => { onReactivate(); setMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    再有効化
                  </button>
                ) : (
                  <button
                    onClick={() => { onDeactivate(); setMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    無効化
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== INVITE MODAL ====================
function InviteModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleId: 'staff',
    country: 'th',
    storeIds: [],
    language: 'th', // 国'th' に応じた推奨
  });
  const [languageManuallyChanged, setLanguageManuallyChanged] = useState(false);

  const suggested = suggestLanguageByCountry(formData.country);
  const showSuggestion = !languageManuallyChanged && formData.language !== suggested;

  const handleCountryChange = (countryId) => {
    const newSuggested = suggestLanguageByCountry(countryId);
    setFormData({
      ...formData,
      country: countryId,
      // 言語をユーザーが手動で変えていない場合のみ自動更新
      language: languageManuallyChanged ? formData.language : newSuggested,
      storeIds: [], // 国が変わったら店舗もリセット
    });
  };

  const handleLanguageChange = (langId) => {
    setFormData({ ...formData, language: langId });
    setLanguageManuallyChanged(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.email.trim()) return;
    onSubmit(formData);
  };

  const filteredStores = STORES.filter(s => s.country === formData.country);
  const showStores = ['country_rep', 'store_manager', 'staff'].includes(formData.roleId);
  const language = LANGUAGES.find(l => l.id === formData.language);
  const country = COUNTRIES.find(c => c.id === formData.country);

  return (
    <ModalShell title="ユーザーを招待" subtitle="Invite User" onClose={onClose} large>
      <div className="space-y-6">
        {/* Section 01: Basic Info */}
        <ModalSection number="01" title="基本情報">
          <Field label="表示名" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例: 山田 太郎 / John Smith / สมชาย / Budi"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
              autoFocus
            />
          </Field>
          <Field label="メールアドレス" required>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@example.com"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
            />
            <div className="text-xs text-slate-500 mt-1.5">
              このメールアドレスに招待リンクが送信されます
            </div>
          </Field>
        </ModalSection>

        {/* Section 02: Role */}
        <ModalSection number="02" title="ロール">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(ROLES_CONFIG).map(([id, config]) => {
              const Icon = config.icon;
              const isSelected = formData.roleId === id;
              return (
                <button
                  key={id}
                  onClick={() => setFormData({ ...formData, roleId: id })}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="font-display text-sm font-bold">{config.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </div>
                  <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                    {config.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </ModalSection>

        {/* Section 03: Country & Stores */}
        <ModalSection number="03" title="所属">
          <Field label="所属国">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COUNTRIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleCountryChange(c.id)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all ${
                    formData.country === c.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 hover:border-slate-400 text-slate-700'
                  }`}
                >
                  <span>{c.flag}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </Field>

          {showStores && (
            <Field label="所属店舗">
              {filteredStores.length === 0 ? (
                <div className="text-xs text-slate-500 italic px-3 py-2">
                  この国に登録された店舗がありません
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStores.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.storeIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, storeIds: [...formData.storeIds, s.id] });
                          } else {
                            setFormData({ ...formData, storeIds: formData.storeIds.filter(id => id !== s.id) });
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-900">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
          )}
        </ModalSection>

        {/* Section 04: Language（NEW） */}
        <ModalSection number="04" title="言語 / Language" highlight>
          {showSuggestion && country && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 mb-3 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-indigo-900 font-medium mb-1.5">
                  {country.name}所属のため、{LANGUAGES.find(l => l.id === suggested)?.native} を推奨
                </div>
                <button
                  onClick={() => { setFormData({ ...formData, language: suggested }); setLanguageManuallyChanged(false); }}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline"
                >
                  推奨言語に切り替える →
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LANGUAGES.map(lang => {
              const isSelected = formData.language === lang.id;
              const isSuggested = lang.id === suggested;
              const isThai = lang.id === 'th';
              return (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang.id)}
                  className={`text-left p-3 rounded-xl border transition-all relative ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 hover:border-slate-400 bg-white text-slate-900'
                  }`}
                >
                  {isSuggested && !isSelected && (
                    <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold">
                      <Sparkles className="w-2.5 h-2.5" />
                      推奨
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="min-w-0">
                      <div className={`font-display text-sm font-bold ${isThai ? 'font-thai' : ''}`}>
                        {lang.native}
                      </div>
                      <div className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-white/60' : 'text-slate-500'}`}>
                        {lang.name}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-700 leading-relaxed">
            <div className="font-medium mb-1">{language?.flag} {language?.native} で招待メールが送信されます</div>
            UI言語はログイン後にユーザー自身でも変更可能です
          </div>
        </ModalSection>

        {/* Summary */}
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 leading-relaxed">
          招待メールには初期パスワード設定リンクが含まれます（24時間有効）。受信者がリンクをクリックしてパスワードを設定すると、アカウントが「アクティブ」になります。
        </div>
      </div>

      <ModalFooter>
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
          キャンセル
        </button>
        <button
          onClick={handleSubmit}
          disabled={!formData.name.trim() || !formData.email.trim()}
          className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          招待メールを送信
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

// ==================== EDIT MODAL ====================
function EditModal({ user, onClose, onSubmit }) {
  const [formData, setFormData] = useState(user);

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  const filteredStores = STORES.filter(s => s.country === formData.country);
  const showStores = ['country_rep', 'store_manager', 'staff'].includes(formData.roleId);

  return (
    <ModalShell title="ユーザーを編集" subtitle={user.email} onClose={onClose} large>
      <div className="space-y-6">
        <ModalSection number="01" title="基本情報">
          <Field label="表示名">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </Field>
        </ModalSection>

        <ModalSection number="02" title="ロール">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(ROLES_CONFIG).map(([id, config]) => {
              const Icon = config.icon;
              const isSelected = formData.roleId === id;
              return (
                <button
                  key={id}
                  onClick={() => setFormData({ ...formData, roleId: id })}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-display text-sm font-bold">{config.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>
        </ModalSection>

        <ModalSection number="03" title="所属">
          <Field label="所属国">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COUNTRIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setFormData({ ...formData, country: c.id, storeIds: [] })}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 ${
                    formData.country === c.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <span>{c.flag}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
          {showStores && filteredStores.length > 0 && (
            <Field label="所属店舗">
              <div className="space-y-2">
                {filteredStores.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.storeIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, storeIds: [...formData.storeIds, s.id] });
                        } else {
                          setFormData({ ...formData, storeIds: formData.storeIds.filter(id => id !== s.id) });
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-900">{s.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </ModalSection>

        <ModalSection number="04" title="言語 / Language">
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map(lang => {
              const isSelected = formData.language === lang.id;
              const isThai = lang.id === 'th';
              return (
                <button
                  key={lang.id}
                  onClick={() => setFormData({ ...formData, language: lang.id })}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <span className={`text-sm font-bold ${isThai ? 'font-thai' : ''}`}>{lang.native}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            管理者による言語変更。次回ログイン時から反映されます
          </div>
        </ModalSection>
      </div>

      <ModalFooter>
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
          キャンセル
        </button>
        <button onClick={handleSubmit} className="flex-1 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold">
          保存
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

// ==================== HELPERS ====================
function StatCard({ label, value, unit, icon: Icon, colorClass = 'text-slate-700' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 uppercase tracking-wider font-semibold">
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-slate-900">
        {value}
        <span className="font-num text-sm text-slate-400 font-medium ml-1">{unit}</span>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

function RoleBadge({ role }) {
  if (!role) return null;
  const Icon = role.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${role.badgeColor}`}>
      <Icon className="w-2.5 h-2.5" />
      {role.label}
    </span>
  );
}

function ModalShell({ title, subtitle, children, onClose, large }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className={`w-full ${large ? 'sm:max-w-2xl' : 'sm:max-w-md'} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in my-auto`}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="min-w-0">
            {subtitle && <div className="text-xs uppercase tracking-widest text-slate-500 mb-1 truncate">{subtitle}</div>}
            <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalSection({ number, title, children, highlight }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="font-num text-[10px] font-bold tracking-widest text-slate-400">{number}</div>
        <div className="w-px h-4 bg-slate-200" />
        <h4 className={`font-display text-sm font-bold ${highlight ? 'text-indigo-700' : 'text-slate-900'}`}>{title}</h4>
        {highlight && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold">
            NEW
          </span>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
        {label}
        {required && <span className="text-rose-600 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ConfirmModal({ title, subtitle, icon: Icon, iconColor, message, confirmLabel, confirmClass, onConfirm, onClose }) {
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-sm text-slate-700 leading-relaxed">{message}</div>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
          キャンセル
        </button>
        <button onClick={onConfirm} className={`flex-1 px-5 py-2.5 rounded-lg ${confirmClass} text-white text-sm font-bold`}>
          {confirmLabel}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function ModalFooter({ children }) {
  return (
    <div className="px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 -mx-6 -mb-6 mt-6 sticky bottom-0 bg-white rounded-b-2xl z-10">
      {children}
    </div>
  );
}
