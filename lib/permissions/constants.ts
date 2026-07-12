// ====================================================================
// 権限（能力×ロール）の定数（DB非依存・クライアント/サーバ共用）
//
//   能力(capability) と既定の許可ロールは role_permissions（030）の seed と一致。
//   実際の許可は role_permissions テーブルが正（ここは表示ラベル・既定値の参照用）。
// ====================================================================

export const ROLES = ['executive', 'country_rep', 'store_manager', 'staff', 'accounting'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  executive: '経営層',
  country_rep: '各国代表',
  store_manager: '店長',
  staff: '現場担当',
  accounting: '経理',
};

export const CAPABILITIES = [
  'exec_master',
  'accounting_master',
  'store_master',
  'targets',
  'daily_input',
  'daily_purchase_input',
  'all_store_access',
  'user_management',
  'api_keys',
  'audit_log',
  'system_settings',
  'manage_initial_setup',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, { title: string; desc: string }> = {
  exec_master: {
    title: '経営マスタ編集／権限設定',
    desc: '店舗・店舗グループ・国・通貨・権限設定',
  },
  accounting_master: { title: '経理マスタ編集', desc: '為替レート・経費カテゴリ' },
  store_master: { title: '店舗マスタ編集', desc: '仕入先・仕入カテゴリ・部門' },
  targets: { title: '売上目標 編集', desc: '日別の売上予算' },
  daily_input: {
    title: '日次・月次入力',
    desc: '売上・仕入・棚卸・営業日数・月次PL販管費',
  },
  daily_purchase_input: {
    title: '日次仕入入力のみ',
    desc: '日次仕入入力（＋概算棚卸）だけを行える。これだけを持つ人は他ページを開けない',
  },
  all_store_access: {
    title: '全店データ閲覧',
    desc: '全店舗のデータ閲覧（国/割当の範囲ロジックは別途固定）',
  },
  user_management: { title: 'ユーザー管理', desc: 'ユーザーの招待・ロール付与・店舗割当・有効/無効' },
  api_keys: { title: 'APIキー管理', desc: '外部連携用APIキーの発行・失効' },
  audit_log: { title: '監査ログ閲覧', desc: '操作履歴の閲覧' },
  system_settings: { title: 'システム設定', desc: 'Slack通知・為替レート自動取得 等' },
  manage_initial_setup: { title: '初期設定（一括投入）', desc: 'Excelで仕入先・予算・過去売上等を一括取込' },
};

/** 既定の許可ロール（role_permissions の seed と一致・参照/リセット用） */
export const DEFAULT_PERMISSIONS: Record<Capability, Role[]> = {
  exec_master: ['executive'],
  accounting_master: ['executive', 'accounting'],
  store_master: ['executive', 'country_rep', 'store_manager'],
  targets: ['executive', 'country_rep', 'store_manager'],
  daily_input: ['executive', 'country_rep', 'store_manager', 'staff'],
  daily_purchase_input: [],
  all_store_access: ['executive', 'accounting'],
  user_management: ['executive'],
  api_keys: ['executive'],
  audit_log: ['executive'],
  system_settings: ['executive'],
  manage_initial_setup: ['executive'],
};

/** 無効化できない組み合わせ（自分ロックアウト防止・DBトリガーと一致） */
export const LOCKED_PERMISSION: { capability: Capability; role: Role } = {
  capability: 'exec_master',
  role: 'executive',
};

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}
