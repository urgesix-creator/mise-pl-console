-- ====================================================================
-- 030_role_permissions.sql
-- ロール別の権限を「設定テーブル」で可変にする（現状＝既定）
--
-- 目的：
--   これまでコード/RLSに直書きしていた「ロール×できること」を、設定テーブル
--   role_permissions に外出しし、管理画面から変更できるようにする。
--   既定 seed は現状の挙動と完全一致させる（このマイグレーションでは挙動を変えない）。
--
-- 能力（capability）と既定ロール：
--   exec_master       経営マスタ編集（店舗/店舗グループ/国/通貨/システム設定/ユーザー）：executive
--   accounting_master 経理マスタ編集（為替レート）                         ：executive, accounting
--   store_master      店舗マスタ編集（仕入先/カテゴリ/部門）                ：executive, country_rep, store_manager
--   targets           売上目標 編集                                        ：executive, country_rep, store_manager
--   daily_input       日次・月次入力（売上/仕入/棚卸/営業日数/月次PL販管費）：executive, country_rep, store_manager, staff
--   all_store_access  全店データ閲覧（別軸・国/割当ロジックは固定）          ：executive, accounting
--
-- 仕組み：
--   - has_capability(cap) が role_permissions を参照（現ユーザーのロール×capで判定）。
--   - 既存ヘルパーを has_capability ベースへ差し替え：
--       can_write()    = has_capability('daily_input')      → 7ポリシー無修正
--       is_executive() = has_capability('exec_master')      → exec系9ポリシー無修正
--       can_access_store() の全店アクセス枝 → has_capability('all_store_access')
--   - 配列直書きの5ポリシー（為替/目標/仕入先/カテゴリ/部門）のみ has_capability へ再emit。
--
-- 安全策：
--   - executive の exec_master は無効化不可（トリガーで拒否）＝自分ロックアウト防止。
--   - role_permissions の DELETE は付与しない（行はUPSERT/UPDATEのみ）。
--
-- 影響：挙動は seed により現状と一致。実績データ・税計算には触れない。物理削除なし。
-- 冪等性：IF NOT EXISTS／CREATE OR REPLACE／DROP POLICY IF EXISTS→CREATE。
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. role_permissions テーブル＋既定 seed
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  capability TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('executive','country_rep','store_manager','staff','accounting')),
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (capability, role)
);

COMMENT ON TABLE role_permissions IS 'ロール×能力(capability)の許可設定。RLSヘルパー has_capability が参照。既定は従来挙動と一致。管理画面（権限設定・executive限定）で変更。';

-- 既定 seed（現状の直書きと一致）。再適用時は ON CONFLICT で既存値を尊重（上書きしない）。
INSERT INTO role_permissions (capability, role, allowed) VALUES
  ('exec_master','executive',true),
  ('exec_master','country_rep',false),
  ('exec_master','store_manager',false),
  ('exec_master','staff',false),
  ('exec_master','accounting',false),

  ('accounting_master','executive',true),
  ('accounting_master','country_rep',false),
  ('accounting_master','store_manager',false),
  ('accounting_master','staff',false),
  ('accounting_master','accounting',true),

  ('store_master','executive',true),
  ('store_master','country_rep',true),
  ('store_master','store_manager',true),
  ('store_master','staff',false),
  ('store_master','accounting',false),

  ('targets','executive',true),
  ('targets','country_rep',true),
  ('targets','store_manager',true),
  ('targets','staff',false),
  ('targets','accounting',false),

  ('daily_input','executive',true),
  ('daily_input','country_rep',true),
  ('daily_input','store_manager',true),
  ('daily_input','staff',true),
  ('daily_input','accounting',false),

  ('all_store_access','executive',true),
  ('all_store_access','country_rep',false),
  ('all_store_access','store_manager',false),
  ('all_store_access','staff',false),
  ('all_store_access','accounting',true)
ON CONFLICT (capability, role) DO NOTHING;

-- updated_at 自動更新
DROP TRIGGER IF EXISTS trg_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 安全策：executive の exec_master を無効化させない（自分ロックアウト防止）
CREATE OR REPLACE FUNCTION public.protect_exec_master()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.capability = 'exec_master' AND NEW.role = 'executive' AND NEW.allowed = FALSE THEN
    RAISE EXCEPTION 'executive の経営マスタ権限（exec_master）は無効化できません';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_exec_master ON role_permissions;
CREATE TRIGGER trg_protect_exec_master
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_exec_master();

