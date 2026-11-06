begin;

-- Public projection exposes only a YouTube video ID for already-public cameras.
create view public.public_cctv_demo_streams
with (security_barrier = true, security_invoker = false)
as
select
  cameras.id as cctv_id,
  substring(config.source_uri from '^https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})$') as video_id
from public.cctv_locations as cameras
join public.agencies as agencies on agencies.id = cameras.agency_id
join public.cctv_private_config as config on config.cctv_id = cameras.id
where cameras.is_active
  and cameras.is_public
  and agencies.is_public
  and config.source_kind = 'public_https'::public.camera_source_kind
  and config.source_uri ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$';

revoke all on table public.public_cctv_demo_streams from public, anon, authenticated;
grant select on table public.public_cctv_demo_streams to anon, authenticated;

notify pgrst, 'reload schema';

commit;
