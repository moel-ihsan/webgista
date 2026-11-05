select jsonb_pretty(jsonb_build_object(
  'phase_2e_observation_security', jsonb_build_object(
    'migration_005_applied', exists (
      select 1 from supabase_migrations.schema_migrations where version = '20261105000100'
    ),
    'condition_column_present', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'traffic_observations'
        and column_name = 'condition' and udt_name = 'traffic_condition'
    ),
    'latest_view_security_invoker', exists (
      select 1 from pg_class
      where oid = to_regclass('public.latest_traffic_observations')
        and 'security_invoker=true' = any(coalesce(reloptions, '{}'::text[]))
    ),
    'authenticated_latest_view_select', coalesce((
      select has_table_privilege('authenticated', oid, 'SELECT')
      from pg_class where oid = to_regclass('public.latest_traffic_observations')
    ), false),
    'anonymous_latest_view_select', coalesce((
      select has_table_privilege('anon', oid, 'SELECT')
      from pg_class where oid = to_regclass('public.latest_traffic_observations')
    ), false),
    'anonymous_base_table_select', has_table_privilege('anon', 'public.traffic_observations', 'SELECT'),
    'observation_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.traffic_observations'::regclass)
  ),
  'migration_security', jsonb_build_object(
    'rls_enabled', jsonb_build_object(
      'agencies', (select relrowsecurity from pg_class where oid = 'public.agencies'::regclass),
      'cctv_locations', (select relrowsecurity from pg_class where oid = 'public.cctv_locations'::regclass)
    ),
    'public_view_security_invoker', exists (
      select 1
      from pg_class as c
      where c.oid = 'public.public_cctv_locations'::regclass
        and 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]))
    ),
    'public_view_select_grant', has_table_privilege('anon', 'public.public_cctv_locations', 'SELECT'),
    'anonymous_base_table_select', has_table_privilege('anon', 'public.cctv_locations', 'SELECT'),
    'anonymous_base_column_select', jsonb_build_object(
      'id', has_column_privilege('anon', 'public.cctv_locations', 'id', 'SELECT'),
      'agency_id', has_column_privilege('anon', 'public.cctv_locations', 'agency_id', 'SELECT'),
      'name', has_column_privilege('anon', 'public.cctv_locations', 'name', 'SELECT'),
      'address', has_column_privilege('anon', 'public.cctv_locations', 'address', 'SELECT'),
      'category', has_column_privilege('anon', 'public.cctv_locations', 'category', 'SELECT'),
      'longitude', has_column_privilege('anon', 'public.cctv_locations', 'longitude', 'SELECT'),
      'latitude', has_column_privilege('anon', 'public.cctv_locations', 'latitude', 'SELECT'),
      'is_active', has_column_privilege('anon', 'public.cctv_locations', 'is_active', 'SELECT'),
      'is_public', has_column_privilege('anon', 'public.cctv_locations', 'is_public', 'SELECT')
    ),
    'anonymous_camera_select_policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', policyname,
        'roles', roles,
        'command', cmd,
        'permissive', permissive,
        'using', qual
      ) order by policyname)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'cctv_locations'
        and cmd = 'SELECT'
    ), '[]'::jsonb),
    'anon_view_columns', coalesce((
      select jsonb_agg(column_name order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'public_cctv_locations'
    ), '[]'::jsonb)
  ),
  'publication_privileges', jsonb_build_object(
    'authenticated_can_write_camera_is_public',
      has_column_privilege('authenticated', 'public.cctv_locations', 'is_public', 'INSERT')
      or has_column_privilege('authenticated', 'public.cctv_locations', 'is_public', 'UPDATE'),
    'authenticated_can_write_agency_is_public',
      has_column_privilege('authenticated', 'public.agencies', 'is_public', 'INSERT')
      or has_column_privilege('authenticated', 'public.agencies', 'is_public', 'UPDATE'),
    'metadata_and_activation_write_grants', jsonb_build_object(
      'camera_name_insert', has_column_privilege('authenticated', 'public.cctv_locations', 'name', 'INSERT'),
      'camera_name_update', has_column_privilege('authenticated', 'public.cctv_locations', 'name', 'UPDATE'),
      'camera_active_update', has_column_privilege('authenticated', 'public.cctv_locations', 'is_active', 'UPDATE'),
      'agency_name_update', has_column_privilege('authenticated', 'public.agencies', 'name', 'UPDATE')
    ),
    'functions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'security_definer', p.prosecdef,
        'search_path', p.proconfig,
        'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
        'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        'definition', pg_get_functiondef(p.oid)
      ) order by p.proname)
      from pg_proc as p
      join pg_namespace as ns on ns.oid = p.pronamespace
      where ns.nspname = 'public'
        and p.proname in ('set_cctv_publication', 'set_agency_publication')
    ), '[]'::jsonb),
    'audit_triggers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', c.relname,
        'trigger', t.tgname,
        'enabled', t.tgenabled <> 'D'
      ) order by c.relname, t.tgname)
      from pg_trigger as t
      join pg_class as c on c.oid = t.tgrelid
      join pg_namespace as ns on ns.oid = c.relnamespace
      where ns.nspname = 'public'
        and c.relname in ('agencies', 'cctv_locations')
        and not t.tgisinternal
    ), '[]'::jsonb)
  ),
  'readiness_counts', jsonb_build_object(
    'agencies_total', (select count(*) from public.agencies),
    'agencies_public', (select count(*) from public.agencies where is_public),
    'agencies_private', (select count(*) from public.agencies where not is_public),
    'agency_memberships_total', (select count(*) from public.agency_memberships),
    'administrators', (select count(*) from public.user_roles where role = 'administrator'),
    'agency_editors', (select count(*) from public.user_roles where role = 'agency_editor'),
    'cameras_total', (select count(*) from public.cctv_locations)
  ),
  'phase_2d_test_fixture_preflight', jsonb_build_object(
    'matching_agencies', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_public', is_public))
      from public.agencies
      where lower(trim(name)) = lower(trim('WebGISTA DEV — Testing'))
    ), '[]'::jsonb),
    'matching_cameras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', camera.id,
        'name', camera.name,
        'address', camera.address,
        'category', camera.category,
        'latitude', camera.latitude,
        'longitude', camera.longitude,
        'is_active', camera.is_active,
        'is_public', camera.is_public,
        'agency_name', agency.name,
        'agency_is_public', agency.is_public
      ))
      from public.cctv_locations as camera
      join public.agencies as agency on agency.id = camera.agency_id
      where lower(trim(camera.name)) = lower(trim('TEST — CCTV Simpang Jambo Tape'))
    ), '[]'::jsonb)
  )
)) as phase_2d_read_only_verification;
