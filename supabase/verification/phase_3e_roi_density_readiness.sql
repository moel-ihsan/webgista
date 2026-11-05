-- Read-only post-deployment contract check for private ROI settings.
do $readiness$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261106000100') then
    raise exception 'Migration 010 is missing from remote migration history';
  end if;
  if to_regclass('public.cctv_analysis_config') is null
     or not (select relrowsecurity from pg_class where oid = 'public.cctv_analysis_config'::regclass)
     or not has_column_privilege('authenticated', 'public.cctv_analysis_config', 'configuration', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.cctv_analysis_config', 'configuration', 'INSERT')
     or has_table_privilege('anon', 'public.cctv_analysis_config', 'SELECT')
     or has_column_privilege('authenticated', 'public.cctv_analysis_config', 'created_by', 'INSERT')
     or has_column_privilege('authenticated', 'public.cctv_analysis_config', 'configuration_version', 'UPDATE') then
    raise exception 'ROI configuration privileges or RLS do not match the reviewed contract';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cctv_analysis_config' and policyname = 'cctv_analysis_config_manager_select')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cctv_analysis_config' and policyname = 'cctv_analysis_config_manager_insert')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cctv_analysis_config' and policyname = 'cctv_analysis_config_manager_update') then
    raise exception 'ROI configuration manager policies are incomplete';
  end if;
  if (select prosecdef from pg_proc where oid = 'private.is_valid_roi_density_config(jsonb)'::regprocedure)
     or not has_function_privilege('authenticated', 'private.is_valid_roi_density_config(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'private.is_valid_roi_density_config(jsonb)', 'EXECUTE') then
    raise exception 'ROI configuration validator privileges do not match the reviewed contract';
  end if;
end
$readiness$;
