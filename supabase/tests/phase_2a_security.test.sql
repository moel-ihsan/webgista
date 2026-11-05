begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(131);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'user_roles', 'user roles table exists');
select has_table('public', 'agencies', 'agencies table exists');
select has_table('public', 'agency_memberships', 'agency memberships table exists');
select has_table('public', 'cctv_locations', 'CCTV locations table exists');
select has_table('public', 'cctv_private_config', 'private camera configuration table exists');
select has_table('public', 'traffic_observations', 'traffic observations table exists');
select has_table('public', 'admin_audit_events', 'audit table exists');
select has_view('public', 'public_cctv_locations', 'safe public CCTV view exists');
select hasnt_column(
  'public',
  'public_cctv_locations',
  'source_uri',
  'public view does not expose source URIs'
);
select hasnt_column(
  'public',
  'public_cctv_locations',
  'credential_reference',
  'public view does not expose credential references'
);
select ok(
  (
    select count(*) = 5 and bool_and(procedures.prosecdef)
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'private'
      and procedures.proname in (
        'handle_new_user',
        'capture_audit_event',
        'is_administrator',
        'is_agency_editor',
        'can_manage_agency'
      )
  ),
  'authorization and privileged write helpers use SECURITY DEFINER'
);
select ok(
  (
    select count(*) = 8
      and bool_and(
        coalesce(array_to_string(procedures.proconfig, ','), '') like '%search_path=%'
      )
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'private'
  ),
  'every private helper pins its search path'
);
select ok(
  not has_function_privilege('anon', 'private.is_administrator()', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.is_administrator()', 'EXECUTE'),
  'authorization helper execution is denied to anon and granted to authenticated'
);
select ok(
  (
    select 'security_invoker=true' = any(coalesce(classes.reloptions, '{}'::text[]))
    from pg_catalog.pg_class as classes
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = classes.relnamespace
    where namespaces.nspname = 'public'
      and classes.relname = 'public_cctv_locations'
  ),
  'public CCTV view executes with caller privileges'
);
select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'cctv_locations'
      and cmd = 'SELECT'
      and permissive = 'PERMISSIVE'
      and ('anon'::name = any(roles) or 'public'::name = any(roles))
  ),
  1::bigint,
  'anonymous camera reads have one permissive SELECT policy'
);
select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'cctv_locations'
      and cmd = 'SELECT'
      and permissive = 'PERMISSIVE'
      and 'authenticated'::name = any(roles)
  ),
  1::bigint,
  'authenticated camera reads have one permissive SELECT policy'
);
select ok(
  not has_column_privilege('authenticated', 'public.cctv_locations', 'is_public', 'INSERT')
    and not has_column_privilege('authenticated', 'public.cctv_locations', 'is_public', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.cctv_locations', 'INSERT')
    and not has_table_privilege('authenticated', 'public.cctv_locations', 'UPDATE'),
  'authenticated clients cannot write camera publication state directly'
);
select ok(
  not has_column_privilege('authenticated', 'public.agencies', 'is_public', 'INSERT')
    and not has_column_privilege('authenticated', 'public.agencies', 'is_public', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.agencies', 'INSERT')
    and not has_table_privilege('authenticated', 'public.agencies', 'UPDATE'),
  'authenticated clients cannot write agency publication state directly'
);
select ok(
  has_column_privilege('authenticated', 'public.cctv_locations', 'name', 'INSERT')
    and has_column_privilege('authenticated', 'public.cctv_locations', 'name', 'UPDATE')
    and has_column_privilege('authenticated', 'public.cctv_locations', 'is_active', 'UPDATE')
    and has_column_privilege('authenticated', 'public.agencies', 'name', 'UPDATE'),
  'ordinary camera and agency management column grants remain available'
);
select is(
  (
    select column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agencies'
      and column_name = 'is_public'
  ),
  'false',
  'new agencies default to private'
);
select ok(
  (
    select count(*) = 2
      and bool_and(procedures.prosecdef)
      and bool_and(coalesce(array_to_string(procedures.proconfig, ','), '') like '%search_path=%')
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname in ('set_cctv_publication', 'set_agency_publication')
  ),
  'publication RPCs are SECURITY DEFINER with pinned search paths'
);
select ok(
  not has_function_privilege('anon', 'public.set_cctv_publication(uuid,boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.set_agency_publication(uuid,boolean)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.set_cctv_publication(uuid,boolean)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.set_agency_publication(uuid,boolean)', 'EXECUTE'),
  'publication RPC execution is limited to authenticated callers'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.test',
    'not-a-real-password',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'editor@example.test',
    'not-a-real-password',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'viewer@example.test',
    'not-a-real-password',
    now(),
    now(),
    now(),
    '{"role":"administrator"}'::jsonb,
    '{"role":"administrator"}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'other-editor@example.test',
    'not-a-real-password',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.user_roles (user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'administrator'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'agency_editor'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'agency_editor');

insert into public.agencies (id, name, is_public)
values
  ('10000000-0000-0000-0000-000000000001', 'Agency One', true),
  ('10000000-0000-0000-0000-000000000002', 'Agency Two', true),
  ('10000000-0000-0000-0000-000000000003', 'Private Agency', false);

insert into public.agency_memberships (agency_id, user_id)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'
  );

insert into public.cctv_locations (
  id,
  agency_id,
  name,
  address,
  longitude,
  latitude,
  is_public,
  is_active
)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Public Camera',
    'Banda Aceh public test location',
    95.320000,
    5.550000,
    true,
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Inactive Camera',
    'Banda Aceh inactive test location',
    95.330000,
    5.560000,
    true,
    false
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Private Camera',
    'Banda Aceh private test location',
    95.340000,
    5.570000,
    false,
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    'Public Flag Private Agency Camera',
    'Banda Aceh private-agency test location',
    95.350000,
    5.580000,
    true,
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000003',
    'Private Flag Camera',
    'Banda Aceh private camera publication test location',
    95.360000,
    5.590000,
    false,
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    'Editor Config Test Camera',
    'Disposable authorized config test location',
    95.370000,
    5.600000,
    false,
    true
  );

insert into public.cctv_private_config (cctv_id, source_kind, source_uri)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    'public_https',
    'https://camera-one.example.test/stream'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'private_stream',
    'rtsp://private-camera.example.test/stream'
  );

