-- ====================================================================
-- 008_event_trigger_ensure_rls.sql
-- 新規 public テーブルへのRLS自動有効化トリガ（参考記録）
--
-- 【重要・本番DBに既に存在する。再構築時のための記録】
--   本ファイルは「本番DBに実在する」イベントトリガ ensure_rls と関数
--   rls_auto_enable() を、pg_get_functiondef / pg_event_trigger の実定義どおりに
--   記録したもの。これらはリポジトリのどのマイグレーション（001〜007）にも
--   定義が無かった後付けのDBオブジェクトで、本番DBには既に存在する。
--
--   目的：DBをゼロから再構築する場合に欠落しないよう実態を記録する。
--   ※ 本番DBには既に存在するため、本番への再適用は不要（適用しないこと）。
--      ゼロからの再構築時のみ実行する想定。
--
--   役割（各テーブルのRLSポリシー定義＝002 とは責務が異なるため分離）：
--     CREATE TABLE 等のDDL完了時（ddl_command_end）に発火し、
--     public スキーマに新規作成されたテーブルへ自動で RLS を有効化する。
--     ※ ポリシー自体は作らない（RLS有効化のみ）。
-- ====================================================================

-- --------------------------------------------------------------------
-- イベントトリガ関数（本番DB pg_get_functiondef 全文に一致）
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- --------------------------------------------------------------------
-- イベントトリガ本体
--   本番DB実定義：evtname=ensure_rls / evtevent=ddl_command_end /
--                 evtenabled=O（有効） / function=rls_auto_enable()
--   CREATE EVENT TRIGGER は IF NOT EXISTS 非対応のため、冪等化のため
--   DROP EVENT TRIGGER IF EXISTS を併用する。
-- --------------------------------------------------------------------
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  EXECUTE FUNCTION public.rls_auto_enable();
