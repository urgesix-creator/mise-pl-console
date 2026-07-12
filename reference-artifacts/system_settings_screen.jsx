import React, { useState, useMemo } from 'react';
import { Save, Check, AlertTriangle, X, Bell, AlertCircle, Clock, Shield, Settings, MessageSquare, Globe, Send, RotateCcw, ChevronDown, Zap, Calendar, Lock } from 'lucide-react';

// ==================== INITIAL SETTINGS ====================
const defaultSettings = {
  // 日報配信
  dailyReport: {
    enabled: true,
    sendTime: '09:00',
    slackChannel: '#sales-management',
    includeWeather: true,
    includeEvents: true,
  },
  // アラート閾値
  alerts: {
    enabled: true,
    salesAchievementThresholdPct: 95,
    customerVariancePct: 30,
    inputTimeoutHours: 24,
  },
  // リマインダー
  reminders: {
    dailyInputReminder: true,
    dailyInputReminderTime: '21:00',
    inventoryReminderEnabled: true,
    inventoryReminderDay: 1, // 1日前 = 月末当日リマインダー
  },
  // 認証・セキュリティ
  auth: {
    require2FAForExecutive: true,
    require2FAForCountryRep: true,
    sessionTimeoutMinutes: 480, // 8時間
    rememberDeviceDays: 30,
    passwordMinLength: 12,
  },
  // システム表示
  display: {
    systemName: 'Sales Console',
    defaultJpyConversion: true,
    fiscalYearStartMonth: 4,
  },
  // Slack連携
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/T0XXXXXXX/B0XXXXXXX/YYYYYYYYYY',
    enabled: true,
  },
};