insert into public.traffic_observations (
  id,
  cctv_id,
  window_started_at,
  window_ended_at,
  counting_method,
  processing_status,
  source_kind,
  model_name,
  model_version,
  algorithm_version,
  light_vehicle_count,
  sampled_frames
)
values (
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  '2026-01-01 09:00:00+00',
  '2026-01-01 09:01:00+00',
  'frame_detections',
  'completed',
  'browser',
  'test-model',
  '1.0.0',
  'frame-count-v1',
  1,
  1
);

select throws_matching(
  $$
    insert into public.cctv_locations (
      agency_id, name, address, longitude, latitude
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'Invalid Longitude',
      'Constraint test',
      180.000001,
      5.5
    )
  $$,
  'cctv_locations_longitude_range',
  'longitude above 180 is rejected'
);

select throws_matching(
  $$
    insert into public.cctv_locations (
      agency_id, name, address, longitude, latitude
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'Invalid Latitude',
      'Constraint test',
      95.3,
      -90.000001
    )
  $$,
  'cctv_locations_latitude_range',
  'latitude below -90 is rejected'
);

select throws_matching(
  $$
    insert into public.traffic_observations (
      cctv_id,
      window_started_at,
      window_ended_at,
      counting_method,
      source_kind
    ) values (
      'c0000000-0000-0000-0000-000000000001',
      '2026-01-01 10:01:00+00',
      '2026-01-01 10:00:00+00',
      'manual',
      'manual'
    )
  $$,
  'traffic_observations_time_window',
  'observation end must be after its start'
);

select throws_matching(
  $$
    insert into public.traffic_observations (
      cctv_id,
      window_started_at,
      window_ended_at,
      counting_method,
      processing_status,
      source_kind
    ) values (
      'c0000000-0000-0000-0000-000000000001',
      '2026-01-01 10:00:00+00',
      '2026-01-01 10:01:00+00',
      'frame_detections',
      'completed',
      'browser'
    )
  $$,
  'traffic_observations_completed_provenance',
  'completed automated observations require model provenance and sampled frames'
);

select throws_matching(
  $$
    insert into public.traffic_observations (
      cctv_id,
      window_started_at,
      window_ended_at,
      counting_method,
      source_kind,
      light_vehicle_count
    ) values (
      'c0000000-0000-0000-0000-000000000001',
      '2026-01-01 10:00:00+00',
      '2026-01-01 10:01:00+00',
      'manual',
      'manual',
      -1
    )
  $$,
  'traffic_observations_nonnegative_counts',
  'vehicle counts cannot be negative'
);

