'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

type TargetsTab = 'calendar' | 'excel';

export function TargetsTabBar({ active }: { active: TargetsTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setTab = (tab: TargetsTab) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const tabs: { key: TargetsTab; label: string; icon: typeof CalendarDays }[] = [
    { key: 'calendar', label: 'カレンダー入力', icon: CalendarDays },
    { key: 'excel', label: 'Excel一括', icon: FileSpreadsheet },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 mb-6">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
