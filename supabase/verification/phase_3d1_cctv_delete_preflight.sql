begin read only;

do $$
declare
  config_delete_action "char";
  analysis_config_delete_action "char";
  roi_jobs_delete_action "char";
  roi_results_delete_action "char";
  observations_delete_action "char";
  referencing_table_count integer;
  expected_referencing_table_count integer;
  analysis_config_exists boolean := to_regclass('public.cctv_analysis_config') is not null;
  roi_jobs_exist boolean := to_regclass('public.cctv_roi_analysis_jobs') is not null;
  roi_results_exist boolean := to_regclass('public.cctv_roi_analysis_results') is not null;
  image_bucket_private boolean;
  delete_policy text;
  delete_function oid := to_regprocedure('public.delete_cctv_permanently(uuid,bigint)');
begin
  select constraints.confdeltype into config_delete_action
  from pg_catalog.pg_constraint as constraints
  where constraints.contype = 'f'
    and constraints.conrelid = 'public.cctv_private_config'::regclass
    and constraints.confrelid = 'public.cctv_locations'::regclass;
  select constraints.confdeltype into observations_delete_action
  from pg_catalog.pg_constraint as constraints
  where constraints.contype = 'f'
    and constraints.conrelid = 'public.traffic_observations'::regclass
    and constraints.confrelid = 'public.cctv_locations'::regclass;
  if to_regclass('public.cctv_analysis_config') is not null then
    select constraints.confdeltype into analysis_config_delete_action
    from pg_catalog.pg_constraint as constraints
    where constraints.contype = 'f'
      and constraints.conrelid = 'public.cctv_analysis_config'::regclass
      and constraints.confrelid = 'public.cctv_locations'::regclass;
  end if;
  if to_regclass('public.cctv_roi_analysis_jobs') is not null then
    select constraints.confdeltype into roi_jobs_delete_action
    from pg_catalog.pg_constraint as constraints
    where constraints.contype = 'f'
      and constraints.conrelid = 'public.cctv_roi_analysis_jobs'::regclass
      and constraints.confrelid = 'public.cctv_locations'::regclass;
  end if;
  if to_regclass('public.cctv_roi_analysis_results') is not null then
    select constraints.confdeltype into roi_results_delete_action
    from pg_catalog.pg_constraint as constraints
    where constraints.contype = 'f'
      and constraints.conrelid = 'public.cctv_roi_analysis_results'::regclass
      and constraints.confrelid = 'public.cctv_roi_analysis_jobs'::regclass;
  end if;
  select count(*) into referencing_table_count
  from pg_catalog.pg_constraint as constraints
  where constraints.contype = 'f' and constraints.confrelid = 'public.cctv_locations'::regclass;
  select not buckets.public into image_bucket_private
  from storage.buckets as buckets where buckets.id = 'cctv-images';
  select policies.qual into delete_policy
  from pg_catalog.pg_policies as policies
  where policies.schemaname = 'storage' and policies.tablename = 'objects'
    and policies.policyname = 'cctv_images_delete_managed' and policies.cmd = 'DELETE';
  expected_referencing_table_count := 2
    + analysis_config_exists::integer
    + roi_jobs_exist::integer;

  if config_delete_action is distinct from 'c' then
    raise exception 'private CCTV configuration must remain ON DELETE CASCADE';
  end if;
  if observations_delete_action is distinct from 'r' then
    raise exception 'traffic observations must remain ON DELETE RESTRICT';
  end if;
  if referencing_table_count <> expected_referencing_table_count then
    raise exception 'unexpected CCTV dependencies found: % referencing tables', referencing_table_count;
  end if;
  if analysis_config_exists and analysis_config_delete_action is distinct from 'c' then
    raise exception 'ROI analysis configuration must be removed with its CCTV record';
  end if;
  if roi_jobs_exist is distinct from roi_results_exist then
    raise exception 'ROI analysis jobs and results must be installed together';
  end if;
  if roi_jobs_exist and roi_jobs_delete_action is distinct from 'c' then
    raise exception 'ROI analysis jobs must be removed with their CCTV record';
  end if;
  if roi_results_exist and roi_results_delete_action is distinct from 'c' then
    raise exception 'ROI analysis results must be removed with their job';
  end if;
  if image_bucket_private is distinct from true then
    raise exception 'CCTV image bucket is missing or public';
  end if;
  if delete_policy is null or delete_policy not ilike '%can_manage_agency%' then
    raise exception 'managed image cleanup policy is missing or does not enforce agency authorization';
  end if;

  if delete_function is null then
    if delete_policy ilike '%snapshot_path%' then
      raise exception 'CCTV cleanup policy changed without the permanent-delete RPC migration';
    end if;
    if not has_table_privilege('authenticated', 'public.cctv_locations', 'DELETE') then
      raise exception 'pre-migration direct CCTV DELETE privilege is unexpectedly absent';
    end if;
  else
    if not (select procedures.prosecdef from pg_catalog.pg_proc as procedures where procedures.oid = delete_function)
        or coalesce((select array_to_string(procedures.proconfig, ',') from pg_catalog.pg_proc as procedures where procedures.oid = delete_function), '') not like '%search_path=%'
        or delete_policy not ilike '%snapshot_path%'
        or has_table_privilege('authenticated', 'public.cctv_locations', 'DELETE')
        or not has_function_privilege('authenticated', delete_function, 'EXECUTE')
        or has_function_privilege('anon', delete_function, 'EXECUTE') then
      raise exception 'permanent-delete RPC privileges or security properties are inconsistent';
    end if;
  end if;
end
$$;

select 'phase3d1_cctv_delete_preflight_ready' as status;
commit;