select throws_matching(
  $$
    insert into public.cctv_locations (
      agency_id, name, address, longitude, latitude
    ) values (
      '10000000-0000-0000-0000-000000000099',
      'Missing Agency',
      'Foreign key test',
      95.3,
      5.5
    )
  $$,
  'foreign key constraint',
  'CCTV rows require an existing agency'
);

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

select results_eq(
  'select count(*)::bigint from public.public_cctv_locations',
  array[1::bigint],
  'anonymous visitors see only active approved cameras'
);
select results_eq(
  'select count(*)::bigint from public.cctv_locations',
  array[1::bigint],
  'anonymous base-table reads are also limited to active approved cameras'
);
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'anon can read an active public camera owned by a public agency directly'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'anon can read an active public camera owned by a public agency through the view'
);
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000003'$$,
  array[0::bigint],
  'anon cannot directly read a private camera in a public agency'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000003'$$,
  array[0::bigint],
  'anon cannot read a private camera through the view'
);
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'anon cannot directly read an inactive public camera'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000002'$$,
  array[0::bigint],
  'anon cannot read an inactive camera through the view'
);
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000004'$$,
  array[0::bigint],
  'anon cannot directly read an active public camera owned by a private agency'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000004'$$,
  array[0::bigint],
  'anon cannot read an active public camera in a private agency through the view'
);
select results_eq(
  $$select count(*)::bigint from public.agencies where id = '10000000-0000-0000-0000-000000000003'$$,
  array[0::bigint],
  'anon cannot otherwise read the camera owner agency'
);
select is(
  (select location_geojson ->> 'type' from public.public_cctv_locations),
  'Point',
  'public location is convertible to GeoJSON Point'
);
select is(
  (select location_geojson #>> '{coordinates,0}' from public.public_cctv_locations),
  '95.320000',
  'GeoJSON stores longitude before latitude'
);
select throws_matching(
  $$insert into public.agencies (name) values ('Anonymous Agency')$$,
  'permission denied',
  'anonymous users cannot insert agencies'
);
select throws_matching(
  $$select count(*) from public.cctv_private_config$$,
  'permission denied',
  'anonymous users cannot read private CCTV configuration directly'
);
select throws_matching(
  $$
    update public.cctv_locations
    set name = 'Anonymous Camera Update'
    where id = 'c0000000-0000-0000-0000-000000000001'
  $$,
  'permission denied',
  'anonymous users cannot update CCTV metadata'
);
select throws_matching(
  $$
    delete from public.cctv_locations
    where id = 'c0000000-0000-0000-0000-000000000001'
  $$,
  'permission denied',
  'anonymous users cannot delete CCTV metadata'
);
select throws_matching(
  $$select public.set_cctv_publication('c0000000-0000-0000-0000-000000000001', true)$$,
  'permission denied',
  'anonymous users cannot invoke camera publication'
);
select throws_matching(
  $$select public.set_agency_publication('10000000-0000-0000-0000-000000000001', true)$$,
  'permission denied',
  'anonymous users cannot invoke agency publication'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000004'$$,
  array[0::bigint],
  'authenticated users without a management role cannot read a public camera in a private agency directly'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000004'$$,
  array[0::bigint],
  'authenticated users without a management role cannot read a private-agency camera through the view'
);
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'authenticated users can read an active public camera in a public agency directly'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'authenticated users can read an active public camera in a public agency through the view'
);

update public.agencies
set name = 'Viewer Changed Agency'
where id = '10000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select name from public.agencies where id = '10000000-0000-0000-0000-000000000001'),
  'Agency One',
  'authenticated users without a managed agency cannot update it'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

