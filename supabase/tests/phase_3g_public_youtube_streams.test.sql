begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

select has_view('public', 'public_cctv_demo_streams', 'public demo stream projection exists');
select has_column('public', 'public_cctv_demo_streams', 'video_id', 'projection exposes a parsed video id');
select is((select count(*)::int from information_schema.columns where table_schema='public' and table_name='public_cctv_demo_streams'), 2, 'public projection contains only CCTV id and video id');
select ok((select relrowsecurity from pg_class where oid='public.cctv_private_config'::regclass), 'private video configuration keeps RLS enabled');
select ok(not has_table_privilege('anon','public.cctv_private_config','SELECT') and has_table_privilege('anon','public.public_cctv_demo_streams','SELECT'), 'anonymous can read only the narrow public projection');
select ok(has_table_privilege('authenticated','public.cctv_private_config','SELECT'), 'authenticated managers retain RLS-scoped private configuration access');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
 ('d3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','youtube-admin@example.test','unused',now(),now(),now(),'{}','{}');
insert into public.user_roles (user_id, role) values ('d3000000-0000-0000-0000-000000000001','administrator');
insert into public.agencies (id, name, is_public) values
 ('d3100000-0000-0000-0000-000000000001','Public YouTube Agency',true),
 ('d3100000-0000-0000-0000-000000000002','Private YouTube Agency',false);
insert into public.cctv_locations (id, agency_id, name, address, longitude, latitude, is_active, is_public) values
 ('d3200000-0000-0000-0000-000000000001','d3100000-0000-0000-0000-000000000001','Public Demo Camera','QA',95.3,5.5,true,true),
 ('d3200000-0000-0000-0000-000000000002','d3100000-0000-0000-0000-000000000002','Private Demo Camera','QA',95.3,5.5,true,true);

select set_config('request.jwt.claims','{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.cctv_private_config (cctv_id, source_kind, source_uri, notes) values
 ('d3200000-0000-0000-0000-000000000001','public_https','https://www.youtube.com/watch?v=UTR-nG4SK7E','Demo stream'),
 ('d3200000-0000-0000-0000-000000000002','public_https','https://www.youtube.com/watch?v=BdPvBNLy5kc','Private camera stream');
reset role;

select is((select count(*)::int from public.public_cctv_demo_streams), 1, 'only published active agency camera is projected');
select is((select video_id from public.public_cctv_demo_streams where cctv_id='d3200000-0000-0000-0000-000000000001'), 'UTR-nG4SK7E', 'public projection exposes only the canonical video id');
select is((select count(*)::int from public.public_cctv_demo_streams where cctv_id='d3200000-0000-0000-0000-000000000002'), 0, 'unpublished agency configuration is not exposed');

select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_matching($$select source_uri from public.cctv_private_config$$, 'permission denied', 'anonymous cannot read private source configuration');
select is((select video_id from public.public_cctv_demo_streams where cctv_id='d3200000-0000-0000-0000-000000000001'), 'UTR-nG4SK7E', 'anonymous can read the approved public demo stream');
reset role;

select * from finish();
rollback;
