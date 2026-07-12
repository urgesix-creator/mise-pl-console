import type { Database } from '@/types/database';

export type Currency = Database['public']['Tables']['currencies']['Row'];
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

/**
 * 表示用の通貨ペア（既存レート + メタ情報、未設定の場合は rate=null）
 * is_active=null は「未設定（DBにレコードなし）」を示す。
 */
export type RatePairWithMeta = {
  from_currency: Currency;
  to_currency: Currency;
  rate: number | null;
  effective_date: string | null;
  notes: string | null;
  rate_id: string | null;
  days_since_effective: number | null;
  is_stale: boolean;
  is_in_use_by_store: boolean;
  is_active: boolean | null;
};

/**
 * 通貨マスタの行データ（使用状況メタ付き）
 */
export type CurrencyWithMeta = Currency & {
  is_used_as_store_currency: boolean;
  rate_pair_count: number;
};
