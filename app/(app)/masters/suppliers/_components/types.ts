import type { Database } from '@/types/database';

export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type PurchaseCategory = Database['public']['Tables']['purchase_categories']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];

export type SupplierWithMeta = Supplier & {
  category_name: string;
  category_is_active: boolean;
  transaction_count: number;
};

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

// 登録ダイアログのカテゴリ選択に必要な最小情報。
// マスタの PurchaseCategory[] も、仕入入力画面のカテゴリ選択肢も構造的に代入可能。
export type SupplierCategoryOption = { id: string; name: string };
