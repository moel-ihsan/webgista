begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(29);

select has_function('public', 'delete_cctv_permanently', array['uuid', 'bigint'], 'permanent CCTV deletion RPC exists');
select ok(
  (select prosecdef and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'
   from pg_catalog.pg_proc where oid = 'public.delete_cctv_permanently(uuid,bigint)'::regprocedure),
  'deletion RPC is SECURITY DEFINER with a pinned search path'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_cctv_permanently(uuid,bigint)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.delete_cctv_permanently(uuid,bigint)', 'EXECUTE')
    and not has_table_privilege('authenticated', 'public.cctv_locations', 'DELETE'),
  'only authenticated callers may invoke the guarded RPC and direct CCTV DELETE is revoked'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cctv_images_delete_managed'
      and cmd = 'DELETE' and qual ilike '%can_manage_agency%' and qual ilike '%snapshot_path%'
  ),
  'managed camera image cleanup requires authorization and no remaining camera reference'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3d1-admin@example.test', 'unused', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase3d1-editor@example.test', 'unused', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.user_roles (user_id, role) values
  ('b1000000-0000-0000-0000-000000000001', 'administrator'),
  ('b1000000-0000-0000-0000-000000000002', 'agency_editor');
insert into public.agencies (id, name, is_public) values
  ('b2000000-0000-0000-0000-000000000001', 'Phase 3D.1 QA Agency', false);
insert into public.agency_memberships (agency_id, user_id) values
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
insert into public.cctv_locations (id, agency_id, name, address, longitude, latitude, snapshot_path) values
  ('b3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'Phase 3D.1 no history', 'Disposable test fixture', 95.3, 5.5, null),
  ('b3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'Phase 3D.1 selected', 'Disposable test fixture', 95.3, 5.5, 'b3000000-0000-0000-0000-000000000002/shared.webp'),
  ('b3000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000001', 'Phase 3D.1 other camera', 'Disposable test fixture', 95.3, 5.5, 'b3000000-0000-0000-0000-000000000002/shared.webp'),
  ('b3000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000001', 'Phase 3D.1 rollback', 'Disposable test fixture', 95.3, 5.5, null),
  ('b3000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000001', 'Phase 3D.1 deactivate', 'Disposable test fixture', 95.3, 5.5, null);
insert into public.cctv_private_config (cctv_id, source_kind, source_uri) values
  ('b3000000-0000-0000-0000-000000000002', 'stored_clip', '/qa/selected.mp4'),
  ('b3000000-0000-0000-0000-000000000003', 'stored_clip', '/qa/other.mp4'),
  ('b3000000-0000-0000-0000-000000000004', 'stored_clip', '/qa/rollback.mp4');
insert into public.traffic_observations (cctv_id, window_started_at, window_ended_at, counting_method, processing_status, source_kind, condition) values
  ('b3000000-0000-0000-0000-000000000002', now() - interval '10 minutes', now() - interval '5 minutes', 'manual', 'completed', 'manual', 'good'),
  ('b3000000-0000-0000-0000-000000000002', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'average'),
  ('b3000000-0000-0000-0000-000000000003', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'poor'),
  ('b3000000-0000-0000-0000-000000000004', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'bad'),
  ('b3000000-0000-0000-0000-000000000005', now() - interval '5 minutes', now(), 'manual', 'completed', 'manual', 'great');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000001', 0)$$,
  'permission denied', 'anonymous users cannot invoke permanent CCTV deletion'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000001', 0)$$,
  'administrator authorization required', 'agency editors cannot invoke history deletion'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000001', 0)$$,
  'administrator authorization required', 'authenticated callers without a trusted user identity are rejected'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_matching(
  $$delete from public.cctv_locations where id = 'b3000000-0000-0000-0000-000000000001'$$,
  'permission denied', 'administrators must use the guarded deletion RPC'
);
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000099', 0)$$,
  'CCTV location not found', 'missing CCTV identifiers are rejected'
);
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000001', -1)$$,
  'valid CCTV id and observation count', 'negative confirmation counts are rejected'
);
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000002', 1)$$,
  'observation history changed', 'stale observation summaries cannot authorize deletion'
);
select is((select count(*) from public.cctv_locations where id = 'b3000000-0000-0000-0000-000000000002'), 1::bigint, 'stale confirmation leaves the selected camera intact');
select is((select count(*) from public.traffic_observations where cctv_id = 'b3000000-0000-0000-0000-000000000002'), 2::bigint, 'stale confirmation preserves all history');

reset role;
create table public.phase3d1_restricting_dependency (
  cctv_id uuid references public.cctv_locations (id) on delete restrict
);
insert into public.phase3d1_restricting_dependency values ('b3000000-0000-0000-0000-000000000004');
set local role authenticated;
select throws_matching(
  $$select * from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000004', 1)$$,
  'foreign key constraint', 'unreviewed restrictive dependency aborts the transaction'
);
select is((select count(*) from public.cctv_locations where id = 'b3000000-0000-0000-0000-000000000004'), 1::bigint, 'foreign-key failure rolls back camera deletion');
select is((select count(*) from public.traffic_observations where cctv_id = 'b3000000-0000-0000-0000-000000000004'), 1::bigint, 'foreign-key failure rolls back observation deletion');
select is((select count(*) from public.cctv_private_config where cctv_id = 'b3000000-0000-0000-0000-000000000004'), 1::bigint, 'foreign-key failure rolls back private-config deletion');

select is(
  (select deleted_observation_count from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000001', 0)),
  0::bigint, 'administrator deletes a CCTV with no observation history'
);
select is((select count(*) from public.cctv_locations where id = 'b3000000-0000-0000-0000-000000000001'), 0::bigint, 'dependency-free camera is removed');
select is(
  (select deleted_observation_count from public.delete_cctv_permanently('b3000000-0000-0000-0000-000000000002', 2)),
  2::bigint, 'administrator receives the exact deleted observation count'
);
select is((select count(*) from public.cctv_locations where id = 'b3000000-0000-0000-0000-000000000002'), 0::bigint, 'selected camera is removed');
select is((select count(*) from public.traffic_observations where cctv_id = 'b3000000-0000-0000-0000-000000000002'), 0::bigint, 'only selected CCTV history is deleted');
select is((select count(*) from public.cctv_private_config where cctv_id = 'b3000000-0000-0000-0000-000000000002'), 0::bigint, 'selected private video configuration is deleted');
select is((select count(*) from public.cctv_locations where id = 'b3000000-0000-0000-0000-000000000003'), 1::bigint, 'other CCTV remains intact');
select is((select count(*) from public.traffic_observations where cctv_id = 'b3000000-0000-0000-0000-000000000003'), 1::bigint, 'other CCTV history remains intact');
select is((select count(*) from public.cctv_private_config where cctv_id = 'b3000000-0000-0000-0000-000000000003'), 1::bigint, 'other CCTV private configuration remains intact');
select is((select count(*) from public.cctv_locations where snapshot_path = 'b3000000-0000-0000-0000-000000000002/shared.webp'), 1::bigint, 'shared image remains referenced by the other camera');
select is((select count(*) from public.admin_audit_events where action = 'DELETE' and entity_type = 'traffic_observations' and details ->> 'cctv_id' = 'b3000000-0000-0000-0000-000000000002'), 2::bigint, 'deleting history retains a scoped audit trail');

update public.cctv_locations set is_active = false where id = 'b3000000-0000-0000-0000-000000000005';
select is((select count(*) from public.traffic_observations where cctv_id = 'b3000000-0000-0000-0000-000000000005'), 1::bigint, 'deactivation preserves observation history');

select * from finish();
rollback;
