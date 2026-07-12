import type { Database } from '@/types/database';

export type Store = Database['public']['Tables']['stores']['Row'];
export type Country = Database['public']['Tables']['countries']['Row'];
export type Currency = Database['public']['Tables']['currencies']['Row'];