-- --------------------------------------------------------------------
-- 2. has_capability：現ユーザーのロール×capで許可判定
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_capability(cap text)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.capability = cap
      AND rp.role = public.current_user_role()
      AND rp.allowed = TRUE
  );
$function$;

-- --------------------------------------------------------------------
-- 3. 既存ヘルパーを has_capability ベースへ（呼び出し側ポリシーは無修正で反映）
-- --------------------------------------------------------------------
-- 日次・月次入力（旧：role IN exec/rep/mgr/staff）
CREATE OR REPLACE FUNCTION public.can_write()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT public.has_capability('daily_input');
$function$;

-- 経営マスタ編集（旧：role = 'executive'）。現状の全 is_executive() 呼び出しは
-- すべて「経営マスタ編集」ゲートのため exec_master と意味的に一致。
CREATE OR REPLACE FUNCTION public.is_executive()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT public.has_capability('exec_master');
$function$;

-- 店舗アクセス：全店アクセス枝のみ all_store_access へ。国/割当ロジックは維持。
CREATE OR REPLACE FUNCTION public.can_access_store(p_store_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND (
        -- 全店アクセスを持つロール（既定：executive, accounting）
        public.has_capability('all_store_access')
        -- 各国代表は担当国の店舗
        OR (p.role = 'country_rep' AND EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = p_store_id AND s.country_id = p.country_id
        ))
        -- 店長・現場社員は割当店舗のみ
        OR EXISTS (
          SELECT 1 FROM public.user_store_assignments usa
          WHERE usa.user_id = p.id AND usa.store_id = p_store_id
        )
      )
  );
$function$;

-- --------------------------------------------------------------------
-- 4. 配列直書きの5ポリシーを has_capability へ再emit（意味は現状と一致）
-- --------------------------------------------------------------------
-- 経理マスタ：為替レート（旧：role IN exec/accounting）
DROP POLICY IF EXISTS "exchange_rates_write_admin" ON exchange_rates;
CREATE POLICY "exchange_rates_write_admin" ON exchange_rates
  FOR ALL TO authenticated
  USING (has_capability('accounting_master'))
  WITH CHECK (has_capability('accounting_master'));

-- 売上目標（旧：role IN exec/rep/mgr AND can_access_store）
DROP POLICY IF EXISTS "daily_targets_write" ON daily_targets;
CREATE POLICY "daily_targets_write" ON daily_targets
  FOR ALL TO authenticated
  USING (has_capability('targets') AND can_access_store(store_id))
  WITH CHECK (has_capability('targets') AND can_access_store(store_id));

-- 店舗マスタ：仕入先
DROP POLICY IF EXISTS "suppliers_write" ON suppliers;
CREATE POLICY "suppliers_write" ON suppliers
  FOR ALL TO authenticated
  USING (has_capability('store_master') AND can_access_store(store_id))
  WITH CHECK (has_capability('store_master') AND can_access_store(store_id));

-- 店舗マスタ：仕入カテゴリ
DROP POLICY IF EXISTS "purchase_categories_write" ON purchase_categories;
CREATE POLICY "purchase_categories_write" ON purchase_categories
  FOR ALL TO authenticated
  USING (has_capability('store_master') AND can_access_store(store_id))
  WITH CHECK (has_capability('store_master') AND can_access_store(store_id));

-- 店舗マスタ：部門
DROP POLICY IF EXISTS "sales_departments_write" ON sales_departments;
CREATE POLICY "sales_departments_write" ON sales_departments
  FOR ALL TO authenticated
  USING (has_capability('store_master') AND can_access_store(store_id))
  WITH CHECK (has_capability('store_master') AND can_access_store(store_id));

-- --------------------------------------------------------------------
-- 5. RLS／GRANT（role_permissions）
-- --------------------------------------------------------------------
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_read_authenticated" ON role_permissions;
CREATE POLICY "role_permissions_read_authenticated" ON role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions_write_exec" ON role_permissions;
CREATE POLICY "role_permissions_write_exec" ON role_permissions
  FOR UPDATE TO authenticated
  USING (has_capability('exec_master'))
  WITH CHECK (has_capability('exec_master'));

DROP POLICY IF EXISTS "role_permissions_insert_exec" ON role_permissions;
CREATE POLICY "role_permissions_insert_exec" ON role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (has_capability('exec_master'));

GRANT SELECT, INSERT, UPDATE ON role_permissions TO authenticated;
GRANT ALL ON role_permissions TO service_role;
