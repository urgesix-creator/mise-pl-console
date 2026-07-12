import { AlertTriangle } from 'lucide-react';
import type { RatePairWithMeta } from './types';

type StaleRateWarningBannerProps = {
  staleRates: RatePairWithMeta[];
};

export function StaleRateWarningBanner({ staleRates }: StaleRateWarningBannerProps) {
  if (staleRates.length === 0) return null;

  const summary = staleRates
    .slice(0, 5)
    .map(
      (p) =>
        `${p.from_currency.code}→${p.to_currency.code} (${p.days_since_effective}日経過)`,
    )
    .join(', ');

  const more = staleRates.length > 5 ? ` 他 ${staleRates.length - 5} 件` : '';

  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3.5 flex items-start gap-3 anim-in"
    >
      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-rose-900 mb-1">
          要更新 {staleRates.length} 件
        </div>
        <div className="text-xs text-rose-800 leading-relaxed break-words">
          {summary}
          {more}
        </div>
        <div className="text-[11px] text-rose-700 mt-1.5">
          30 日以上更新されていない為替レートがあります。月末レートを更新してください。
        </div>
      </div>
    </div>
  );
}
