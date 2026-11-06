begin;

create table public.cctv_roi_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  cctv_id uuid not null references public.cctv_locations(id) on delete cascade,
  source_video_identifier text not null,
  source_video_sha256 text,
  detection_artifact_version text not null,
  configuration_version integer not null check (configuration_version > 0),
  analysis_method_version text not null,
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object' and pg_column_size(provenance) <= 4096),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'superseded')),
  failure_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create unique index cctv_roi_analysis_jobs_idempotency
on public.cctv_roi_analysis_jobs (cctv_id, source_video_identifier, coalesce(source_video_sha256, ''), detection_artifact_version, configuration_version, analysis_method_version);

create table public.cctv_roi_analysis_results (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.cctv_roi_analysis_jobs(id) on delete cascade,
  window_started_at_seconds numeric not null check (window_started_at_seconds >= 0),
  window_ended_at_seconds numeric not null check (window_ended_at_seconds > window_started_at_seconds),
  summary jsonb not null check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 16384),
  created_at timestamptz not null default now(),
  unique (job_id, window_started_at_seconds)
);

alter table public.cctv_roi_analysis_jobs enable row level security;
alter table public.cctv_roi_analysis_results enable row level security;
revoke all on public.cctv_roi_analysis_jobs, public.cctv_roi_analysis_results from public, anon, authenticated;
grant select on public.cctv_roi_analysis_jobs, public.cctv_roi_analysis_results to authenticated;
grant all on public.cctv_roi_analysis_jobs, public.cctv_roi_analysis_results to service_role;
grant usage, select on sequence public.cctv_roi_analysis_results_id_seq to service_role;

create policy cctv_roi_analysis_jobs_manager_read
on public.cctv_roi_analysis_jobs for select to authenticated
using (exists (
  select 1 from public.cctv_locations camera
  where camera.id = cctv_id and (select private.can_manage_agency(camera.agency_id))
));

create policy cctv_roi_analysis_results_manager_read
on public.cctv_roi_analysis_results for select to authenticated
using (exists (
  select 1 from public.cctv_roi_analysis_jobs job
  join public.cctv_locations camera on camera.id = job.cctv_id
  where job.id = cctv_roi_analysis_results.job_id and (select private.can_manage_agency(camera.agency_id))
));

create function private.supersede_stale_roi_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cctv_roi_analysis_jobs
  set status = 'superseded', finished_at = pg_catalog.now(), failure_reason = 'ROI configuration changed.'
  where cctv_id = new.cctv_id and configuration_version < new.configuration_version
    and status in ('pending', 'processing', 'completed', 'failed');
  return new;
end;
$$;
revoke all on function private.supersede_stale_roi_jobs() from public, anon, authenticated;

create trigger cctv_analysis_config_supersede_jobs
after update of configuration, configuration_version on public.cctv_analysis_config
for each row execute function private.supersede_stale_roi_jobs();

create function private.supersede_roi_jobs_on_video_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cctv uuid;
begin
  if tg_op = 'DELETE' then
    target_cctv := old.cctv_id;
  else
    target_cctv := new.cctv_id;
  end if;
  if tg_op = 'UPDATE' then
    if new.source_kind is not distinct from old.source_kind and new.source_uri is not distinct from old.source_uri then return new; end if;
  end if;
  update public.cctv_roi_analysis_jobs
  set status = 'superseded', finished_at = pg_catalog.now(), failure_reason = 'Associated video source changed.'
  where cctv_id = target_cctv
    and status in ('pending', 'processing', 'completed', 'failed');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.supersede_roi_jobs_on_video_change() from public, anon, authenticated;
create trigger cctv_private_config_supersede_roi_jobs
after insert or update or delete on public.cctv_private_config
for each row execute function private.supersede_roi_jobs_on_video_change();

create function public.complete_cctv_roi_analysis_job(p_job_id uuid, p_windows jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.cctv_roi_analysis_jobs%rowtype;
  current_version integer;
  window_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_windows is null or pg_catalog.jsonb_typeof(p_windows) is distinct from 'array' or pg_catalog.pg_column_size(p_windows) > 49152 then
    raise exception using errcode = '22023', message = 'invalid ROI result payload';
  end if;
  window_count := pg_catalog.jsonb_array_length(p_windows);
  if window_count > 3 then
    raise exception using errcode = '22023', message = 'too many ROI result windows';
  end if;

  select configuration_version into current_version
  from public.cctv_analysis_config
  where cctv_id = (select cctv_id from public.cctv_roi_analysis_jobs where id = p_job_id)
  for update;
  select * into job_row from public.cctv_roi_analysis_jobs where id = p_job_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROI analysis job not found'; end if;
  if current_version is distinct from job_row.configuration_version then
    update public.cctv_roi_analysis_jobs set status = 'superseded', finished_at = pg_catalog.now(), failure_reason = 'ROI configuration changed before publication.' where id = p_job_id;
    return 'superseded';
  end if;
  if job_row.status = 'superseded' then return 'superseded'; end if;
  if job_row.status not in ('processing', 'pending') then
    raise exception using errcode = '55000', message = 'ROI analysis job is not publishable';
  end if;
  delete from public.cctv_roi_analysis_results where job_id = p_job_id;
  insert into public.cctv_roi_analysis_results (job_id, window_started_at_seconds, window_ended_at_seconds, summary)
  select p_job_id, item.window_started_at_seconds, item.window_ended_at_seconds, item.summary
  from pg_catalog.jsonb_to_recordset(p_windows) as item(window_started_at_seconds numeric, window_ended_at_seconds numeric, summary jsonb);
  update public.cctv_roi_analysis_jobs set status = 'completed', finished_at = pg_catalog.now(), failure_reason = null where id = p_job_id;
  return 'completed';
end;
$$;
revoke all on function public.complete_cctv_roi_analysis_job(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_cctv_roi_analysis_job(uuid, jsonb) to service_role;

comment on table public.cctv_roi_analysis_jobs is 'Authorized ROI reaggregation jobs. Demo outputs remain experimental and are not traffic observations.';
comment on table public.cctv_roi_analysis_results is 'Compact per-window ROI summaries; raw videos and per-frame detections are stored separately.';

commit;
