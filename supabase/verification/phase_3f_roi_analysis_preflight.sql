-- Read-only deployment contract for Phase 3F. Run after migrations, before apply and after approval.
do $preflight$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261106000100') then
    raise exception 'ROI configuration migration 010 is not present';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261106000200') then
    raise exception 'ROI analysis results migration 011 is not present';
  end if;
  if to_regclass('public.cctv_roi_analysis_jobs') is null or to_regclass('public.cctv_roi_analysis_results') is null then
    raise exception 'ROI analysis job/result tables are missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.cctv_roi_analysis_jobs'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.cctv_roi_analysis_results'::regclass)
     or has_table_privilege('anon', 'public.cctv_roi_analysis_jobs', 'SELECT')
     or has_table_privilege('anon', 'public.cctv_roi_analysis_results', 'SELECT')
     or has_table_privilege('authenticated', 'public.cctv_roi_analysis_jobs', 'INSERT')
     or has_table_privilege('authenticated', 'public.cctv_roi_analysis_jobs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.cctv_roi_analysis_jobs', 'DELETE')
     or has_table_privilege('authenticated', 'public.cctv_roi_analysis_results', 'INSERT')
     or has_table_privilege('authenticated', 'public.cctv_roi_analysis_results', 'UPDATE')
     or has_table_privilege('authenticated', 'public.cctv_roi_analysis_results', 'DELETE')
     or not has_table_privilege('authenticated', 'public.cctv_roi_analysis_jobs', 'SELECT')
     or not has_table_privilege('authenticated', 'public.cctv_roi_analysis_results', 'SELECT')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_jobs', 'INSERT')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_jobs', 'UPDATE')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_jobs', 'DELETE')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_jobs', 'SELECT')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_results', 'INSERT')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_results', 'UPDATE')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_results', 'DELETE')
     or not has_table_privilege('service_role', 'public.cctv_roi_analysis_results', 'SELECT') then
    raise exception 'ROI analysis RLS/ACL does not match the reviewed contract';
  end if;
  if not has_function_privilege('service_role', 'public.complete_cctv_roi_analysis_job(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.complete_cctv_roi_analysis_job(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.complete_cctv_roi_analysis_job(uuid,jsonb)', 'EXECUTE') then
    raise exception 'ROI result publication privileges are unsafe';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cctv_roi_analysis_jobs' and policyname = 'cctv_roi_analysis_jobs_manager_read')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cctv_roi_analysis_results' and policyname = 'cctv_roi_analysis_results_manager_read')
     or not exists (select 1 from pg_trigger where tgname = 'cctv_analysis_config_supersede_jobs' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'cctv_private_config_supersede_roi_jobs' and not tgisinternal) then
    raise exception 'ROI result access or invalidation policies are incomplete';
  end if;
  if not coalesce(array_to_string((select proconfig from pg_proc where oid = 'private.supersede_stale_roi_jobs()'::regprocedure), ',') like '%search_path=%', false)
     or not coalesce(array_to_string((select proconfig from pg_proc where oid = 'private.supersede_roi_jobs_on_video_change()'::regprocedure), ',') like '%search_path=%', false)
     or not coalesce(array_to_string((select proconfig from pg_proc where oid = 'public.complete_cctv_roi_analysis_job(uuid,jsonb)'::regprocedure), ',') like '%search_path=%', false)
     or not (select prosecdef from pg_proc where oid = 'private.supersede_stale_roi_jobs()'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'private.supersede_roi_jobs_on_video_change()'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'public.complete_cctv_roi_analysis_job(uuid,jsonb)'::regprocedure)
     or has_function_privilege('anon', 'private.supersede_stale_roi_jobs()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.supersede_stale_roi_jobs()', 'EXECUTE')
     or has_function_privilege('anon', 'private.supersede_roi_jobs_on_video_change()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.supersede_roi_jobs_on_video_change()', 'EXECUTE') then
    raise exception 'ROI invalidation triggers do not use fixed search paths';
  end if;
  if not exists (
       select 1 from pg_constraint
       where conrelid = 'public.cctv_roi_analysis_jobs'::regclass
         and confrelid = 'public.cctv_locations'::regclass and contype = 'f' and confdeltype = 'c'
     )
     or not exists (
       select 1 from pg_constraint
       where conrelid = 'public.cctv_roi_analysis_results'::regclass
         and confrelid = 'public.cctv_roi_analysis_jobs'::regclass and contype = 'f' and confdeltype = 'c'
     )
     or not exists (
       select 1 from pg_constraint
       where conrelid = 'public.traffic_observations'::regclass
         and confrelid = 'public.cctv_locations'::regclass and contype = 'f' and confdeltype = 'r'
     ) then
    raise exception 'ROI job cleanup or protected observation foreign-key behavior changed';
  end if;
end
$preflight$;
