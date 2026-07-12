'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Store as StoreIcon, Calendar as CalendarIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AccessibleStore } from '../actions';

type StoreDateSelectorProps = {
  stores: AccessibleStore[];
  selectedStoreId: string | null;
  selectedDate: string;
};

export function StoreDateSelector({
  stores,
  selectedStoreId,
  selectedDate,
}: StoreDateSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="store-select" className="text-xs text-slate-600">
          <StoreIcon className="w-3 h-3 inline mr-1" />
          店舗
        </Label>
        <Select
          value={selectedStoreId ?? ''}
          onValueChange={(v) => updateParam('store', v)}
        >
          <SelectTrigger id="store-select">
            <SelectValue placeholder="店舗を選択..." />
          </SelectTrigger>
          <SelectContent>
            {stores.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                アクセス可能な店舗がありません
              </div>
            ) : (
              stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.country_id.toUpperCase()} · {s.currency_id.toUpperCase()})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business-date" className="text-xs text-slate-600">
          <CalendarIcon className="w-3 h-3 inline mr-1" />
          営業日
        </Label>
        <Input
          id="business-date"
          type="date"
          value={selectedDate}
          onChange={(e) => updateParam('date', e.target.value)}
          className="font-num"
        />
      </div>
    </div>
  );
}