// ==================== COMPONENT ====================
export default function SystemSettingsScreen() {
  const [settings, setSettings] = useState(defaultSettings);
  const [savedSettings, setSavedSettings] = useState(defaultSettings);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [testSlackResult, setTestSlackResult] = useState(null);
  const [showWebhook, setShowWebhook] = useState(false);
  const [toast, setToast] = useState(null);

  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const updateSetting = (section, key, value) => {
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
  };

  const handleSave = () => {
    setSavedSettings(settings);
    showToast('success', 'システム設定を保存しました');
  };

  const handleResetToDefaults = () => {
    setSettings(defaultSettings);
    setSavedSettings(defaultSettings);
    setResetConfirmOpen(false);
    showToast('success', 'デフォルト値に戻しました');
  };

  const handleDiscardChanges = () => {
    setSettings(savedSettings);
    showToast('success', '変更を破棄しました');
  };

  const handleTestSlack = () => {
    setTestSlackResult('loading');
    setTimeout(() => {
      setTestSlackResult('success');
      setTimeout(() => setTestSlackResult(null), 3000);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50">
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

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-in { animation: slideUp 0.3s ease-out backwards; }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-spin { animation: spin 0.8s linear infinite; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
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
              <span className="text-slate-900 font-medium">システム設定</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
              比
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-10 pb-32">
        {/* Page Header */}
        <div className="mb-8 anim-in">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 mb-3">
            <div className="w-8 h-px bg-slate-300" />
            <span>Admin · System Settings</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-2">
                システム設定
              </h1>
              <p className="text-sm text-slate-600">
                グローバル設定を管理します。すべての店舗・ユーザーに影響する設定です。
              </p>
            </div>
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 text-xs font-medium text-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              デフォルトに戻す
            </button>
          </div>
        </div>

        {/* Executive only notice */}
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3 anim-in" style={{ animationDelay: '0.05s' }}>
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">経営層限定：</span>このページの設定は経営層のみが変更できます。変更内容は全店舗・全ユーザーに即時反映され、Slack配信タイミング・アラート発火閾値・認証要件等が変わります。慎重に変更してください。
          </div>
        </div>

        {/* Section 1: Daily Report */}
        <Section number="01" title="日報配信" icon={Bell} delay="0.1s">
          <SettingRow
            label="日報の自動配信"
            description="毎朝、Slackへ昨日の店舗実績まとめを配信"
          >
            <Toggle
              checked={settings.dailyReport.enabled}
              onChange={(v) => updateSetting('dailyReport', 'enabled', v)}
            />
          </SettingRow>

          <SettingRow
            label="配信時刻"
            description="店舗ローカル時間ではなく、配信先（日本）の時刻"
            disabled={!settings.dailyReport.enabled}
          >
            <input
              type="time"
              value={settings.dailyReport.sendTime}
              onChange={(e) => updateSetting('dailyReport', 'sendTime', e.target.value)}
              disabled={!settings.dailyReport.enabled}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-num disabled:opacity-50"
            />
          </SettingRow>

          <SettingRow
            label="配信先 Slackチャンネル"
            description="日報・アラート両方の配信先"
            disabled={!settings.dailyReport.enabled}
          >
            <input
              type="text"
              value={settings.dailyReport.slackChannel}
              onChange={(e) => updateSetting('dailyReport', 'slackChannel', e.target.value)}
              disabled={!settings.dailyReport.enabled}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white w-48 disabled:opacity-50"
            />
          </SettingRow>

          <div className="border-t border-slate-100 pt-4 mt-2">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">日報に含める項目</div>
            <div className="space-y-3">
              <SettingRow
                label="天気情報"
                description="店舗の昨日の天気を含める"
                disabled={!settings.dailyReport.enabled}
                compact
              >
                <Toggle
                  checked={settings.dailyReport.includeWeather}
                  onChange={(v) => updateSetting('dailyReport', 'includeWeather', v)}
                  disabled={!settings.dailyReport.enabled}
                />
              </SettingRow>

              <SettingRow
                label="特記事項・イベント"
                description="店舗が記録したイベント情報"
                disabled={!settings.dailyReport.enabled}
                compact
              >
                <Toggle
                  checked={settings.dailyReport.includeEvents}
                  onChange={(v) => updateSetting('dailyReport', 'includeEvents', v)}
                  disabled={!settings.dailyReport.enabled}
                />
              </SettingRow>
            </div>
          </div>
        </Section>

        {/* Section 2: Alerts */}
        <Section number="02" title="アラート閾値" icon={AlertCircle} delay="0.15s">
          <SettingRow
            label="アラート通知"
            description="閾値違反時に Slackへ即時通知"
          >
            <Toggle
              checked={settings.alerts.enabled}
              onChange={(v) => updateSetting('alerts', 'enabled', v)}
            />
          </SettingRow>

          <SettingRow
            label="売上目標達成率の閾値"
            description="この値を下回るとアラート発火（達成率の色分けと連動）"
            disabled={!settings.alerts.enabled}
          >
            <NumberInputWithUnit
              value={settings.alerts.salesAchievementThresholdPct}
              onChange={(v) => updateSetting('alerts', 'salesAchievementThresholdPct', v)}
              unit="%"
              min={50}
              max={100}
              step={1}
              disabled={!settings.alerts.enabled}
            />
          </SettingRow>

          <SettingRow
            label="客単価変動の閾値"
            description="前7日平均との乖離率（プラスマイナス）"
            disabled={!settings.alerts.enabled}
          >
            <NumberInputWithUnit
              value={settings.alerts.customerVariancePct}
              onChange={(v) => updateSetting('alerts', 'customerVariancePct', v)}
              unit="%"
              min={5}
              max={100}
              step={5}
              disabled={!settings.alerts.enabled}
            />
          </SettingRow>

          <SettingRow
            label="入力遅延の閾値"
            description="この時間を過ぎても未入力ならアラート"
            disabled={!settings.alerts.enabled}
          >
            <NumberInputWithUnit
              value={settings.alerts.inputTimeoutHours}
              onChange={(v) => updateSetting('alerts', 'inputTimeoutHours', v)}
              unit="時間"
              min={1}
              max={72}
              step={1}
              disabled={!settings.alerts.enabled}
            />
          </SettingRow>
        </Section>

        {/* Section 3: Reminders */}
        <Section number="03" title="リマインダー" icon={Clock} delay="0.2s">
          <SettingRow
            label="日次入力リマインダー"
            description="店舗の入力責任者へ毎日リマインド"
          >
            <Toggle
              checked={settings.reminders.dailyInputReminder}
              onChange={(v) => updateSetting('reminders', 'dailyInputReminder', v)}
            />
          </SettingRow>

          <SettingRow
            label="リマインダー時刻"
            description="店舗ローカル時間"
            disabled={!settings.reminders.dailyInputReminder}
          >
            <input
              type="time"
              value={settings.reminders.dailyInputReminderTime}
              onChange={(e) => updateSetting('reminders', 'dailyInputReminderTime', e.target.value)}
              disabled={!settings.reminders.dailyInputReminder}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-num disabled:opacity-50"
            />
          </SettingRow>

          <SettingRow
            label="月末棚卸リマインダー"
            description="月末日に概算棚卸の更新を促す"
          >
            <Toggle
              checked={settings.reminders.inventoryReminderEnabled}
              onChange={(v) => updateSetting('reminders', 'inventoryReminderEnabled', v)}
            />
          </SettingRow>
        </Section>

        {/* Section 4: Auth */}
        <Section number="04" title="認証・セキュリティ" icon={Shield} delay="0.25s">
          <SettingRow
            label="経営層に2FA必須"
            description="経営層ロールのユーザーは2要素認証の設定が必須"
          >
            <Toggle
              checked={settings.auth.require2FAForExecutive}
              onChange={(v) => updateSetting('auth', 'require2FAForExecutive', v)}
            />
          </SettingRow>

          <SettingRow
            label="各国代表に2FA必須"
            description="各国代表ロールのユーザーは2要素認証の設定が必須"
          >
            <Toggle
              checked={settings.auth.require2FAForCountryRep}
              onChange={(v) => updateSetting('auth', 'require2FAForCountryRep', v)}
            />
          </SettingRow>

          <SettingRow
            label="セッションタイムアウト"
            description="無操作時の自動ログアウトまでの時間"
          >
            <NumberInputWithUnit
              value={settings.auth.sessionTimeoutMinutes}
              onChange={(v) => updateSetting('auth', 'sessionTimeoutMinutes', v)}
              unit="分"
              min={30}
              max={1440}
              step={30}
            />
          </SettingRow>

          <SettingRow
            label="信頼端末の有効期限"
            description="「この端末を信頼する」を選んだ場合の有効日数"
          >
            <NumberInputWithUnit
              value={settings.auth.rememberDeviceDays}
              onChange={(v) => updateSetting('auth', 'rememberDeviceDays', v)}
              unit="日"
              min={1}
              max={90}
              step={1}
            />
          </SettingRow>

          <SettingRow
            label="パスワード最小文字数"
            description="新規パスワード設定時の最小文字数"
          >
            <NumberInputWithUnit
              value={settings.auth.passwordMinLength}
              onChange={(v) => updateSetting('auth', 'passwordMinLength', v)}
              unit="文字"
              min={8}
              max={32}
              step={1}
            />
          </SettingRow>
        </Section>

        {/* Section 5: Slack Integration */}
        <Section number="05" title="Slack連携" icon={MessageSquare} delay="0.3s">
          <SettingRow
            label="Slack連携"
            description="日報・アラート配信の有効化"
          >
            <Toggle
              checked={settings.slack.enabled}
              onChange={(v) => updateSetting('slack', 'enabled', v)}
            />
          </SettingRow>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Webhook URL
            </div>
            <div className="text-xs text-slate-500 mb-3">
              Slack App の Incoming Webhooks で発行された URL（管理者のみ閲覧可）
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showWebhook ? 'text' : 'password'}
                  value={settings.slack.webhookUrl}
                  onChange={(e) => updateSetting('slack', 'webhookUrl', e.target.value)}
                  disabled={!settings.slack.enabled}
                  className="w-full px-4 pr-12 py-2.5 border border-slate-200 rounded-lg text-sm bg-white font-num disabled:opacity-50"
                />
                <button
                  onClick={() => setShowWebhook(!showWebhook)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-900"
                >
                  {showWebhook ? '隠す' : '表示'}
                </button>
              </div>
              <button
                onClick={handleTestSlack}
                disabled={!settings.slack.enabled}
                className="px-4 py-2.5 rounded-lg border border-slate-200 hover:border-slate-400 text-sm font-medium text-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {testSlackResult === 'loading' ? (
                  <>
                    <RotateCcw className="w-4 h-4 anim-spin" />
                    送信中
                  </>
                ) : testSlackResult === 'success' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    成功
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    テスト送信
                  </>
                )}
              </button>
            </div>
          </div>
        </Section>

        {/* Section 6: Display */}
        <Section number="06" title="システム表示" icon={Globe} delay="0.35s">
          <SettingRow
            label="システム名"
            description="ヘッダー・ログイン画面・メールに表示される名称"
          >
            <input
              type="text"
              value={settings.display.systemName}
              onChange={(e) => updateSetting('display', 'systemName', e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white w-48"
            />
          </SettingRow>

          <SettingRow
            label="JPY換算をデフォルト表示"
            description="ダッシュボード・データ閲覧で原通貨と並べて表示"
          >
            <Toggle
              checked={settings.display.defaultJpyConversion}
              onChange={(v) => updateSetting('display', 'defaultJpyConversion', v)}
            />
          </SettingRow>

          <SettingRow
            label="会計年度開始月"
            description="月次PL集計の年度区切り（日本標準は4月）"
          >
            <select
              value={settings.display.fiscalYearStartMonth}
              onChange={(e) => updateSetting('display', 'fiscalYearStartMonth', Number(e.target.value))}
              className="px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm bg-white appearance-none cursor-pointer w-32"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </SettingRow>
        </Section>

        {/* Help */}
        <div className="mt-8 px-1 text-xs leading-relaxed text-slate-500 space-y-1">
          <p>· 設定変更は保存後に即時反映されます。配信中の処理がある場合は次回から適用</p>
          <p>· Webhook URL等の機微情報は管理者のみ表示可能</p>
          <p>· 閾値変更時は、過去のアラート履歴は変更されません</p>
        </div>
      </main>

      {/* Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur-md z-30 anim-in">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-slate-900">未保存の変更があります</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardChanges}
                className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700"
              >
                破棄
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10"
              >
                <Save className="w-4 h-4" />
                変更を保存
              </button>
            </div>
          </div>
        </div>
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

      {/* Reset Confirm */}
      {resetConfirmOpen && (
        <ModalShell title="デフォルトに戻す" subtitle="Reset to Defaults" onClose={() => setResetConfirmOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                すべての設定がシステムデフォルト値にリセットされます。この操作は取り消せません。
              </div>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              影響範囲：日報配信時刻・アラート閾値・リマインダー・認証要件・Webhook URL を含むすべての設定
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">
              キャンセル
            </button>
            <button
              onClick={handleResetToDefaults}
              className="flex-1 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
            >
              デフォルトに戻す
            </button>
          </ModalFooter>
        </ModalShell>
      )}
    </div>
  );
}

// ==================== SUB COMPONENTS ====================
function Section({ number, title, icon: Icon, children, delay }) {
  return (
    <section className="mb-6 anim-in" style={{ animationDelay: delay }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-num text-[10px] font-bold tracking-widest text-slate-400">{number}</div>
        <div className="w-px h-4 bg-slate-200" />
        <Icon className="w-4 h-4 text-slate-700" />
        <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100 px-5 py-2">
          {children}
        </div>
      </div>
    </section>
  );
}

function SettingRow({ label, description, children, disabled, compact }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? 'py-3' : 'py-4'} ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 mb-0.5">{label}</div>
        <div className="text-xs text-slate-500 leading-relaxed">{description}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-slate-900' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function NumberInputWithUnit({ value, onChange, unit, min, max, step, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-right font-num font-medium disabled:opacity-50"
      />
      <span className="text-sm text-slate-600">{unit}</span>
    </div>
  );
}

function ModalShell({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl anim-in my-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
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
    <div className="px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 -mx-6 -mb-6 mt-6">
      {children}
    </div>
  );
}
