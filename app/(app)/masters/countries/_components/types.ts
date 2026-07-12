import type { Database } from '@/types/database';

export type Country = Database['public']['Tables']['countries']['Row'];

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

/** 国マスタ行（使用状況メタ付き：この国を使う有効店舗数） */
export type CountryWithMeta = Country & {
  store_count: number;
};
