/**
 * Supabase Database Types
 * このファイルは手動で定義されたものです。
 * 本番ではSupabase CLIで自動生成することを推奨：
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      countries: {
        Row: {
          id: string;
          name: string;
          code: string;
          flag: string | null;
          tax_rate: number;
          tax_base: 'net_sales' | 'net_plus_service';
          tax_label: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['countries']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['countries']['Insert']>;
        Relationships: [];
      };
      currencies: {
        Row: {
          id: string;
          code: string;
          symbol: string;
          name: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['currencies']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['currencies']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          role: 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';
          country_id: string | null;
          is_active: boolean;
          has_2fa: boolean;
          invited_at: string | null;
          accepted_at: string | null;
          last_login_at: string | null;
          language: 'ja' | 'en' | 'th' | 'id';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at' | 'language'> & {
          created_at?: string;
          updated_at?: string;
          language?: 'ja' | 'en' | 'th' | 'id';
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          store_no: number;
          name: string;
          country_id: string;
          currency_id: string;
          timezone: string;
          service_fee_rate: number;
          employee_rebate_rate: number;
          fiscal_year_start_month: number;
          is_weather_enabled: boolean;
          is_event_enabled: boolean;
          is_active: boolean;
          established_date: string | null;
          display_order: number;
          purchase_tax_input_mode: 'excluded' | 'included'; // 仕入入力モード（税抜/税込・店舗単位で共有）
          purchase_tax_rate_default: number; // 店舗標準の仕入税率(%)。取引先未設定時の既定
          sales_service_fee_input_mode: 'excluded' | 'included'; // 売上入力モード（サービス料別/込み・店舗単位で共有・消費税制では未使用）
          has_takeout: boolean; // 軽減税率（テイクアウト8%）を使う店舗か。true のとき税区分セレクタを表示
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['stores']['Row'],
          | 'id'
          | 'store_no'
          | 'purchase_tax_input_mode'
          | 'purchase_tax_rate_default'
          | 'sales_service_fee_input_mode'
          | 'has_takeout'
          | 'created_at'
          | 'updated_at'
        > & {
          id?: string;
          store_no?: number; // 自動採番（createStore / create_store_with_copy RPC が決定）
          purchase_tax_input_mode?: 'excluded' | 'included'; // 既定 'excluded'
          purchase_tax_rate_default?: number; // 既定 0
          sales_service_fee_input_mode?: 'excluded' | 'included'; // 既定 'excluded'
          has_takeout?: boolean; // 既定 false
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['stores']['Insert']>;
        Relationships: [];
      };
      store_groups: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['store_groups']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['store_groups']['Insert']>;
        Relationships: [];
      };
      store_group_members: {
        Row: {
          id: string;
          group_id: string;
          store_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['store_group_members']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['store_group_members']['Insert']>;
        Relationships: [];
      };
      role_permissions: {
        Row: {
          capability: string;
          role: string;
          allowed: boolean;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['role_permissions']['Row'], 'updated_at'> & {
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          target_type: string | null;
          target_label: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          label: string;
          key_prefix: string;
          key_hash: string;
          scope: 'read' | 'read_write';
          is_active: boolean;
          created_by: string | null;
          last_used_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at' | 'last_used_at' | 'is_active'> & {
          id?: string;
          created_at?: string;
          last_used_at?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['api_keys']['Insert']>;
        Relationships: [];
      };
      user_store_assignments: {
        Row: {
          id: string;
          user_id: string;
          store_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_store_assignments']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_store_assignments']['Insert']>;
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          from_currency_id: string;
          to_currency_id: string;
          rate: number;
          effective_date: string;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['exchange_rates']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['exchange_rates']['Insert']>;
        Relationships: [];
      };
      purchase_categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['purchase_categories']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['purchase_categories']['Insert']>;
        Relationships: [];
      };
      sales_departments: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sales_departments']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sales_departments']['Insert']>;
        Relationships: [];
      };
      daily_department_sales: {
        Row: {
          id: string;
          store_id: string;
          business_date: string;
          department_id: string;
          gross_sales: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daily_department_sales']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_department_sales']['Insert']>;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          store_id: string;
          category_id: string;
          name: string;
          display_order: number;
          is_active: boolean;
          cost_type: 'cogs' | 'sga';
          tax_rate: number; // 仕入税率(%)。仕入のみに使用（売上§8.1には不使用）
          is_tax_exempt: boolean; // 非課税（true なら税率無視で tax=0・gross=net）
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['suppliers']['Row'],
          'id' | 'cost_type' | 'tax_rate' | 'is_tax_exempt' | 'created_at' | 'updated_at'
        > & {
          cost_type?: 'cogs' | 'sga'; // 既定 'cogs'
          tax_rate?: number; // 既定 0（店舗標準で backfill）
          is_tax_exempt?: boolean; // 既定 false
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
        Relationships: [];
      };
      daily_sales: {
        Row: {
          id: string;
          store_id: string;
          business_date: string;
          day_period: 'all' | 'lunch' | 'dinner';
          gross_sales: number;
          net_sales: number;
          service_fee: number;
          tax_amount: number;
          tax_category: 'standard' | 'reduced'; // 売上の税区分（standard=10% / reduced=8%）。既定 standard
          customer_count: number;
          weather: string | null;
          event_note: string | null;
          is_closed: boolean;
          is_holiday: boolean;
          holiday_name: string | null;
          service_fee_included: boolean; // この行の入力モード（true=サービス料込み）。既定false=従来「別」。消費税制では未使用
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['daily_sales']['Row'],
          'id' | 'tax_category' | 'is_closed' | 'is_holiday' | 'holiday_name' | 'service_fee_included' | 'created_at' | 'updated_at'
        > & {
          tax_category?: 'standard' | 'reduced'; // 既定 standard
          is_closed?: boolean;
          is_holiday?: boolean;
          holiday_name?: string | null;
          service_fee_included?: boolean; // 既定 false
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_sales']['Insert']>;
        Relationships: [];
      };
      daily_purchases: {
        Row: {
          id: string;
          store_id: string;
          supplier_id: string;
          business_date: string;
          amount: number; // 後方互換のため保持（常に net_amount と同値に同期）
          net_amount: number; // 税抜（PL原価の基準）
          tax_amount: number; // 税額（非課税は0）
          gross_amount: number; // 税込（net + tax）
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['daily_purchases']['Row'],
          'id' | 'net_amount' | 'tax_amount' | 'gross_amount' | 'created_at' | 'updated_at'
        > & {
          id?: string;
          net_amount?: number; // 既定 0（保存時に算出して設定）
          tax_amount?: number; // 既定 0
          gross_amount?: number; // 既定 0
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_purchases']['Insert']>;
        Relationships: [];
      };
      daily_targets: {
        Row: {
          id: string;
          store_id: string;
          target_date: string;
          target_sales: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daily_targets']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_targets']['Insert']>;
        Relationships: [];
      };
      monthly_business_days: {
        // 013 で追加。月次の営業日数（店舗×月・手入力）。year_month は月初DATE。
        Row: {
          id: string;
          store_id: string;
          year_month: string;
          business_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['monthly_business_days']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['monthly_business_days']['Insert']>;
        Relationships: [];
      };
      monthly_bank_balances: {
        // 040 で追加。月次の通帳残高（店舗×月・手入力・現地通貨）。year_month は月初DATE。
        // PL/税計算には使わない参考メモ。
        Row: {
          id: string;
          store_id: string;
          year_month: string;
          balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['monthly_bank_balances']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['monthly_bank_balances']['Insert']>;
        Relationships: [];
      };
      inventory_estimates: {
        // 011 で (store_id, business_date) をキーとする履歴テーブルへ再設計。
        Row: {
          id: string;
          store_id: string;
          business_date: string;
          amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_estimates']['Row'], 'id' | 'notes' | 'created_at' | 'updated_at'> & {
          id?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['inventory_estimates']['Insert']>;
        Relationships: [];
      };
      monthly_expenses: {
        // 015 で追加。月次販管費（店舗×月×科目）。account_name は自由text。
        // category_tag は labor/depreciation/other の3種。year_month は月初DATE。
        Row: {
          id: string;
          store_id: string;
          year_month: string;
          account_name: string;
          category_tag: 'labor' | 'rent' | 'depreciation' | 'other';
          amount: number;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['monthly_expenses']['Row'], 'id' | 'display_order' | 'created_at' | 'updated_at'> & {
          display_order?: number;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['monthly_expenses']['Insert']>;
        Relationships: [];
      };
      expense_formulas: {
        // 018 で追加。変動費の計算式科目（店舗×科目で1つ・全月共通）。
        // 金額は保存せず net_sales から都度計算。calc_type 4種＋離散パラメータ（率は小数）。
        Row: {
          id: string;
          store_id: string;
          account_name: string;
          category_tag: 'labor' | 'rent' | 'depreciation' | 'other';
          calc_type: 'percent' | 'tiered' | 'fixed' | 'fixed_plus_percent';
          rate1: number | null;
          rate2: number | null;
          threshold: number | null;
          fixed_amount: number | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expense_formulas']['Row'], 'id' | 'rate1' | 'rate2' | 'threshold' | 'fixed_amount' | 'display_order' | 'created_at' | 'updated_at'> & {
          rate1?: number | null;
          rate2?: number | null;
          threshold?: number | null;
          fixed_amount?: number | null;
          display_order?: number;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['expense_formulas']['Insert']>;
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: unknown; // JSONB
          description: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_settings']['Row'], 'updated_at'> & {
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      v_daily_sales_with_target: {
        Row: {
          sale_id: string;
          store_id: string;
          business_date: string;
          day_period: 'all' | 'lunch' | 'dinner';
          gross_sales: number;
          net_sales: number;
          customer_count: number;
          avg_per_customer: number;
          target_sales: number;
          achievement_pct: number | null;
          store_name: string;
          currency_id: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_store_with_copy: {
        Args: { payload: Json; source_store_id?: string | null };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
};

// ====================================================================
// Convenience Type Aliases
// ====================================================================

export type Country = Database['public']['Tables']['countries']['Row'];
export type Currency = Database['public']['Tables']['currencies']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];
export type UserStoreAssignment = Database['public']['Tables']['user_store_assignments']['Row'];
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row'];
export type PurchaseCategory = Database['public']['Tables']['purchase_categories']['Row'];
export type SalesDepartment = Database['public']['Tables']['sales_departments']['Row'];
export type DailyDepartmentSale = Database['public']['Tables']['daily_department_sales']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type DailySale = Database['public']['Tables']['daily_sales']['Row'];
export type DailyPurchase = Database['public']['Tables']['daily_purchases']['Row'];
export type DailyTarget = Database['public']['Tables']['daily_targets']['Row'];
export type InventoryEstimate = Database['public']['Tables']['inventory_estimates']['Row'];
export type SystemSetting = Database['public']['Tables']['system_settings']['Row'];

// ====================================================================
// Enum-like Types
// ====================================================================

export type UserRole = 'executive' | 'country_rep' | 'store_manager' | 'staff' | 'accounting';
export type DayPeriod = 'all' | 'lunch' | 'dinner';
export type TaxBase = 'net_sales' | 'net_plus_service';

// 販管費の上位分類は固定列挙から expense_categories マスタ（DB管理）へ移行済み。
// 旧 ExpenseLevel1 union 型は廃止（2026-06-01 migration: expense_categories_master）。

// ====================================================================
// Role Configuration
// ====================================================================

export const ROLE_LABELS: Record<UserRole, { label: string; sub: string; description: string }> = {
  executive: {
    label: '経営層',
    sub: 'Executive',
    description: '全店全機能アクセス、最高権限',
  },
  country_rep: {
    label: '各国代表',
    sub: 'Country Rep',
    description: '担当国の全店舗を管理',
  },
  store_manager: {
    label: '店舗店長',
    sub: 'Store Manager',
    description: '担当店舗の入力・管理',
  },
  staff: {
    label: '現場社員',
    sub: 'Staff',
    description: '担当店舗の入力のみ',
  },
  accounting: {
    label: '経理・税理士',
    sub: 'Accounting',
    description: '全店読取・出力（編集不可）',
  },
};
