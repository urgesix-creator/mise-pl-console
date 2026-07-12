export type StoreOption = {
  id: string;
  store_no: number;
  name: string;
  currency_id: string;
  fiscal_year_start_month: number;
};

export type PurchaseRow = {
  supplierId: string;
  supplierName: string;
  categoryName: string;
  categoryOrder: number;
  costType: 'cogs' | 'sga';
  isActive: boolean;
  displayOrder: number;
  /** 12ヶ月の仕入額（会計年度の月順） */
  monthly: number[];
  yearTotal: number;
};

export type PurchaseGroup = {
  costType: 'cogs' | 'sga';
  rows: PurchaseRow[];
  monthlySubtotal: number[];
  yearSubtotal: number;
};
