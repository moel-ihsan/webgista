begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'authenticated', 'authenticated', 'traffic-admin@example.test', 'not-a-real-password', now(), now(), now(), '{"role":"administrator"}', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'authenticated', 'authenticated', 'traffic-editor@example.test', 'not-a-real-password', now(), now(), now(), '{}', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'authenticated', 'authenticated', 'traffic-other@example.test', 'not-a-real-password', now(), now(), now(), '{}', '{}');
insert into public.user_roles (user_id, role) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'administrator'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'agency_editor'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'agency_editor');
insert into public.agencies (id, name, is_public) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Traffic Agency One', false),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Traffic Agency Two', false);
insert into public.agency_memberships (agency_id, user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3');
insert into public.cctv_locations (id, agency_id, name, address, longitude, latitude)
values
  ('bbbbbbbb-1111-1111-1111-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Traffic Camera One', 'Test address one', 95.32, 5.55),
  ('bbbbbbbb-1111-1111-1111-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Traffic Camera Two', 'Test address two', 95.33, 5.56);

select plan(25);

select ok(to_regtype('public.traffic_condition') is not null, 'traffic condition enum exists');
select has_column('public', 'traffic_observations', 'condition', 'condition is persisted per observation');
select col_type_is('public', 'traffic_observations', 'condition', 'traffic_condition', 'condition uses the constrained enum');
select results_eq(
  $$select enumlabel::text collate "C" from pg_enum where enumtypid = 'public.traffic_condition'::regtype order by enumsortorder$$,
  $$select label collate "C" from (values ('terrible'::text), ('bad'), ('poor'), ('average'), ('good'), ('great')) as expected(label)$$,
  'condition vocabulary matches the six supported categories'
);
select ok((select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'traffic_observations' and column_name = 'condition'), 'existing observation rows remain compatible');
select has_view('public', 'latest_traffic_observations', 'RLS-scoped latest observation view exists');
select ok((select 'security_invoker=true' = any(coalesce(reloptions, '{}'::text[])) from pg_class where oid = 'public.latest_traffic_observations'::regclass), 'latest view runs with caller privileges');
select ok(has_table_privilege('authenticated', 'public.latest_traffic_observations', 'SELECT'), 'authenticated role can read latest observations through RLS');
select ok(not has_table_privilege('anon', 'public.latest_traffic_observations', 'SELECT'), 'anonymous role cannot read latest observations');
select ok(not has_table_privilege('anon', 'public.traffic_observations', 'SELECT'), 'anonymous role cannot read observation rows');
select ok(has_column_privilege('authenticated', 'public.traffic_observations', 'condition', 'INSERT'), 'authenticated role can submit condition on RLS-authorized observations');
select ok(has_column_privilege('authenticated', 'public.traffic_observations', 'condition', 'UPDATE'), 'authenticated role can update condition on RLS-authorized observations');
select ok((select relrowsecurity from pg_class where oid = 'public.traffic_observations'::regclass), 'observation row security remains enabled');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'traffic_observations' and policyname = 'traffic_observations_manager_select'), 'authorized-agency select policy remains installed');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'traffic_observations' and policyname = 'traffic_observations_manager_insert'), 'authorized-agency insert policy remains installed');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'traffic_observations' and policyname = 'traffic_observations_manager_update'), 'authorized-agency update policy remains installed');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'traffic_observations' and policyname = 'traffic_observations_admin_delete'), 'administrator-only delete policy remains installed');
select ok((select count(*) = 1 from pg_constraint where conrelid = 'public.traffic_observations'::regclass and conname = 'traffic_observations_nonnegative_counts'), 'nonnegative count constraint remains installed');
select ok((select count(*) = 1 from pg_constraint where conrelid = 'public.traffic_observations'::regclass and conname = 'traffic_observations_time_window'), 'observation time-window constraint remains installed');
select ok((select count(*) = 1 from pg_indexes where schemaname = 'public' and tablename = 'traffic_observations' and indexname = 'traffic_observations_cctv_window_idx'), 'CCTV history index remains installed');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'latest_traffic_observations' and column_name in ('source_uri', 'credential_reference')), 'latest view contains no private video configuration');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.traffic_observations (cctv_id, window_started_at, window_ended_at, counting_method, processing_status, source_kind, condition) values ('bbbbbbbb-1111-1111-1111-000000000001', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'good')$$, 'agency editor can create a manual observation for assigned agency');
select results_eq($$select condition::text from public.latest_traffic_observations where cctv_id = 'bbbbbbbb-1111-1111-1111-000000000001'$$, $$values ('good'::text)$$, 'assigned editor sees the persisted condition through RLS-scoped latest view');
select throws_matching($$insert into public.traffic_observations (cctv_id, window_started_at, window_ended_at, counting_method, processing_status, source_kind, condition) values ('bbbbbbbb-1111-1111-1111-000000000002', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'poor')$$, 'row-level security', 'agency editor cannot record observations for unrelated agency');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.traffic_observations (cctv_id, window_started_at, window_ended_at, counting_method, processing_status, source_kind, condition) values ('bbbbbbbb-1111-1111-1111-000000000002', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'average')$$, 'administrator can record an observation across agencies');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select * from public.latest_traffic_observations$$, '42501', null, 'anonymous cannot query private latest-observation view');

select * from finish();
rollback;