update public.agencies
set name = 'Agency One Edited'
where id = '10000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select name from public.agencies where id = '10000000-0000-0000-0000-000000000001'),
  'Agency One Edited',
  'agency editors can update their assigned agency'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_matching(
  $$insert into public.cctv_locations (agency_id, name, address, longitude, latitude, is_public)
    values ('10000000-0000-0000-0000-000000000001', 'Editor Public Camera', 'Must be denied', 95.31, 5.51, true)$$,
  'permission denied',
  'agency editors cannot explicitly insert a public camera'
);
select throws_matching(
  $$update public.cctv_locations set is_public = false where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'permission denied',
  'agency editors cannot unpublish an existing camera directly'
);
select throws_matching(
  $$update public.agencies set is_public = false where id = '10000000-0000-0000-0000-000000000001'$$,
  'permission denied',
  'agency editors cannot change an assigned agency publication state'
);
select throws_matching(
  $$update public.agencies set is_public = true where id = '10000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'agency editors cannot publish an agency directly'
);
select throws_matching(
  $$select public.set_cctv_publication('c0000000-0000-0000-0000-000000000001', true)$$,
  'administrator authorization required',
  'agency editors cannot bypass camera publication field grants via RPC'
);
select throws_matching(
  $$select public.set_agency_publication('10000000-0000-0000-0000-000000000001', true)$$,
  'administrator authorization required',
  'agency editors cannot bypass agency publication field grants via RPC'
);

select throws_matching(
  $$
    insert into public.user_roles (user_id, role)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'administrator')
  $$,
  'row-level security',
  'agency editors cannot assign roles to other users'
);
select throws_matching(
  $$update public.cctv_locations set agency_id = '10000000-0000-0000-0000-000000000002' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'row-level security',
  'agency editors cannot reassign a camera to an unassigned agency'
);

update public.cctv_locations
set name = 'Assigned Camera Edited'
where id = 'c0000000-0000-0000-0000-000000000001';

update public.cctv_locations
set is_active = false
where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select is_active from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'),
  false,
  'agency editors can deactivate an assigned camera'
);
update public.cctv_locations
set is_active = true
where id = 'c0000000-0000-0000-0000-000000000001';

update public.cctv_locations
set name = 'Wrong Agency Camera Edited'
where id = 'c0000000-0000-0000-0000-000000000003';

