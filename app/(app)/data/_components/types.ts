import type { Database } from '@/types/database';

export type Store = Database['public']['Tables']['stores']['Row'];

export type Role = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';

/** 部門別売上 構成比集計の1行（部門単位） */
export type DepartmentSalesSummaryRow = {
  department_id: string;
  name: string;
  display_order: number;
  cumulative_gross: number; // 期間内の累計税込売上
  share_pct: number; // 部門内シェア（%）。合計100%
};

/** 部門別売上 構成比集計の結果（§8.8 準拠） */
export type DepartmentSalesSummary = {
  rows: DepartmentSalesSummaryRow[];
  total: number; // 全部門の累計合計（分母）
  hasData: boolean; // total > 0 かつ対象部門ありのとき true
};

/** 明細エクスポート用の1行（1日1部門の生データ） */
export type DepartmentSaleDetailRow = {
  business_date: string;
  department_id: string;
  name: string;
  display_order: number;
  gross_sales: number;
};
