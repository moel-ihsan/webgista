do $preflight$
declare
  migration_applied boolean;
  config_relation oid := 'public.cctv_private_config'::regclass;
begin
  select exists (
    select 1 from supabase_migrations.schema_migrations where version = '20261105000300'
  ) into migration_applied;

  if not (select relrowsecurity from pg_class where oid = config_relation) then
    raise exception 'CCTV private configuration RLS is not enabled';
  end if;
  if has_table_privilege('anon', config_relation, 'SELECT')
    or has_table_privilege('anon', config_relation, 'INSERT') then
    raise exception 'Anonymous access to private CCTV configuration is granted';
  end if;
  if not has_table_privilege('authenticated', config_relation, 'SELECT') then
    raise exception 'Authenticated CCTV managers lack required configuration reads';
  end if;
  if migration_applied and not has_table_privilege('authenticated', config_relation, 'INSERT') then
    raise exception 'Migration 20261105000300 is recorded but its authenticated INSERT grant is missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cctv_private_config'
      and cmd = 'INSERT' and 'authenticated' = any(roles)
      and with_check ilike '%can_manage_agency%'
      and with_check ilike '%created_by%'
  ) then
    raise exception 'CCTV private configuration manager INSERT policy is missing or changed';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cctv_private_config'
      and cmd = 'SELECT' and 'authenticated' = any(roles)
      and qual ilike '%can_manage_agency%'
  ) then
    raise exception 'CCTV private configuration manager SELECT policy is missing or changed';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = config_relation and not tgisinternal
      and tgfoid = 'private.set_actor_columns()'::regprocedure
  ) then
    raise exception 'CCTV private configuration actor trigger is missing';
  end if;
end;
$preflight$;
