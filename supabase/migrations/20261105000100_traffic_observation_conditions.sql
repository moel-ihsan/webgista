create type public.traffic_condition as enum (
  'terrible',
  'bad',
  'poor',
  'average',
  'good',
  'great'
);

alter table public.traffic_observations
  add column condition public.traffic_condition;

grant insert (condition) on table public.traffic_observations to authenticated;
grant update (condition) on table public.traffic_observations to authenticated;

create view public.latest_traffic_observations
with (security_invoker = true)
as
select distinct on (cctv_id)
  id, cctv_id, window_started_at, window_ended_at, counting_method,
  processing_status, source_kind, condition, light_vehicle_count,
  heavy_vehicle_count, motorcycle_count, bicycle_count, sampled_frames,
  quality_flags
from public.traffic_observations
where processing_status = 'completed'
order by cctv_id, window_ended_at desc, id desc;

grant select on public.latest_traffic_observations to authenticated;

comment on column public.traffic_observations.condition is
  'Recorded condition for this observation; NULL represents no reported condition.';
