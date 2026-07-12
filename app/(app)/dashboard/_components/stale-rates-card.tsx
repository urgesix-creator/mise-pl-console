import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { getStaleRates } from '@/app/(app)/masters/exchange-rates/actions';

export async function StaleRatesCard() {
  const staleRates = await getStaleRates();
  if (staleRates.length === 0) return null;

  return (
    <section className="anim-in anim-delay-200" aria-label="為替レート要更新">
      <div className="rounded-2xl border border-rose-300 bg-rose-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-rose-700 font-semibold mb-1">
              <span>Exchange Rate · Alert</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-rose-900 mb-1">
              為替レート要更新 {staleRates.length} 件
            </h2>
            <p className="text-xs text-rose-800 leading-relaxed mb-4">
              30 日以上更新されていないレートがあります。月末レートを更新してください。
            </p>

            <ul className="space-y-1.5 mb-4">
              {staleRates.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white border border-rose-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {r.from_code} → {r.to_code}
                    </span>
                    <span className="font-num text-xs text-slate-600 hidden sm:inline">
                      {r.effective_date}
                    </span>
                  </div>
                  <span className="font-num text-xs font-semibold text-rose-700 whitespace-nowrap">
                    {r.days_since_effective}日経過
                  </span>
                </li>
              ))}
              {staleRates.length > 5 && (
                <li className="text-[11px] text-rose-700 px-3">
                  他 {staleRates.length - 5} 件
                </li>
              )}
            </ul>

            <Link
              href="/masters/exchange-rates"
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 transition-colors"
            >
              レートマスタへ
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
