do $preflight$
declare
  profile_media_applied boolean;
  map_settings_applied boolean;
  traffic_observations_applied boolean;
  bucket_ok boolean;
  policy_names text[];
  agency_write_policies_ok boolean;
  membership_write_policies_ok boolean;
  camera_write_policies_ok boolean;
  publication_functions_ok boolean;
  observation_policies_ok boolean;
  expected_storage_policies text[] := array[
    'cctv_images_delete_managed', 'cctv_images_insert_managed',
    'cctv_images_read_managed', 'cctv_images_read_public',
    'profile_photos_delete_own', 'profile_photos_insert_own', 'profile_photos_read_own'
  ];
  membership_fk_ok boolean;
begin
  select exists (select 1 from supabase_migrations.schema_migrations where version = '20261104000300')
    into profile_media_applied;
  select exists (select 1 from supabase_migrations.schema_migrations where version = '20261104000400')
    into map_settings_applied;
  select exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000100')
    into traffic_observations_applied;

  if map_settings_applied and not profile_media_applied then
    raise exception 'Migration history is inconsistent: 004 is applied before 003';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'Storage object RLS is not enabled';
  end if;
  if not has_table_privilege('anon', 'storage.objects', 'SELECT')
    or not has_table_privilege('authenticated', 'storage.objects', 'SELECT')
    or not has_table_privilege('authenticated', 'storage.objects', 'INSERT')
    or not has_table_privilege('authenticated', 'storage.objects', 'DELETE') then
    raise exception 'Storage API role grants required by the reviewed RLS policies are missing';
  end if;

  select coalesce(array_agg(polname::text order by polname::text), array[]::text[])
    into policy_names
  from pg_policy
  where polrelid = 'storage.objects'::regclass;

  if profile_media_applied then
    if (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles'
          and ((column_name = 'address' and data_type = 'text')
            or (column_name = 'description' and data_type = 'text')
            or (column_name in ('latitude', 'longitude') and data_type = 'numeric'))) <> 4
      or (select count(*) from pg_constraint
          where conrelid = 'public.profiles'::regclass and convalidated
            and conname in ('profiles_address_length', 'profiles_description_length',
              'profiles_latitude_range', 'profiles_longitude_range', 'profiles_coordinates_pair')) <> 5 then
      raise exception 'Installed profile fields or constraints differ from migration 003';
    end if;
    if not has_column_privilege('authenticated', 'public.profiles', 'address', 'UPDATE')
      or has_column_privilege('anon', 'public.profiles', 'address', 'UPDATE')
      or not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then
      raise exception 'Installed profile grants or RLS differ from migration 003';
    end if;
    if policy_names <> expected_storage_policies then
      raise exception 'Storage policies touching WebGISTA media do not match the reviewed set';
    end if;
  else
    if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name in ('address', 'latitude', 'longitude', 'description'))
      or exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
        and conname in ('profiles_address_length', 'profiles_description_length',
          'profiles_latitude_range', 'profiles_longitude_range', 'profiles_coordinates_pair')) then
      raise exception 'Untracked profile-media schema objects exist before migration 003';
    end if;
    if policy_names <> array[]::text[] then
      raise exception 'Existing Storage policies reference WebGISTA media buckets before migration 003';
    end if;
  end if;

  select count(*) = 2 and bool_and(
    (id = 'profile-photos' and name = 'profile-photos' and not public
      and file_size_limit = 2097152 and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'])
    or (id = 'cctv-images' and name = 'cctv-images' and not public
      and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'])
  ) into bucket_ok
  from storage.buckets where id in ('profile-photos', 'cctv-images');
  if profile_media_applied and not coalesce(bucket_ok, false) then
    raise exception 'Installed private media buckets differ from migration 003';
  end if;
  if not profile_media_applied and exists (
    select 1 from storage.buckets
    where id = 'profile-photos' and (name is distinct from 'profile-photos' or public is distinct from false
      or file_size_limit is distinct from 2097152
      or allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'])
      or id = 'cctv-images' and (name is distinct from 'cctv-images' or public is distinct from false
      or file_size_limit is distinct from 5242880
      or allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'])
  ) then
    raise exception 'Existing media bucket configuration conflicts with migration 003';
  end if;

  select c.convalidated
    and c.confrelid = 'public.agencies'::regclass
    and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.agency_memberships'::regclass and attname = 'agency_id')]::smallint[]
    and c.confkey = array[(select attnum from pg_attribute where attrelid = 'public.agencies'::regclass and attname = 'id')]::smallint[]
    and c.confdeltype = case when map_settings_applied then 'r'::"char" else 'c'::"char" end
    into membership_fk_ok
  from pg_constraint c
  where c.conrelid = 'public.agency_memberships'::regclass
    and c.conname = 'agency_memberships_agency_id_fkey' and c.contype = 'f';
  if not coalesce(membership_fk_ok, false) then
    raise exception 'Agency membership foreign key is missing, unvalidated, or has unexpected delete behavior';
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.cctv_locations'::regclass
      and c.conname = 'cctv_locations_agency_id_fkey'
      and c.contype = 'f' and c.convalidated
      and c.confrelid = 'public.agencies'::regclass and c.confdeltype = 'r'
  ) then
    raise exception 'CCTV agency foreign key is missing or has unexpected delete behavior';
  end if;
  if exists (select 1 from public.agency_memberships m left join public.agencies a on a.id = m.agency_id where a.id is null) then
    raise exception 'Orphan agency memberships exist; foreign-key migration cannot be safely validated';
  end if;

  select count(*) = 3 and bool_and(
    (polname = 'agencies_admin_insert' and polcmd = 'a'
      and pg_get_expr(polwithcheck, polrelid) like '%is_administrator%')
    or (polname = 'agencies_manager_update' and polcmd = 'w'
      and pg_get_expr(polqual, polrelid) like '%can_manage_agency%'
      and pg_get_expr(polwithcheck, polrelid) like '%can_manage_agency%')
    or (polname = 'agencies_admin_delete' and polcmd = 'd'
      and pg_get_expr(polqual, polrelid) like '%is_administrator%')
  ) into agency_write_policies_ok
  from pg_policy
  where polrelid = 'public.agencies'::regclass and polcmd in ('a', 'w', 'd', '*');
  select count(*) = 2 and bool_and(
    (polname = 'agency_memberships_admin_insert' and polcmd = 'a'
      and pg_get_expr(polwithcheck, polrelid) like '%is_administrator%')
    or (polname = 'agency_memberships_admin_delete' and polcmd = 'd'
      and pg_get_expr(polqual, polrelid) like '%is_administrator%')
  ) into membership_write_policies_ok
  from pg_policy
  where polrelid = 'public.agency_memberships'::regclass and polcmd in ('a', 'w', 'd', '*');
  select count(*) = 3 and bool_and(
    (polname = 'cctv_locations_manager_insert' and polcmd = 'a'
      and pg_get_expr(polwithcheck, polrelid) like '%can_manage_agency%')
    or (polname = 'cctv_locations_manager_update' and polcmd = 'w'
      and pg_get_expr(polqual, polrelid) like '%can_manage_agency%'
      and pg_get_expr(polwithcheck, polrelid) like '%can_manage_agency%')
    or (polname = 'cctv_locations_admin_delete' and polcmd = 'd'
      and pg_get_expr(polqual, polrelid) like '%is_administrator%')
  ) into camera_write_policies_ok
  from pg_policy
  where polrelid = 'public.cctv_locations'::regclass and polcmd in ('a', 'w', 'd', '*');
  select count(*) = 2 and bool_and(
    prosecdef and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'
      and prosrc like '%private.is_administrator%'
  ) into publication_functions_ok
  from pg_proc
  where oid in (
    to_regprocedure('public.set_cctv_publication(uuid,boolean)'),
    to_regprocedure('public.set_agency_publication(uuid,boolean)')
  );

  if not (select relrowsecurity from pg_class where oid = 'public.agencies'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.agency_memberships'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.cctv_locations'::regclass)
    or not coalesce(agency_write_policies_ok, false)
    or not coalesce(membership_write_policies_ok, false)
    or not coalesce(camera_write_policies_ok, false)
    or not coalesce(publication_functions_ok, false)
    or has_table_privilege('authenticated', 'public.agencies', 'INSERT')
    or has_table_privilege('authenticated', 'public.agencies', 'UPDATE')
    or has_table_privilege('authenticated', 'public.cctv_locations', 'INSERT')
    or has_table_privilege('authenticated', 'public.cctv_locations', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.agencies', 'name', 'INSERT')
    or not has_column_privilege('authenticated', 'public.agencies', 'name', 'UPDATE')
    or exists (
      select 1 from unnest(array['agency_id', 'name', 'address', 'category', 'longitude', 'latitude', 'snapshot_path', 'is_active']) as fields(column_name)
      where not has_column_privilege('authenticated', 'public.cctv_locations', fields.column_name, 'INSERT')
        or not has_column_privilege('authenticated', 'public.cctv_locations', fields.column_name, 'UPDATE')
    )
    or has_column_privilege('authenticated', 'public.agencies', 'is_public', 'INSERT')
    or has_column_privilege('authenticated', 'public.agencies', 'is_public', 'UPDATE')
    or has_column_privilege('authenticated', 'public.cctv_locations', 'is_public', 'INSERT')
    or has_column_privilege('authenticated', 'public.cctv_locations', 'is_public', 'UPDATE')
    or (select column_default from information_schema.columns where table_schema = 'public'
      and table_name = 'agencies' and column_name = 'is_public') is distinct from 'false'
    or (select column_default from information_schema.columns where table_schema = 'public'
      and table_name = 'cctv_locations' and column_name = 'is_public') is distinct from 'false'
    or has_function_privilege('anon', 'public.set_cctv_publication(uuid,boolean)', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_agency_publication(uuid,boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_cctv_publication(uuid,boolean)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_agency_publication(uuid,boolean)', 'EXECUTE') then
    raise exception 'Agency, CCTV, or publication authorization differs from the tested security contract';
  end if;

  if map_settings_applied then
    if to_regclass('public.app_map_settings') is null
      or not (select relrowsecurity from pg_class where oid = 'public.app_map_settings'::regclass)
      or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'app_map_settings'
        and ((column_name = 'id' and data_type = 'smallint')
          or (column_name in ('latitude', 'longitude', 'zoom') and data_type = 'numeric'))) <> 4
      or (select count(*) from pg_policy where polrelid = 'public.app_map_settings'::regclass
        and polname in ('app_map_settings_read', 'app_map_settings_admin_insert', 'app_map_settings_admin_update')) <> 3
      or (select count(*) from pg_policy where polrelid = 'public.app_map_settings'::regclass) <> 3
      or not exists (select 1 from pg_policy where polrelid = 'public.app_map_settings'::regclass
        and polname = 'app_map_settings_read' and polcmd = 'r')
      or not exists (select 1 from pg_policy where polrelid = 'public.app_map_settings'::regclass
        and polname = 'app_map_settings_admin_insert' and polcmd = 'a'
        and pg_get_expr(polwithcheck, polrelid) like '%is_administrator%')
      or not exists (select 1 from pg_policy where polrelid = 'public.app_map_settings'::regclass
        and polname = 'app_map_settings_admin_update' and polcmd = 'w'
        and pg_get_expr(polqual, polrelid) like '%is_administrator%'
        and pg_get_expr(polwithcheck, polrelid) like '%is_administrator%')
      or (select count(*) from pg_constraint where conrelid = 'public.app_map_settings'::regclass and convalidated
        and conname in ('app_map_settings_id_check', 'app_map_settings_latitude_range',
          'app_map_settings_longitude_range', 'app_map_settings_zoom_range')) <> 4
      or not has_table_privilege('anon', 'public.app_map_settings', 'SELECT')
      or has_table_privilege('anon', 'public.app_map_settings', 'INSERT')
      or has_table_privilege('anon', 'public.app_map_settings', 'UPDATE')
      or not has_table_privilege('authenticated', 'public.app_map_settings', 'SELECT')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'id', 'INSERT')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'latitude', 'INSERT')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'longitude', 'INSERT')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'zoom', 'INSERT')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'latitude', 'UPDATE')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'longitude', 'UPDATE')
      or not has_column_privilege('authenticated', 'public.app_map_settings', 'zoom', 'UPDATE')
      or has_column_privilege('authenticated', 'public.app_map_settings', 'id', 'UPDATE') then
      raise exception 'Installed map settings table, RLS, policies, or grants differ from migration 004';
    end if;
  elsif to_regclass('public.app_map_settings') is not null then
    raise exception 'Untracked app_map_settings table exists before migration 004';
  end if;

  if traffic_observations_applied then
    select count(*) = 4 and bool_and(
      (polname = 'traffic_observations_manager_select' and polcmd = 'r')
      or (polname = 'traffic_observations_manager_insert' and polcmd = 'a')
      or (polname = 'traffic_observations_manager_update' and polcmd = 'w')
      or (polname = 'traffic_observations_admin_delete' and polcmd = 'd')
    ) into observation_policies_ok
    from pg_policy
    where polrelid = 'public.traffic_observations'::regclass and polcmd in ('r', 'a', 'w', 'd', '*');

    if to_regtype('public.traffic_condition') is null
      or (select array_agg(enumlabel::text collate "C" order by enumsortorder) from pg_enum
          where enumtypid = 'public.traffic_condition'::regtype)
        is distinct from (array['terrible', 'bad', 'poor', 'average', 'good', 'great']::text[] collate "C")
      or (select count(*) from information_schema.columns where table_schema = 'public'
          and table_name = 'traffic_observations' and column_name = 'condition'
          and udt_name = 'traffic_condition' and is_nullable = 'YES') <> 1
      or to_regclass('public.latest_traffic_observations') is null
      or not (select relrowsecurity from pg_class where oid = 'public.traffic_observations'::regclass)
      or not (select 'security_invoker=true' = any(coalesce(reloptions, '{}'::text[]))
          from pg_class where oid = 'public.latest_traffic_observations'::regclass)
      or not has_table_privilege('authenticated', 'public.latest_traffic_observations', 'SELECT')
      or has_table_privilege('anon', 'public.latest_traffic_observations', 'SELECT')
      or exists (
        select 1
        from pg_class as relation
        cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as privilege
        where relation.oid = 'public.latest_traffic_observations'::regclass
          and privilege.grantee = 0
          and privilege.privilege_type = 'SELECT'
      )
      or has_table_privilege('anon', 'public.traffic_observations', 'SELECT')
      or not has_column_privilege('authenticated', 'public.traffic_observations', 'condition', 'INSERT')
      or not has_column_privilege('authenticated', 'public.traffic_observations', 'condition', 'UPDATE')
      or not coalesce(observation_policies_ok, false)
      or exists (select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'latest_traffic_observations'
          and column_name in ('source_uri', 'credential_reference')) then
      raise exception 'Installed traffic observation schema, RLS, grants, or view differs from migration 005';
    end if;
  elsif to_regtype('public.traffic_condition') is not null
    or exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'traffic_observations' and column_name = 'condition')
    or to_regclass('public.latest_traffic_observations') is not null then
    raise exception 'Untracked traffic observation objects exist before migration 005';
  end if;
end;
$preflight$;
