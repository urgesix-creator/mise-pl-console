-- ====================================================================
-- 031_protect_profile_fields.sql
-- profiles の自己更新による権限昇格を防止する
--
-- 背景（脆弱性）：
--   profiles の自己更新ポリシー（profiles_update_self）は USING/WITH CHECK が
--   id = auth.uid() のみで列を制限しない。このため一般ユーザーが自分の row の
--   role を 'executive' に書き換える等で権限昇格できてしまう（権限システムを無効化）。
--
-- 対策：
--   BEFORE UPDATE トリガーで、経営マスタ編集権限（exec_master）を持たない
--   「認証ユーザー本人」が role / is_active / country_id / email を変更しようとした
--   場合に拒否する。氏名(display_name)・言語(language)・accepted_at・last_login_at 等の
--   非特権列は本人でも変更可（プロフィール画面・ログイン記録のため）。
--
--   - auth.uid() が NULL（service_role/管理接続）の場合は信頼済みとして許可
--     （ユーザー管理の admin 経由操作や create_store 系と同方針）。
--   - exec_master 保有者（経営層・ユーザー管理画面の更新）は従来どおり変更可。
--
-- 影響：既存の正規フロー（氏名変更・last_login_at 記録・accepted_at 記録・
--   ユーザー管理からの role/状態変更＝exec_master）はすべて許可される。
-- 冪等性：CREATE OR REPLACE FUNCTION／DROP TRIGGER IF EXISTS→CREATE。データ非変更。
-- ====================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_capability('exec_master') THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.country_id IS DISTINCT FROM OLD.country_id
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'ロール・有効状態・担当国・メールアドレスは変更できません（権限がありません）';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON profiles;
CREATE TRIGGER trg_protect_profile_privileged
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();
