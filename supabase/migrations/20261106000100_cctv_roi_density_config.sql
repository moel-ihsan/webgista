begin;

create function private.is_valid_roi_density_config(config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  roi jsonb;
  point jsonb;
  thresholds jsonb;
  classes jsonb;
  x_values numeric[] := array[]::numeric[];
  y_values numeric[] := array[]::numeric[];
  x numeric;
  y numeric;
  area numeric := 0;
  left_index integer;
  right_index integer;
  vertex_count integer;
  previous numeric;
  current numeric;
  o1 numeric;
  o2 numeric;
  o3 numeric;
  o4 numeric;
begin
  if pg_catalog.jsonb_typeof(config) is distinct from 'object'
     or config ->> 'schema_version' is distinct from 'webgista.roi-density-config.v1'
     or coalesce(config ->> 'roi_type', '') not in ('rectangle', 'polygon')
     or pg_catalog.jsonb_typeof(config -> 'video_dimensions') is distinct from 'object'
     or pg_catalog.jsonb_typeof(config -> 'included_classes') is distinct from 'array'
     or coalesce(pg_catalog.jsonb_typeof(config -> 'density_thresholds'), 'missing') not in ('array', 'null')
     or coalesce(config ->> 'calibration_status', '') not in ('uncalibrated', 'experimental', 'calibrated') then
    return false;
  end if;

  if coalesce(config -> 'video_dimensions' ->> 'width', '') !~ '^[1-9][0-9]*$'
     or coalesce(config -> 'video_dimensions' ->> 'height', '') !~ '^[1-9][0-9]*$'
     or pg_catalog.jsonb_typeof(config -> 'video_dimensions' -> 'width') is distinct from 'number'
     or pg_catalog.jsonb_typeof(config -> 'video_dimensions' -> 'height') is distinct from 'number'
     or pg_catalog.jsonb_typeof(config -> 'observation_window_seconds') is distinct from 'number'
     or pg_catalog.jsonb_typeof(config -> 'refresh_seconds') is distinct from 'number'
     or coalesce(config ->> 'observation_window_seconds', '') !~ '^[1-9][0-9]*$'
     or coalesce(config ->> 'refresh_seconds', '') !~ '^[1-9][0-9]*$'
     or pg_catalog.jsonb_typeof(config -> 'sampled_fps') is distinct from 'number'
     or pg_catalog.jsonb_typeof(config -> 'minimum_detection_confidence') is distinct from 'number'
     or pg_catalog.jsonb_typeof(config -> 'busy_threshold_vehicles') is distinct from 'number'
     or coalesce(config ->> 'busy_threshold_vehicles', '') !~ '^[0-9]+$'
     or pg_catalog.jsonb_typeof(config -> 'minimum_valid_coverage') is distinct from 'number'
     or (config -> 'video_dimensions' ->> 'width')::integer <= 0
     or (config -> 'video_dimensions' ->> 'height')::integer <= 0
     or (config ->> 'observation_window_seconds')::numeric not between 1 and 300
     or (config ->> 'refresh_seconds')::numeric not between 1 and 300
     or (config ->> 'refresh_seconds')::numeric > (config ->> 'observation_window_seconds')::numeric
     or (config ->> 'sampled_fps')::numeric not between 0.1 and 10
     or (config ->> 'minimum_detection_confidence')::numeric not between 0 and 1
     or (config ->> 'busy_threshold_vehicles')::integer < 0
     or (config ->> 'minimum_valid_coverage')::numeric not between 0.5 and 1 then
    return false;
  end if;

  roi := config -> 'roi_geometry';
  if pg_catalog.jsonb_typeof(roi) <> 'array'
     or (config ->> 'roi_type' = 'rectangle' and pg_catalog.jsonb_array_length(roi) <> 4)
     or (config ->> 'roi_type' = 'polygon' and pg_catalog.jsonb_array_length(roi) not between 3 and 64) then
    return false;
  end if;

  if config ->> 'roi_type' = 'rectangle' then
    if pg_catalog.jsonb_typeof(roi -> 0) is distinct from 'number'
       or pg_catalog.jsonb_typeof(roi -> 1) is distinct from 'number'
       or pg_catalog.jsonb_typeof(roi -> 2) is distinct from 'number'
       or pg_catalog.jsonb_typeof(roi -> 3) is distinct from 'number'
       or (roi ->> 0)::numeric < 0 or (roi ->> 1)::numeric < 0
       or (roi ->> 2)::numeric <= 0 or (roi ->> 3)::numeric <= 0
       or (roi ->> 0)::numeric + (roi ->> 2)::numeric > 1
       or (roi ->> 1)::numeric + (roi ->> 3)::numeric > 1 then
      return false;
    end if;
  else
    vertex_count := pg_catalog.jsonb_array_length(roi);
    for point in select value from pg_catalog.jsonb_array_elements(roi) loop
      if pg_catalog.jsonb_typeof(point) <> 'array' or pg_catalog.jsonb_array_length(point) <> 2 then return false; end if;
      if pg_catalog.jsonb_typeof(point -> 0) is distinct from 'number'
         or pg_catalog.jsonb_typeof(point -> 1) is distinct from 'number' then return false; end if;
      x := (point ->> 0)::numeric;
      y := (point ->> 1)::numeric;
      if x not between 0 and 1 or y not between 0 and 1 then return false; end if;
      x_values := pg_catalog.array_append(x_values, x);
      y_values := pg_catalog.array_append(y_values, y);
    end loop;
    for left_index in 1..vertex_count loop
      right_index := left_index % vertex_count + 1;
      if x_values[left_index] = x_values[right_index] and y_values[left_index] = y_values[right_index] then return false; end if;
      area := area + x_values[left_index] * y_values[right_index] - x_values[right_index] * y_values[left_index];
    end loop;
    if pg_catalog.abs(area) <= 0.00000001 then return false; end if;
    -- Reject crossings, touches, and overlaps between non-adjacent polygon edges.
    for left_index in 1..vertex_count loop
      for right_index in left_index + 1..vertex_count loop
        if right_index = left_index + 1 or (left_index = 1 and right_index = vertex_count) then continue; end if;
        o1 := (x_values[left_index % vertex_count + 1] - x_values[left_index]) * (y_values[right_index] - y_values[left_index])
          - (y_values[left_index % vertex_count + 1] - y_values[left_index]) * (x_values[right_index] - x_values[left_index]);
        o2 := (x_values[left_index % vertex_count + 1] - x_values[left_index]) * (y_values[right_index % vertex_count + 1] - y_values[left_index])
          - (y_values[left_index % vertex_count + 1] - y_values[left_index]) * (x_values[right_index % vertex_count + 1] - x_values[left_index]);
        o3 := (x_values[right_index % vertex_count + 1] - x_values[right_index]) * (y_values[left_index] - y_values[right_index])
          - (y_values[right_index % vertex_count + 1] - y_values[right_index]) * (x_values[left_index] - x_values[right_index]);
        o4 := (x_values[right_index % vertex_count + 1] - x_values[right_index]) * (y_values[left_index % vertex_count + 1] - y_values[right_index])
          - (y_values[right_index % vertex_count + 1] - y_values[right_index]) * (x_values[left_index % vertex_count + 1] - x_values[right_index]);
        if (o1 * o2 < 0 and o3 * o4 < 0)
          or (o1 = 0 and x_values[right_index] between least(x_values[left_index], x_values[left_index % vertex_count + 1]) and greatest(x_values[left_index], x_values[left_index % vertex_count + 1])
            and y_values[right_index] between least(y_values[left_index], y_values[left_index % vertex_count + 1]) and greatest(y_values[left_index], y_values[left_index % vertex_count + 1]))
          or (o2 = 0 and x_values[right_index % vertex_count + 1] between least(x_values[left_index], x_values[left_index % vertex_count + 1]) and greatest(x_values[left_index], x_values[left_index % vertex_count + 1])
            and y_values[right_index % vertex_count + 1] between least(y_values[left_index], y_values[left_index % vertex_count + 1]) and greatest(y_values[left_index], y_values[left_index % vertex_count + 1]))
          or (o3 = 0 and x_values[left_index] between least(x_values[right_index], x_values[right_index % vertex_count + 1]) and greatest(x_values[right_index], x_values[right_index % vertex_count + 1])
            and y_values[left_index] between least(y_values[right_index], y_values[right_index % vertex_count + 1]) and greatest(y_values[right_index], y_values[right_index % vertex_count + 1]))
          or (o4 = 0 and x_values[left_index % vertex_count + 1] between least(x_values[right_index], x_values[right_index % vertex_count + 1]) and greatest(x_values[right_index], x_values[right_index % vertex_count + 1])
            and y_values[left_index % vertex_count + 1] between least(y_values[right_index], y_values[right_index % vertex_count + 1]) and greatest(y_values[right_index], y_values[right_index % vertex_count + 1])) then
          return false;
        end if;
      end loop;
    end loop;
  end if;

  classes := config -> 'included_classes';
  if pg_catalog.jsonb_array_length(classes) = 0
     or pg_catalog.jsonb_array_length(classes) <> (
       select pg_catalog.count(distinct value #>> '{}') from pg_catalog.jsonb_array_elements(classes)
     ) then return false; end if;
  for point in select value from pg_catalog.jsonb_array_elements(classes) loop
    if pg_catalog.jsonb_typeof(point) <> 'string' or point #>> '{}' not in ('car', 'bus', 'truck', 'motorcycle', 'bicycle') then return false; end if;
  end loop;

  thresholds := config -> 'density_thresholds';
  if pg_catalog.jsonb_typeof(thresholds) = 'array' then
    if pg_catalog.jsonb_array_length(thresholds) <> 5 then return false; end if;
    previous := -1;
    for point in select value from pg_catalog.jsonb_array_elements(thresholds) loop
      if pg_catalog.jsonb_typeof(point) is distinct from 'number' then return false; end if;
      current := (point #>> '{}')::numeric;
      if current < 0 or current <= previous then return false; end if;
      previous := current;
    end loop;
  elsif config ->> 'calibration_status' <> 'uncalibrated' then
    return false;
  end if;
  if config ->> 'calibration_status' = 'calibrated'
     and pg_catalog.char_length(pg_catalog.btrim(coalesce(config ->> 'calibration_note', ''))) < 12 then
    return false;
  end if;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_roi_density_config(jsonb) from public, anon;
grant execute on function private.is_valid_roi_density_config(jsonb) to authenticated;

create table public.cctv_analysis_config (
  cctv_id uuid primary key references public.cctv_locations(id) on delete cascade,
  configuration jsonb not null,
  configuration_version integer not null default 1 check (configuration_version > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cctv_analysis_config_contract check (private.is_valid_roi_density_config(configuration))
);

create function private.set_cctv_analysis_config_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authenticated CCTV manager required';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.configuration_version := 1;
  else
    new.created_by := old.created_by;
    new.configuration_version := old.configuration_version + 1;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_cctv_analysis_config_actor() from public, anon, authenticated;
create trigger cctv_analysis_config_set_actor
before insert or update on public.cctv_analysis_config
for each row execute function private.set_cctv_analysis_config_actor();

alter table public.cctv_analysis_config enable row level security;
revoke all on table public.cctv_analysis_config from public, anon, authenticated;
grant select on table public.cctv_analysis_config to authenticated;
grant insert (cctv_id, configuration) on table public.cctv_analysis_config to authenticated;
grant update (configuration) on table public.cctv_analysis_config to authenticated;

create policy cctv_analysis_config_manager_select
on public.cctv_analysis_config for select to authenticated
using (exists (
  select 1 from public.cctv_locations as cameras
  where cameras.id = cctv_id and (select private.can_manage_agency(cameras.agency_id))
));

create policy cctv_analysis_config_manager_insert
on public.cctv_analysis_config for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.cctv_locations as cameras
    where cameras.id = cctv_id and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy cctv_analysis_config_manager_update
on public.cctv_analysis_config for update to authenticated
using (exists (
  select 1 from public.cctv_locations as cameras
  where cameras.id = cctv_id and (select private.can_manage_agency(cameras.agency_id))
))
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.cctv_locations as cameras
    where cameras.id = cctv_id and (select private.can_manage_agency(cameras.agency_id))
  )
);

comment on table public.cctv_analysis_config is 'Private per-camera ROI density analysis settings; separate from traffic flow/V/C and private stream credentials.';

commit;
