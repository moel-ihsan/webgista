do $$
declare
  migration_applied boolean;
  projection_oid oid;
  projection_options text[];
begin
  select exists (
    select 1 from supabase_migrations.schema_migrations where version = '20261106000300'
  ) into migration_applied;

  if to_regclass('public.cctv_private_config') is null then
    raise exception 'Required private CCTV configuration table is missing.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.cctv_private_config'::regclass) then
    raise exception 'CCTV private configuration RLS must remain enabled.';
  end if;
  if has_table_privilege('anon', 'public.cctv_private_config', 'SELECT') then
    raise exception 'Anonymous direct SELECT on private CCTV configuration is not allowed.';
  end if;
  if not has_table_privilege('authenticated', 'public.cctv_private_config', 'SELECT') then
    raise exception 'Authenticated managers must retain RLS-scoped CCTV configuration reads.';
  end if;

  projection_oid := to_regclass('public.public_cctv_demo_streams');
  if not migration_applied and projection_oid is not null then
    raise exception 'Public demo projection exists before its migration is recorded; investigate schema drift.';
  end if;
  if migration_applied and projection_oid is null then
    raise exception 'Migration 20261106000300 is recorded but its public projection is missing.';
  end if;

  if projection_oid is not null then
    select reloptions into projection_options from pg_class where oid = projection_oid;
    if (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'public_cctv_demo_streams') <> 2
       or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_cctv_demo_streams' and column_name = 'cctv_id')
       or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_cctv_demo_streams' and column_name = 'video_id') then
      raise exception 'Public demo projection must expose only CCTV ID and YouTube video ID.';
    end if;
    if not coalesce(projection_options @> array['security_barrier=true', 'security_invoker=false'], false) then
      raise exception 'Public demo projection must retain its reviewed security barrier and owner-scoped access.';
    end if;
    if not has_table_privilege('anon', 'public.public_cctv_demo_streams', 'SELECT')
       or has_table_privilege('anon', 'public.public_cctv_demo_streams', 'INSERT')
       or has_table_privilege('anon', 'public.public_cctv_demo_streams', 'UPDATE')
       or has_table_privilege('anon', 'public.public_cctv_demo_streams', 'DELETE') then
      raise exception 'Anonymous access to the demo projection must be SELECT-only.';
    end if;
  end if;
end
$$;
