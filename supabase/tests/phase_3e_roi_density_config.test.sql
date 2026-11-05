begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(26);

select has_table('public', 'cctv_analysis_config', 'per-camera ROI configuration table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.cctv_analysis_config'::regclass), 'ROI settings use row-level security');
select ok(
  has_column_privilege('authenticated', 'public.cctv_analysis_config', 'cctv_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.cctv_analysis_config', 'configuration', 'INSERT')
    and has_column_privilege('authenticated', 'public.cctv_analysis_config', 'configuration', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.cctv_analysis_config', 'created_by', 'INSERT')
    and not has_column_privilege('authenticated', 'public.cctv_analysis_config', 'configuration_version', 'UPDATE')
    and not has_table_privilege('anon', 'public.cctv_analysis_config', 'SELECT'),
  'only authenticated managers receive narrow configuration writes; anonymous access and server-managed fields are denied'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'private.is_valid_roi_density_config(jsonb)'::regprocedure)
    and coalesce(array_to_string((select proconfig from pg_proc where oid = 'private.is_valid_roi_density_config(jsonb)'::regprocedure), ','), '') like '%search_path=%',
  'configuration validator is immutable invoker code with a pinned search path'
);
select ok(not private.is_valid_roi_density_config(
  '{"schema_version":"webgista.roi-density-config.v1","roi_type":"polygon","roi_geometry":[[0,0],[1,0],[1,1],[0,1],[0.5,0]],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb
), 'polygon edges that touch a non-adjacent edge are rejected');
select ok(not private.is_valid_roi_density_config(
  '{"schema_version":"webgista.roi-density-config.v1","roi_type":"rectangle","roi_geometry":[0.1,0.2,0.6,0.5],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car"],"busy_threshold_vehicles":"1.5","minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb
), 'server rejects non-integer busy thresholds and string-typed numeric values');
select ok(not private.is_valid_roi_density_config(
  '{"schema_version":"webgista.roi-density-config.v1","roi_type":"rectangle","roi_geometry":[0.1,0.2,0.6,0.5],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":11,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb
), 'refresh cadence cannot exceed the observation window');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('be000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roi-admin@example.test', 'unused', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('be000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roi-editor@example.test', 'unused', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('be000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roi-unrelated@example.test', 'unused', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.user_roles (user_id, role) values
  ('be000000-0000-0000-0000-000000000001', 'administrator'),
  ('be000000-0000-0000-0000-000000000002', 'agency_editor'),
  ('be000000-0000-0000-0000-000000000003', 'agency_editor');
insert into public.agencies (id, name, is_public) values
  ('be100000-0000-0000-0000-000000000001', 'ROI QA Agency One', false),
  ('be100000-0000-0000-0000-000000000002', 'ROI QA Agency Two', false);
insert into public.agency_memberships (agency_id, user_id) values
  ('be100000-0000-0000-0000-000000000001', 'be000000-0000-0000-0000-000000000002'),
  ('be100000-0000-0000-0000-000000000002', 'be000000-0000-0000-0000-000000000003');
insert into public.cctv_locations (id, agency_id, name, address, longitude, latitude) values
  ('be200000-0000-0000-0000-000000000001', 'be100000-0000-0000-0000-000000000001', 'ROI own camera', 'QA', 95.3, 5.5),
  ('be200000-0000-0000-0000-000000000002', 'be100000-0000-0000-0000-000000000002', 'ROI other camera', 'QA', 95.3, 5.5),
  ('be200000-0000-0000-0000-000000000003', 'be100000-0000-0000-0000-000000000001', 'ROI editor camera', 'QA', 95.3, 5.5);

select set_config('request.jwt.claims', '{"sub":"be000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.cctv_analysis_config (cctv_id, configuration) values (
  'be200000-0000-0000-0000-000000000001',
  '{"schema_version":"webgista.roi-density-config.v1","roi_type":"rectangle","roi_geometry":[0.1,0.2,0.6,0.5],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car","bus","truck","motorcycle","bicycle"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb
)$$, 'administrator creates a valid normalized ROI configuration');
select is((select created_by from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000001'), 'be000000-0000-0000-0000-000000000001'::uuid, 'creator identity is supplied by the database trigger');
select is((select configuration_version from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000001'), 1, 'new configuration starts at version one');
select throws_matching($$update public.cctv_analysis_config set configuration_version = 99 where cctv_id = 'be200000-0000-0000-0000-000000000001'$$, 'permission denied', 'clients cannot set the server-managed configuration version');
select throws_matching($$insert into public.cctv_analysis_config (cctv_id, configuration) values ('be200000-0000-0000-0000-000000000002', '{"schema_version":"webgista.roi-density-config.v1","roi_type":"polygon","roi_geometry":[[0,0],[1,1],[0,1],[1,0]],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb)$$, 'check constraint', 'self-intersecting polygon is rejected at the database boundary');
select lives_ok($$update public.cctv_analysis_config set configuration = jsonb_set(configuration, '{busy_threshold_vehicles}', '1'::jsonb) where cctv_id = 'be200000-0000-0000-0000-000000000001'$$, 'administrator can update the saved ROI settings');
select is((select configuration_version from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000001'), 2, 'administrator update increments the server-managed version');

reset role;
select set_config('request.jwt.claims', '{"sub":"be000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.cctv_analysis_config (cctv_id, configuration) values (
  'be200000-0000-0000-0000-000000000003',
  '{"schema_version":"webgista.roi-density-config.v1","roi_type":"polygon","roi_geometry":[[0.1,0.1],[0.9,0.1],[0.8,0.9],[0.1,0.8]],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car","motorcycle"],"busy_threshold_vehicles":2,"minimum_valid_coverage":0.8,"density_thresholds":[1,2,3,4,5],"calibration_status":"experimental","calibration_note":""}'::jsonb
)$$, 'agency editor creates ROI configuration for an assigned camera');
select is((select updated_by from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000003'), 'be000000-0000-0000-0000-000000000002'::uuid, 'agency editor identity is recorded by the database');
select is((select configuration_version from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000003'), 1, 'editor initial configuration version is one');
select is((select count(*) from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000002'), 0::bigint, 'agency editor cannot read unrelated agency ROI settings');
select throws_matching($$insert into public.cctv_analysis_config (cctv_id, configuration) values ('be200000-0000-0000-0000-000000000002', '{"schema_version":"webgista.roi-density-config.v1","roi_type":"rectangle","roi_geometry":[0.1,0.2,0.6,0.5],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb)$$, 'row-level security', 'agency editor cannot configure a CCTV in another agency');
select lives_ok($$update public.cctv_analysis_config set configuration = jsonb_set(configuration, '{busy_threshold_vehicles}', '3'::jsonb) where cctv_id = 'be200000-0000-0000-0000-000000000003'$$, 'agency editor updates configuration for their assigned CCTV');
select is((select configuration_version from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000003'), 2, 'database increments configuration version on update');

reset role;
select set_config('request.jwt.claims', '{"sub":"be000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_matching($$update public.cctv_analysis_config set configuration = configuration where cctv_id = 'be200000-0000-0000-0000-000000000003'$$, 'row-level security', 'editor from another agency cannot modify ROI configuration');

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_matching($$select * from public.cctv_analysis_config$$, 'permission denied', 'anonymous users cannot read private ROI configurations');
select throws_matching($$insert into public.cctv_analysis_config (cctv_id, configuration) values ('be200000-0000-0000-0000-000000000001', '{}'::jsonb)$$, 'permission denied', 'anonymous users cannot create ROI configurations');
select throws_matching($$update public.cctv_analysis_config set configuration = '{}'::jsonb$$, 'permission denied', 'anonymous users cannot update ROI configurations');

reset role;
delete from public.cctv_locations where id = 'be200000-0000-0000-0000-000000000003';
select is((select count(*) from public.cctv_analysis_config where cctv_id = 'be200000-0000-0000-0000-000000000003'), 0::bigint, 'camera deletion removes only its dependent analysis configuration');

select * from finish();
rollback;
