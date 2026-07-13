// ====================================================================
// ページ単位のアクセス制御（純粋関数・middleware/サイドバー共用・next/headers非依存）
//
//   「権限のないページは開けない」を実現するための定義。
//   - PAGE_ACCESS：パス接頭辞ごとに「開くのに必要な能力（いずれか1つ）」。
//   - canOpenPath：ユーザーの能力集合でそのパスを開けるか判定。
//   - 「仕入のみ」（daily_purchase_input だけを持つ）ユーザーは仕入入力のみ。
//   既定で全員開けるのはホーム/プロフィール/マニュアルのみ。判定はあくまで「画面を開けるか」で、
//   表示データの範囲（店舗スコープ）と保存可否は従来どおり RLS が担保する。
// ====================================================================

/** パス接頭辞 → そのページを開くのに必要な能力（いずれか1つを持てば可） */
export const PAGE_ACCESS: { prefix: string; anyOf: string[] }[] = [
  { prefix: '/daily-input/sales', anyOf: ['daily_input'] },
  { prefix: '/daily-input/purchases', anyOf: ['daily_input', 'daily_purchase_input'] },
  { prefix: '/targets', anyOf: ['targets', 'daily_input'] },
  { prefix: '/pl', anyOf: ['daily_input', 'all_store_access'] },
  { prefix: '/period-summary', anyOf: ['all_store_access', 'daily_input', 'targets'] },
  { prefix: '/daily-summary', anyOf: ['all_store_access', 'daily_input', 'targets'] },
  { prefix: '/purchase-summary', anyOf: ['all_store_access', 'daily_input'] },
  { prefix: '/data', anyOf: ['all_store_access', 'daily_input'] },
  { prefix: '/masters/store-groups', anyOf: ['exec_master'] },
  { prefix: '/masters/stores', anyOf: ['exec_master'] },
  { prefix: '/masters/categories', anyOf: ['store_master'] },
  { prefix: '/masters/suppliers', anyOf: ['store_master'] },
  { prefix: '/masters/departments', anyOf: ['store_master'] },
  { prefix: '/admin/initial-setup', anyOf: ['manage_initial_setup'] },
  { prefix: '/admin/permissions', anyOf: ['exec_master'] },
  { prefix: '/admin/users', anyOf: ['user_management'] },
  { prefix: '/admin/audit', anyOf: ['audit_log'] },
  { prefix: '/admin/api-keys', anyOf: ['api_keys'] },
  {
    prefix: '/admin/settings',
    anyOf: ['system_settings', 'exec_master', 'user_management', 'audit_log', 'api_keys', 'manage_initial_setup'],
  },
];

/** 能力に関わらず常に開けるパス（ホーム・プロフィール・マニュアル） */
const ALWAYS_ALLOWED = ['/dashboard', '/profile', '/manuals'];

/** 「日次仕入入力のみ」ユーザー（その能力だけを持つ） */
export function isPurchasesOnly(caps: Set<string>): boolean {
  return caps.has('daily_purchase_input') && caps.size === 1;
}

/** 仕入のみユーザーの初期ランディング */
export const PURCHASES_ONLY_HOME = '/daily-input/purchases';

/** 指定パスを、その能力集合で開けるか判定する */
export function canOpenPath(pathname: string, caps: Set<string>): boolean {
  if (isPurchasesOnly(caps)) {
    return (
      pathname.startsWith('/daily-input/purchases') ||
      pathname.startsWith('/profile') ||
      pathname.startsWith('/manuals')
    );
  }
  if (ALWAYS_ALLOWED.some((p) => pathname.startsWith(p))) return true;
  const rule = PAGE_ACCESS.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return true; // 既知の業務/管理パスは全て定義済み。未定義は許可（ホーム等）
  return rule.anyOf.some((c) => caps.has(c));
}
