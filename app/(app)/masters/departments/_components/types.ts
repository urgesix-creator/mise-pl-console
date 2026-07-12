import type { Database } from '@/types/database';

export type SalesDepartment = Database['public']['Tables']['sales_departments']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';