reset role;
select is(
  (
    select name
    from public.cctv_locations
    where id = 'c0000000-0000-0000-0000-000000000001'
  ),
  'Assigned Camera Edited',
  'agency editors can update CCTV metadata for their assigned agency'
);
select is(
  (select is_active from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'),
  true,
  'agency editors retain authorized camera activation controls'
);
select is(
  (
    select name
    from public.cctv_locations
    where id = 'c0000000-0000-0000-0000-000000000003'
  ),
  'Private Camera',
  'agency editors cannot update CCTV metadata for another agency'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

update public.agencies
set name = 'Wrong Agency Edit'
where id = '10000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select name from public.agencies where id = '10000000-0000-0000-0000-000000000002'),
  'Agency Two',
  'agency editors cannot update another agency'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::bigint from public.cctv_private_config',
  array[1::bigint],
  'agency editors see private configuration only for assigned cameras'
);

update public.traffic_observations
set light_vehicle_count = 99
where id = 'd0000000-0000-0000-0000-000000000001';

reset role;
select is(
  (
    select light_vehicle_count
    from public.traffic_observations
    where id = 'd0000000-0000-0000-0000-000000000001'
  ),
  1,
  'agency editors cannot rewrite a completed observation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

update public.agencies
set name = 'Agency Two Admin Edited'
where id = '10000000-0000-0000-0000-000000000002';

update public.traffic_observations
set light_vehicle_count = 2
where id = 'd0000000-0000-0000-0000-000000000001';

select throws_matching(
  $$update public.cctv_locations set is_public = false where id = 'c0000000-0000-0000-0000-000000000002'$$,
  'permission denied',
  'administrators use the audited operation instead of direct camera publication writes'
);
select throws_matching(
  $$insert into public.cctv_locations (agency_id, name, address, longitude, latitude, is_public)
    values ('10000000-0000-0000-0000-000000000001', 'Admin Public Camera', 'Must be denied', 95.32, 5.52, true)$$,
  'permission denied',
  'administrators cannot bypass the publication operation during camera creation'
);
select throws_matching(
  $$insert into public.agencies (name, is_public) values ('Admin Public Agency', true)$$,
  'permission denied',
  'administrators cannot bypass the publication operation during agency creation'
);
select throws_matching(
  $$update public.agencies set is_public = true where id = '10000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'administrators use the audited operation instead of direct agency publication writes'
);

update public.cctv_locations
set name = 'Administrator Metadata Edit'
where id = 'c0000000-0000-0000-0000-000000000002';

insert into public.agencies (name)
values ('Admin Default Private Agency');

select throws_matching(
  $$select public.set_cctv_publication('c0000000-0000-0000-0000-000000000005', true)$$,
  'camera agency must be public before publishing',
  'administrators cannot publish a camera while its agency is private'
);

select is(
  public.set_agency_publication('10000000-0000-0000-0000-000000000003', true),
  true,
  'administrators can publish an agency through the audited operation'
);
select is(
  (select is_public from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000005'),
  false,
  'publishing an agency does not publish its cameras'
);
select is(
  public.set_agency_publication('10000000-0000-0000-0000-000000000003', true),
  false,
  'repeated agency publication is an idempotent no-op'
);
select results_eq(
  $$select count(*)::bigint from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'agencies' and entity_id = '10000000-0000-0000-0000-000000000003'$$,
  array[1::bigint],
  'repeated agency publication creates no duplicate audit event'
);
select is(
  (
    select actor_user_id
    from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'agencies' and entity_id = '10000000-0000-0000-0000-000000000003'
    order by occurred_at desc, id desc
    limit 1
  ),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'agency publication audit event records the authenticated administrator'
);
select is(
  (
    select details -> 'publication'
    from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'agencies' and entity_id = '10000000-0000-0000-0000-000000000003'
    order by occurred_at desc, id desc
    limit 1
  ),
  '{"from": false, "to": true}'::jsonb,
  'agency publication audit records the state transition'
);

select is(
  public.set_cctv_publication('c0000000-0000-0000-0000-000000000005', true),
  true,
  'administrators can publish a camera through the audited operation'
);
select is(
  public.set_cctv_publication('c0000000-0000-0000-0000-000000000005', true),
  false,
  'repeated camera publication is an idempotent no-op'
);
select results_eq(
  $$select count(*)::bigint from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'cctv_locations' and entity_id = 'c0000000-0000-0000-0000-000000000005'$$,
  array[1::bigint],
  'repeated camera publication creates no duplicate audit event'
);
select is(
  (
    select actor_user_id
    from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'cctv_locations' and entity_id = 'c0000000-0000-0000-0000-000000000005'
    order by occurred_at desc, id desc
    limit 1
  ),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'camera publication audit event records the authenticated administrator'
);
select is(
  (
    select details -> 'publication'
    from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'cctv_locations' and entity_id = 'c0000000-0000-0000-0000-000000000005'
    order by occurred_at desc, id desc
    limit 1
  ),
  '{"from": false, "to": true}'::jsonb,
  'camera publication audit records the state transition'
);
select is(
  public.set_agency_publication('10000000-0000-0000-0000-000000000003', false),
  true,
  'administrators can unpublish an agency through the audited operation'
);
select is(
  (select is_public from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000005'),
  true,
  'unpublishing an agency does not rewrite camera publication state'
);
select results_eq(
  $$select count(*)::bigint from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'agencies' and entity_id = '10000000-0000-0000-0000-000000000003'$$,
  array[2::bigint],
  'agency publication and unpublication each generate one audit event'
);
select is(
  (
    select details -> 'publication'
    from public.admin_audit_events
    where action = 'UPDATE' and entity_type = 'agencies' and entity_id = '10000000-0000-0000-0000-000000000003'
    order by occurred_at desc, id desc
    limit 1
  ),
  '{"from": true, "to": false}'::jsonb,
  'agency unpublication audit records the state transition'
);

reset role;
select is(
  (select name from public.agencies where id = '10000000-0000-0000-0000-000000000002'),
  'Agency Two Admin Edited',
  'administrators can update managed records'
);
select is(
  (select name from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000002'),
  'Administrator Metadata Edit',
  'administrators retain ordinary camera metadata management'
);
select is(
  (select is_public from public.agencies where name = 'Admin Default Private Agency'),
  false,
  'administrator-created agencies default to private'
);
select is(
  (
    select light_vehicle_count
    from public.traffic_observations
    where id = 'd0000000-0000-0000-0000-000000000001'
  ),
  2,
  'administrators retain the audited correction path for completed observations'
);

select ok(
  not has_table_privilege('authenticated', 'public.cctv_private_config', 'INSERT')
    and has_table_privilege('authenticated', 'public.cctv_private_config', 'SELECT')
    and has_column_privilege('authenticated', 'public.cctv_private_config', 'source_uri', 'INSERT')
    and not has_column_privilege('authenticated', 'public.cctv_private_config', 'created_by', 'INSERT')
    and not has_column_privilege('authenticated', 'public.cctv_private_config', 'updated_by', 'INSERT')
    and not has_column_privilege('authenticated', 'public.cctv_private_config', 'created_at', 'INSERT')
    and not has_column_privilege('authenticated', 'public.cctv_private_config', 'updated_at', 'INSERT')
    and not has_table_privilege('anon', 'public.cctv_private_config', 'INSERT')
    and not has_table_privilege('anon', 'public.cctv_private_config', 'SELECT'),
  'authenticated retains only allowed config-column INSERT and scoped SELECT privileges'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.cctv_private_config (cctv_id, source_kind, source_uri, notes)
    values ('c0000000-0000-0000-0000-000000000002', 'stored_clip', '/test/admin.mp4', 'admin test')$$,
  'administrator can insert an authorized private video association'
);
select throws_matching(
  $$insert into public.cctv_private_config (cctv_id, source_kind, source_uri, created_by)
    values ('c0000000-0000-0000-0000-000000000002', 'stored_clip', '/test/forged.mp4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3')$$,
  'permission denied',
  'authenticated actors cannot supply a forged creator column'
);
select lives_ok(
  $$update public.cctv_private_config set source_uri = '/test/admin-updated.mp4'
    where cctv_id = 'c0000000-0000-0000-0000-000000000002'$$,
  'administrator can update an existing video association'
);
reset role;
select is(
  (select created_by from public.cctv_private_config where cctv_id = 'c0000000-0000-0000-0000-000000000002'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
  'database trigger records the authenticated administrator on config insert'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.cctv_private_config (cctv_id, source_kind, source_uri, notes)
    values ('c0000000-0000-0000-0000-000000000006', 'stored_clip', '/test/editor.mp4', 'editor test')$$,
  'agency editor can insert a video association for an assigned camera'
);
select throws_matching(
  $$insert into public.cctv_private_config (cctv_id, source_kind, source_uri)
    values ('c0000000-0000-0000-0000-000000000004', 'stored_clip', '/test/cross-agency.mp4')$$,
  'new row violates row-level security policy',
  'agency editor cannot insert a video association for another agency'
);
select lives_ok(
  $$update public.cctv_private_config set source_uri = '/test/editor-updated.mp4'
    where cctv_id = 'c0000000-0000-0000-0000-000000000006'$$,
  'agency editor can update an association for an assigned camera'
);
update public.cctv_private_config
set source_uri = '/test/unauthorized.mp4'
where cctv_id = 'c0000000-0000-0000-0000-000000000003';
reset role;
select is(
  (select created_by from public.cctv_private_config where cctv_id = 'c0000000-0000-0000-0000-000000000006'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
  'database trigger records the authenticated agency editor on config insert'
);
select is(
  (select source_uri from public.cctv_private_config where cctv_id = 'c0000000-0000-0000-0000-000000000006'),
  '/test/editor-updated.mp4',
  'authorized agency editor update persists'
);
select is(
  (select source_uri from public.cctv_private_config where cctv_id = 'c0000000-0000-0000-0000-000000000003'),
  'rtsp://private-camera.example.test/stream',
  'agency editor cannot change another agency video association'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_matching(
  $$insert into public.cctv_private_config (cctv_id, source_kind, source_uri)
    values ('c0000000-0000-0000-0000-000000000002', 'stored_clip', '/test/anonymous.mp4')$$,
  'permission denied',
  'anonymous users cannot insert private video associations'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000005'$$,
  array[0::bigint],
  'public camera remains hidden from direct anonymous reads while its agency is private'
);
select results_eq(
  $$select count(*)::bigint from public.public_cctv_locations where id = 'c0000000-0000-0000-0000-000000000005'$$,
  array[0::bigint],
  'public camera remains hidden through the view while its agency is private'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_matching(
  $$select public.set_cctv_publication('c0000000-0000-0000-0000-000000000001', true)$$,
  'administrator authorization required',
  'authenticated users without an administrator role cannot publish cameras'
);
select throws_matching(
  $$select public.set_agency_publication('10000000-0000-0000-0000-000000000001', true)$$,
  'administrator authorization required',
  'authenticated users without an administrator role cannot publish agencies'
);

select throws_matching(
  $$
    insert into public.user_roles (user_id, role)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'administrator')
  $$,
  'user_roles_not_self_granted|row-level security',
  'a user cannot promote itself through user_roles'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

update public.user_roles
set role = 'agency_editor'
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

reset role;
select is(
  (select role::text from public.user_roles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  'administrator',
  'administrators cannot rewrite their own role through client RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

delete from public.user_roles
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

reset role;
select is(
  (select role::text from public.user_roles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  'administrator',
  'administrators cannot delete their own role through client RLS'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_matching(
  $$
    insert into public.admin_audit_events (action, entity_type)
    values ('INSERT', 'forged_event')
  $$,
  'permission denied',
  'ordinary authenticated users cannot forge audit records'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_matching(
  $$
    insert into public.admin_audit_events (action, entity_type)
    values ('INSERT', 'forged_admin_event')
  $$,
  'permission denied',
  'administrators cannot insert audit records through the client role'
);
select throws_matching(
  $$
    update public.admin_audit_events
    set entity_type = 'tampered'
  $$,
  'permission denied',
  'administrators cannot modify audit records through the client role'
);
select throws_matching(
  $$delete from public.admin_audit_events$$,
  'permission denied',
  'administrators cannot delete audit records through the client role'
);
select ok(
  (select count(*) > 0 from public.admin_audit_events),
  'administrators can read generated audit records'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.cctv_locations (
  agency_id,
  name,
  address,
  longitude,
  latitude
)
values (
  '10000000-0000-0000-0000-000000000001',
  'Editor Camera',
  'Assigned agency camera',
  95.35,
  5.58
);

select throws_matching(
  $$update public.cctv_locations set is_public = true where name = 'Editor Camera'$$,
  'permission denied',
  'agency editors cannot publish a newly created private camera'
);

reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.cctv_locations
    where name = 'Editor Camera'
      and agency_id = '10000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  'agency editors can insert a camera for their assigned agency'
);
select is(
  (
    select created_by
    from public.cctv_locations
    where name = 'Editor Camera'
  ),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
  'database trigger records the authenticated actor on client inserts'
);
select ok(
  (
    select is_active and not is_public
    from public.cctv_locations
    where name = 'Editor Camera'
  ),
  'new camera rows default to active and private'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;
update public.cctv_locations
set is_active = false
where name = 'Editor Camera';
reset role;
select ok(
  (
    select not is_active and not is_public
    from public.cctv_locations
    where name = 'Editor Camera'
  ),
  'changing activation state does not publish a camera'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_matching(
  $$
    insert into public.cctv_locations (
      agency_id,
      name,
      address,
      longitude,
      latitude,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'Spoofed Actor Camera',
      'Actor spoof test',
      95.37,
      5.60,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
    )
  $$,
  'permission denied',
  'clients cannot supply a different created_by identity'
);
select throws_matching(
  $$
    update public.cctv_locations
    set source_system = 'v1_import'
    where id = 'c0000000-0000-0000-0000-000000000001'
  $$,
  'permission denied',
  'clients cannot rewrite protected provenance columns'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_matching(
  $$
    insert into public.cctv_locations (
      agency_id, name, address, longitude, latitude
    ) values (
      '10000000-0000-0000-0000-000000000002',
      'Wrong Agency Camera',
      'Unassigned agency camera',
      95.36,
      5.59
    )
  $$,
  'row-level security',
  'agency editors cannot insert a camera for another agency'
);
delete from public.cctv_locations
where name = 'Editor Camera';
reset role;
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where name = 'Editor Camera'$$,
  array[1::bigint],
  'agency editors cannot delete camera metadata'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  'select count(*)::bigint from public.cctv_private_config',
  array[0::bigint],
  'user-editable Auth metadata does not grant administrator access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.user_roles (user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'agency_editor');

select lives_ok(
  $$delete from public.cctv_locations where name = 'Editor Camera'$$,
  'administrators can delete an unreferenced CCTV location'
);
select results_eq(
  $$select count(*)::bigint from public.cctv_locations where name = 'Editor Camera'$$,
  array[0::bigint],
  'administrator CCTV delete removes only its target location'
);
select throws_matching(
  $$delete from public.cctv_locations where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'foreign key constraint',
  'traffic observation history prevents camera deletion'
);

reset role;
select is(
  (select role::text from public.user_roles where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'),
  'agency_editor',
  'administrators can assign a role to another user'
);

select * from finish();
rollback;
