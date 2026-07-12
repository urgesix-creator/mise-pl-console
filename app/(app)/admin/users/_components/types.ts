import type { Role } from '@/lib/permissions/constants';

export type UserRow = {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  country_id: string | null;
  is_active: boolean;
  invited_at: string | null;
  last_login_at: string | null;
  store_ids: string[];
};

export type StoreOption = {
  id: string;
  store_no: number;
  name: string;
};

export type CountryOption = {
  id: string;
  name: string;
  flag: string | null;
};
