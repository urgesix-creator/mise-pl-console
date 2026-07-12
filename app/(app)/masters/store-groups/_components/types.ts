import type { Database } from '@/types/database';

export type StoreGroup = Database['public']['Tables']['store_groups']['Row'];

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

/** グループ管理画面で扱う店舗（選択肢・所属表示用） */
export type GroupStore = {
  id: string;
  store_no: number;
  name: string;
};

/** 一覧表示用：グループ＋所属店舗（有効メンバーのみ・store_no順） */
export type StoreGroupWithMembers = StoreGroup & {
  members: GroupStore[];
};
