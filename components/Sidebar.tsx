'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Store,
  Layers,
  Tag,
  Truck,
  LayoutGrid,
  ClipboardEdit,
  Target,
  CalendarRange,
  CalendarDays,
  Package,
  FileSearch,
  Users,
  Settings,
  ShieldCheck,
  ScrollText,
  KeyRound,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canOpenPath, isPurchasesOnly } from '@/lib/permissions/access';

type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
  /** この能力(capability)を持つユーザーのみ表示。未指定は全員表示 */
  capability?: string;
  /** いずれかの能力を持てば表示（capability より優先せず併用しない想定） */
  capabilityAny?: string[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: 'ホーム',
    items: [{ href: '/dashboard', label: 'ダッシュボード', icon: BarChart3 }],
  },
  {
    label: '業務',
    items: [
      // 各項目の capabilityAny は lib/permissions/access.ts の PAGE_ACCESS と一致させる。
      { href: '/daily-input/sales', label: '日次売上入力', icon: ClipboardEdit, capabilityAny: ['daily_input'] },
      {
        href: '/daily-input/purchases',
        label: '日次仕入入力',
        icon: ClipboardEdit,
        capabilityAny: ['daily_input', 'daily_purchase_input'],
      },
      { href: '/targets', label: '売上目標', icon: Target, capabilityAny: ['targets', 'daily_input'] },
      { href: '/pl', label: '月次PL（損益）', icon: BarChart3, capabilityAny: ['daily_input', 'all_store_access'] },
      {
        href: '/period-summary',
        label: '期間集計',
        icon: CalendarRange,
        capabilityAny: ['all_store_access', 'daily_input', 'targets'],
      },
      {
        href: '/daily-summary',
        label: '日別売上',
        icon: CalendarDays,
        capabilityAny: ['all_store_access', 'daily_input', 'targets'],
      },
      {
        href: '/purchase-summary',
        label: '仕入先別 仕入集計',
        icon: Package,
        capabilityAny: ['all_store_access', 'daily_input'],
      },
      { href: '/data', label: 'データ閲覧', icon: FileSearch, capabilityAny: ['all_store_access', 'daily_input'] },
    ],
  },
  {
    label: '管理',
    items: [
      // マスタ：能力で出し分け（PAGE_ACCESS と一致）
      { href: '/masters/stores', label: '店舗マスタ', icon: Store, capability: 'exec_master' },
      { href: '/masters/store-groups', label: '店舗グループ', icon: Layers, capability: 'exec_master' },
      { href: '/masters/categories', label: '仕入カテゴリ', icon: Tag, capability: 'store_master' },
      { href: '/masters/suppliers', label: '仕入先', icon: Truck, capability: 'store_master' },
      { href: '/masters/departments', label: '部門マスタ', icon: LayoutGrid, capability: 'store_master' },
      // 権限設定・ユーザー管理・監査ログ・APIキーは「システム設定」の中（管理メニュー）から開く。
      // システム設定は、いずれかの管理機能にアクセスできる人に表示。
      {
        href: '/admin/settings',
        label: 'システム設定',
        icon: Settings,
        capabilityAny: ['system_settings', 'exec_master', 'user_management', 'audit_log', 'api_keys'],
      },
      // 初期設定（Excel一括投入のハブ）は manage_initial_setup を持つ人に表示
      { href: '/admin/initial-setup', label: '初期設定', icon: Sparkles, capability: 'manage_initial_setup' },
    ],
  },
];

type SidebarProps = {
  userRole: Role;
  capabilities: string[];
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ userRole, capabilities, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  // 各項目は capability を持つユーザーにのみ表示（マスタ系は未指定＝全員）。空のセクションは出さない。
  const caps = new Set(capabilities);
  const purchasesOnly = isPurchasesOnly(caps);
  const itemVisible = (i: NavItem): boolean => {
    // 「仕入のみ」ユーザーは開けるページ（仕入入力のみ）だけリンクを出す。
    if (purchasesOnly) return canOpenPath(i.href, caps);
    if (i.capability) return caps.has(i.capability);
    if (i.capabilityAny) return i.capabilityAny.some((c) => caps.has(c));
    return true;
  };
  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(itemVisible),
  })).filter((s) => s.items.length > 0);

  const isItemActive = (href: string) => {
    if (pathname === href) return true;
    if (href !== '/dashboard' && pathname.startsWith(href + '/')) return true;
    return false;
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-[260px] bg-white border-r border-slate-200 overflow-y-auto transition-transform duration-200 ease-out print:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <nav className="p-4 space-y-6">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 px-3 mb-2">
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  if (item.disabled) {
                    return (
                      <li key={item.href}>
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 cursor-not-allowed select-none">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  }

                  const active = isItemActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          active
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100',
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-100">
            <div className="px-3 text-[10px] text-slate-400 leading-relaxed">
              みせPL
              <br />
              Phase B.1
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
