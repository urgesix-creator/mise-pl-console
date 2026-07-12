'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Bell, Menu, X } from 'lucide-react';
import { signOut } from '@/app/(auth)/actions';
import { Sidebar } from './Sidebar';

type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

const ROLE_LABELS: Record<Role, string> = {
  executive: '経営層',
  country_rep: '国責任者',
  store_manager: '店長',
  staff: '現場社員',
  accounting: '経理',
};

type AppShellProps = {
  children: React.ReactNode;
  profile: {
    display_name: string;
    email: string;
    role: Role;
  };
  capabilities: string[];
};

export function AppShell({ children, profile, capabilities }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initial =
    (profile.display_name && profile.display_name.charAt(0)) ||
    profile.email.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/70 sticky top-0 z-50 print:hidden">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 flex-shrink-0"
              aria-label="メニュー"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
              <Image
                src="/koga-group-logo.png"
                alt="KOGA Group"
                width={840}
                height={600}
                className="h-9 w-auto flex-shrink-0"
                priority
              />
              <div className="hidden sm:block min-w-0">
                <div className="font-display text-sm font-bold text-slate-900 leading-tight truncate">
                  KOGA Holdings
                </div>
                <div className="text-[10px] tracking-widest uppercase text-slate-500">
                  Sales Console
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center text-slate-600"
              aria-label="通知"
            >
              <Bell className="w-4 h-4" />
            </button>

            <Link
              href="/profile"
              className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 hover:opacity-80 transition-opacity"
              title="プロフィール"
            >
              <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-display text-sm font-bold flex-shrink-0">
                {initial}
              </div>
              <div className="hidden md:block leading-tight min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {profile.display_name}
                </div>
                <div className="text-[11px] text-slate-500">{roleLabel}</div>
              </div>
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <Sidebar
          userRole={profile.role}
          capabilities={capabilities}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
