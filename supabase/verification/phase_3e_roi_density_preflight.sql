-- Read-only drift check for migration 010. Safe before or after applying it.
do $preflight$
declare
  applied boolean := exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261106000100'
  );
begin
  if to_regclass('public.cctv_locations') is null
     or to_regprocedure('private.can_manage_agency(uuid)') is null then
    raise exception 'ROI density prerequisites are missing';
  end if;

  if applied then
    if to_regclass('public.cctv_analysis_config') is null
       or not (select relrowsecurity from pg_class where oid = 'public.cctv_analysis_config'::regclass)
       or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cctv_analysis_config' and policyname = 'cctv_analysis_config_manager_insert') then
      raise exception 'Migration 010 history exists but ROI configuration security objects are incomplete';
    end if;
  elsif to_regclass('public.cctv_analysis_config') is not null
     or to_regprocedure('private.is_valid_roi_density_config(jsonb)') is not null then
    raise exception 'ROI density objects exist without migration 010 history; inspect schema drift manually';
  end if;
end
$preflight$;
