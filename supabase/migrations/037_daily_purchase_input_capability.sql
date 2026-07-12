-- ====================================================================
-- 037_daily_purchase_input_capability.sql
-- 「日次仕入入力のみ」の能力 daily_purchase_input を追加
--
-- 目的：
--   日次仕入入力（＋概算棚卸）だけを行える権限を新設する。daily_input（売上含む
--   全入力）を持たなくても、この能力があれば仕入入力の保存ができる。
--   この能力だけを持つロールのユーザーは、アプリ側で仕入入力以外の画面を開けない
--   よう制御する（厳格アクセス制御は middleware で実装）。
--
-- 設計：
--   - role_permissions に daily_purchase_input を seed（既定は全ロール false＝
--     権限設定で任意に付与）。経営層は daily_input を持つため付与不要。
--   - 仕入の書込判定ヘルパー can_write_purchases() = daily_input OR daily_purchase_input。
--     daily_purchases / inventory_estimates の書込ポリシーをこれに付け替える
--     （daily_input 保有者の挙動は不変。新能力でも書けるようになるだけ）。
--   - 売上(daily_sales)・販管費(daily_expenses)等の他の書込は can_write()（daily_input）の
--     ままで一切変更しない。
--
-- 冪等性：ON CONFLICT DO NOTHING／CREATE OR REPLACE／DROP POLICY IF EXISTS→CREATE。
-- ====================================================================

-- 1. 能力 seed（既定 false）
INSERT INTO role_permissions (capability, role, allowed) VALUES
  ('daily_purchase_input','executive',false),
  ('daily_purchase_input','country_rep',false),
  ('daily_purchase_input','store_manager',false),
  ('daily_purchase_input','staff',false),
  ('daily_purchase_input','accounting',false)
ON CONFLICT (capability, role) DO NOTHING;

-- 2. 仕入書込ヘルパー：daily_input または daily_purchase_input
CREATE OR REPLACE FUNCTION public.can_write_purchases()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT public.has_capability('daily_input') OR public.has_capability('daily_purchase_input');
$function$;

-- 3. 仕入・棚卸の書込ポリシーを can_write_purchases へ付け替え（読取は従来どおり）
DROP POLICY IF EXISTS "daily_purchases_write" ON daily_purchases;
CREATE POLICY "daily_purchases_write" ON daily_purchases
  FOR ALL TO authenticated
  USING (can_write_purchases() AND can_access_store(store_id))
  WITH CHECK (can_write_purchases() AND can_access_store(store_id));

DROP POLICY IF EXISTS "inventory_estimates_write" ON inventory_estimates;
CREATE POLICY "inventory_estimates_write" ON inventory_estimates
  FOR ALL TO authenticated
  USING (can_write_purchases() AND can_access_store(store_id))
  WITH CHECK (can_write_purchases() AND can_access_store(store_id));
