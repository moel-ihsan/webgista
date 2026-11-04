begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

select has_table('public', 'app_map_settings', 'global map settings table exists');
select ok(
  has_table_privilege('anon', 'public.app_map_settings', 'SELECT')
    and has_table_privilege('authenticated', 'public.app_map_settings', 'SELECT')
    and not has_table_privilege('anon', 'public.app_map_settings', 'INSERT')
    and not has_table_privilege('anon', 'public.app_map_settings', 'UPDATE'),
  'map defaults are readable for public maps but anonymous writes are denied'
);
select ok(
  has_column_privilege('authenticated', 'public.app_map_settings', 'latitude', 'UPDATE')
    and has_column_privilege('authenticated', 'public.app_map_settings', 'longitude', 'UPDATE')
    and has_column_privilege('authenticated', 'public.app_map_settings', 'zoom', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.app_map_settings', 'id', 'UPDATE'),
  'authenticated updates are limited to viewport fields'
);
select ok(
  exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.app_map_settings'::regclass and polname = 'app_map_settings_read')
    and exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.app_map_settings'::regclass and polname = 'app_map_settings_admin_insert' and polcmd = 'a')
    and exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.app_map_settings'::regclass and polname = 'app_map_settings_admin_update' and polcmd = 'w'),
  'read policy is separate from administrator-only write policies'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.app_map_settings'::regclass and conname = 'app_map_settings_latitude_range')
    and exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.app_map_settings'::regclass and conname = 'app_map_settings_longitude_range')
    and exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.app_map_settings'::regclass and conname = 'app_map_settings_zoom_range'),
  'database constraints validate latitude, longitude, and MapLibre zoom bounds'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.agency_memberships'::regclass and conname = 'agency_memberships_agency_id_fkey' and confdeltype = 'r'),
  'agency removal cannot cascade-delete editor memberships'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.cctv_locations'::regclass and conname = 'cctv_locations_agency_id_fkey' and confdeltype = 'r'),
  'agency removal cannot delete or orphan CCTV records'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'settings-admin@example.test', 'not-a-real-password', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'settings-user@example.test', 'not-a-real-password', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.user_roles (user_id, role)
values
  ('b2000000-0000-0000-0000-000000000001', 'administrator'),
  ('b2000000-0000-0000-0000-000000000002', 'agency_editor');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.app_map_settings), 0, 'anonymous map starts with the Banda Aceh fallback when no shared setting exists');
select throws_matching($$insert into public.app_map_settings (id, latitude, longitude, zoom) values (1, 5.5, 95.3, 12)$$,
  'permission denied', 'anonymous users cannot create map defaults');
reset role;

select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_matching($$insert into public.app_map_settings (id, latitude, longitude, zoom) values (1, 5.5, 95.3, 12)$$,
  'row-level security', 'agency editors cannot create global map defaults');
select throws_matching($$insert into public.agencies (name) values ('Phase 2D.5 editor agency creation denial')$$,
  'row-level security', 'agency editors cannot create agencies');
reset role;

select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.app_map_settings (id, latitude, longitude, zoom) values (1, 5.559729, 95.330911, 13)$$,
  'administrator can save the singleton global map viewport');
select lives_ok($$update public.app_map_settings set latitude = 5.56, longitude = 95.34, zoom = 14 where id = 1$$,
  'administrator can update the global map viewport');
select throws_matching($$update public.app_map_settings set latitude = 91 where id = 1$$,
  'app_map_settings_latitude_range', 'database rejects latitude outside WGS84 bounds');
select throws_matching($$update public.app_map_settings set zoom = 19 where id = 1$$,
  'app_map_settings_zoom_range', 'database rejects zoom beyond MapLibre supported range');
select throws_matching($$insert into public.app_map_settings (id, latitude, longitude, zoom) values (2, 5.5, 95.3, 12)$$,
  'check constraint', 'database enforces one global settings row');
insert into public.agencies (id, name)
values ('b2000000-0000-0000-0000-000000000010', 'Phase 2D.5 agency-delete fixture');
select is((select is_public from public.agencies where id = 'b2000000-0000-0000-0000-000000000010'), false,
  'new agencies remain private by default');
insert into public.agency_memberships (agency_id, user_id)
values ('b2000000-0000-0000-0000-000000000010', 'b2000000-0000-0000-0000-000000000002');
select throws_matching($$delete from public.agencies where id = 'b2000000-0000-0000-0000-000000000010'$$,
  'foreign key constraint', 'agency removal cannot cascade-delete existing memberships');
reset role;

select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$update public.app_map_settings set zoom = 15 where id = 1 returning id$$,
  $$select null::smallint where false$$, 'ordinary authenticated users cannot change the saved viewport');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.app_map_settings where latitude = 5.56 and longitude = 95.34 and zoom = 14), 1,
  'anonymous map reads the persisted application viewport');
reset role;

select * from finish();
rollback;
