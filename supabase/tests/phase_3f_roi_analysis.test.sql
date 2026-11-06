begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(27);

select has_table('public', 'cctv_roi_analysis_jobs', 'analysis jobs table exists');
select has_table('public', 'cctv_roi_analysis_results', 'compact result table exists');
select has_column('public', 'cctv_roi_analysis_jobs', 'provenance', 'jobs retain source and model provenance');
select ok((select relrowsecurity from pg_class where oid = 'public.cctv_roi_analysis_jobs'::regclass), 'job rows use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.cctv_roi_analysis_results'::regclass), 'result rows use RLS');
select ok(not has_table_privilege('authenticated', 'public.cctv_roi_analysis_jobs', 'INSERT') and not has_table_privilege('authenticated', 'public.cctv_roi_analysis_jobs', 'UPDATE') and not has_table_privilege('anon', 'public.cctv_roi_analysis_jobs', 'SELECT'), 'clients cannot schedule or mutate jobs directly and anonymous cannot read jobs');
select ok(not has_table_privilege('authenticated', 'public.cctv_roi_analysis_results', 'INSERT') and not has_table_privilege('anon', 'public.cctv_roi_analysis_results', 'SELECT'), 'analysis results are backend-written and not anonymous-readable');
select ok((select prosecdef and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%' from pg_proc where oid = 'public.complete_cctv_roi_analysis_job(uuid,jsonb)'::regprocedure), 'publication RPC is SECURITY DEFINER with a pinned search path');
select ok(has_function_privilege('service_role', 'public.complete_cctv_roi_analysis_job(uuid,jsonb)', 'EXECUTE') and not has_function_privilege('authenticated', 'public.complete_cctv_roi_analysis_job(uuid,jsonb)', 'EXECUTE') and not has_function_privilege('anon', 'public.complete_cctv_roi_analysis_job(uuid,jsonb)', 'EXECUTE'), 'only the backend service role can publish analysis results');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
 ('bf000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','roi3f-admin@example.test','unused',now(),now(),now(),'{}','{}'),
 ('bf000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','roi3f-editor@example.test','unused',now(),now(),now(),'{}','{}'),
 ('bf000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','roi3f-other@example.test','unused',now(),now(),now(),'{}','{}');
insert into public.user_roles (user_id, role) values ('bf000000-0000-0000-0000-000000000001','administrator'), ('bf000000-0000-0000-0000-000000000002','agency_editor'), ('bf000000-0000-0000-0000-000000000003','agency_editor');
insert into public.agencies (id, name, is_public) values ('bf100000-0000-0000-0000-000000000001','ROI 3F Agency One',false), ('bf100000-0000-0000-0000-000000000002','ROI 3F Agency Two',false);
insert into public.agency_memberships (agency_id,user_id) values ('bf100000-0000-0000-0000-000000000001','bf000000-0000-0000-0000-000000000002'), ('bf100000-0000-0000-0000-000000000002','bf000000-0000-0000-0000-000000000003');
insert into public.cctv_locations (id,agency_id,name,address,longitude,latitude) values
 ('bf200000-0000-0000-0000-000000000001','bf100000-0000-0000-0000-000000000001','ROI 3F A','QA',95.3,5.5),
 ('bf200000-0000-0000-0000-000000000002','bf100000-0000-0000-0000-000000000002','ROI 3F B','QA',95.3,5.5);
select set_config('request.jwt.claims','{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.cctv_analysis_config (cctv_id,configuration)
select 'bf200000-0000-0000-0000-000000000001'::uuid,
       '{"schema_version":"webgista.roi-density-config.v1","roi_type":"rectangle","roi_geometry":[0.1,0.2,0.6,0.5],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car","motorcycle","bus","truck"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb
union all
select 'bf200000-0000-0000-0000-000000000002'::uuid,
       '{"schema_version":"webgista.roi-density-config.v1","roi_type":"rectangle","roi_geometry":[0.1,0.2,0.6,0.5],"video_dimensions":{"width":1280,"height":720},"observation_window_seconds":10,"refresh_seconds":10,"sampled_fps":5,"minimum_detection_confidence":0.35,"included_classes":["car","motorcycle","bus","truck"],"busy_threshold_vehicles":0,"minimum_valid_coverage":0.8,"density_thresholds":null,"calibration_status":"uncalibrated","calibration_note":""}'::jsonb;
reset role;
select is((select count(*) from public.cctv_analysis_config where cctv_id in ('bf200000-0000-0000-0000-000000000001','bf200000-0000-0000-0000-000000000002')),2::bigint,'QA ROI configurations exist for both cameras');
insert into public.cctv_roi_analysis_jobs(id,cctv_id,source_video_identifier,source_video_sha256,detection_artifact_version,configuration_version,analysis_method_version,status,created_by) values
 ('bf300000-0000-0000-0000-000000000001','bf200000-0000-0000-0000-000000000001','traffic_sample_01','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','test-artifact-v1',1,'roi_density_v1','processing','bf000000-0000-0000-0000-000000000001'),
 ('bf300000-0000-0000-0000-000000000002','bf200000-0000-0000-0000-000000000002','traffic_sample_02','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','test-artifact-v1',1,'roi_density_v1','pending','bf000000-0000-0000-0000-000000000001'),
 ('bf300000-0000-0000-0000-000000000003','bf200000-0000-0000-0000-000000000001','test-failure','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','test-artifact-v1',1,'roi_density_v1','processing','bf000000-0000-0000-0000-000000000001');
insert into public.cctv_private_config (cctv_id,source_kind,source_uri,notes) values
 ('bf200000-0000-0000-0000-000000000002','stored_clip','/traffic-demo/traffic_sample_02_annotated.mp4','QA source');

select set_config('request.jwt.claims','{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_matching($$insert into public.cctv_roi_analysis_jobs(cctv_id,source_video_identifier,configuration_version,analysis_method_version) values ('bf200000-0000-0000-0000-000000000001','traffic_sample_01',1,'roi_density_v1')$$,'permission denied','administrator cannot forge or insert backend jobs directly');
select is((select count(*) from public.cctv_roi_analysis_jobs where cctv_id='bf200000-0000-0000-0000-000000000002'),1::bigint,'administrator can read jobs across agencies');
reset role;
select set_config('request.jwt.claims','{"sub":"bf000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.cctv_roi_analysis_jobs where cctv_id='bf200000-0000-0000-0000-000000000001'),2::bigint,'agency editor can read both jobs for its own agency');
select is((select count(*) from public.cctv_roi_analysis_jobs where cctv_id='bf200000-0000-0000-0000-000000000002'),0::bigint,'agency editor cannot read a job for another agency');
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_matching($$select * from public.cctv_roi_analysis_jobs$$,'permission denied','anonymous cannot read analysis jobs');
select throws_matching($$select public.complete_cctv_roi_analysis_job('00000000-0000-0000-0000-000000000000','[]'::jsonb)$$,'permission denied','anonymous cannot publish results');
reset role;

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select throws_matching($$insert into public.cctv_roi_analysis_jobs(cctv_id,source_video_identifier,source_video_sha256,detection_artifact_version,configuration_version,analysis_method_version,status) values ('bf200000-0000-0000-0000-000000000001','traffic_sample_01','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','test-artifact-v1',1,'roi_density_v1','pending')$$,'duplicate key','same camera/source/hash/ROI/method cannot create duplicate jobs');
select is(public.complete_cctv_roi_analysis_job('bf300000-0000-0000-0000-000000000001','[{"window_started_at_seconds":0,"window_ended_at_seconds":10,"summary":{"status":"complete","average_vehicles_present":2.5,"condition":null,"configuration_version":1,"source_video_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","processed_at":"2026-11-06T00:00:00Z"}}]'::jsonb),'completed','authorized backend publishes a compact ten-second summary');
select is((select count(*) from public.cctv_roi_analysis_results where job_id='bf300000-0000-0000-0000-000000000001'),1::bigint,'window summary is persisted atomically with job completion');
select ok((select summary ? 'configuration_version' and summary ? 'source_video_sha256' and summary ? 'processed_at' from public.cctv_roi_analysis_results where job_id='bf300000-0000-0000-0000-000000000001'),'window summaries can carry source, ROI-version, and processing provenance');
select is((select status from public.cctv_roi_analysis_jobs where id='bf300000-0000-0000-0000-000000000001'),'completed','job lifecycle reaches completed');
select throws_matching($$select public.complete_cctv_roi_analysis_job('bf300000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('window_started_at_seconds',0,'window_ended_at_seconds',1,'summary','{}'::jsonb)) || jsonb_build_array(jsonb_build_object('window_started_at_seconds',1,'window_ended_at_seconds',2,'summary','{}'::jsonb)) || jsonb_build_array(jsonb_build_object('window_started_at_seconds',2,'window_ended_at_seconds',3,'summary','{}'::jsonb)) || jsonb_build_array(jsonb_build_object('window_started_at_seconds',3,'window_ended_at_seconds',4,'summary','{}'::jsonb)))$$,'too many ROI result windows','backend publication rejects oversized window batches');
select throws_matching($$select public.complete_cctv_roi_analysis_job('bf300000-0000-0000-0000-000000000003','[{"window_started_at_seconds":0,"window_ended_at_seconds":10,"summary":{}},{"window_started_at_seconds":0,"window_ended_at_seconds":10,"summary":{}}]'::jsonb)$$,'duplicate key','result constraint failure aborts publication');
select is((select status from public.cctv_roi_analysis_jobs where id='bf300000-0000-0000-0000-000000000003'),'processing','failed publication rolls the job status back atomically');
reset role;
select set_config('request.jwt.claims','{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update public.cctv_analysis_config set configuration=jsonb_set(configuration,'{busy_threshold_vehicles}','1'::jsonb) where cctv_id='bf200000-0000-0000-0000-000000000001';
select is((select status from public.cctv_roi_analysis_jobs where id='bf300000-0000-0000-0000-000000000001'),'superseded','a newer saved ROI supersedes older results');
update public.cctv_private_config set source_uri='/traffic-demo/changed-video.mp4' where cctv_id='bf200000-0000-0000-0000-000000000002';
select is((select status from public.cctv_roi_analysis_jobs where id='bf300000-0000-0000-0000-000000000002'),'superseded','changing the associated video invalidates its prior analysis');
select is((select count(*) from public.traffic_observations where cctv_id='bf200000-0000-0000-0000-000000000001'),0::bigint,'analysis publication does not create or replace manual traffic observations');

select * from finish();
rollback;
