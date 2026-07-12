import type { Database } from '@/types/database';

export type PurchaseCategory = Database['public']['Tables']['purchase_categories']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];

export type CategoryWithSupplierCount = PurchaseCategory & {
  supplier_count: number;
};

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';
