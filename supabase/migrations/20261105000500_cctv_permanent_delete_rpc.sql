begin;

revoke delete on table public.cctv_locations from authenticated;

drop policy cctv_images_delete_managed on storage.objects;
create policy cctv_images_delete_managed
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cctv-images'
  and exists (
    select 1 from public.cctv_locations as cameras
    where cameras.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.can_manage_agency(cameras.agency_id))
  )
  and not exists (
    select 1 from public.cctv_locations as cameras
    where cameras.snapshot_path = storage.objects.name
  )
);

create function public.delete_cctv_permanently(
  p_cctv_id uuid,
  p_expected_observation_count bigint
)
returns table (
  deleted_cctv_id uuid,
  deleted_observation_count bigint,
  deleted_private_config boolean,
  snapshot_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  camera_snapshot_path text;
  actual_observation_count bigint;
  removed_observation_count bigint;
  removed_config_count bigint;
  removed_camera_count bigint;
begin
  if caller_id is null or not (select private.is_administrator()) then
    raise exception using errcode = '42501', message = 'administrator authorization required';
  end if;
  if p_cctv_id is null or p_expected_observation_count is null or p_expected_observation_count < 0 then
    raise exception using errcode = '22023', message = 'valid CCTV id and observation count are required';
  end if;

  select cameras.snapshot_path
  into camera_snapshot_path
  from public.cctv_locations as cameras
  where cameras.id = p_cctv_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CCTV location not found';
  end if;

  select count(*)
  into actual_observation_count
  from public.traffic_observations as observations
  where observations.cctv_id = p_cctv_id;

  if actual_observation_count <> p_expected_observation_count then
    raise exception using errcode = '40001', message = 'CCTV observation history changed; review the deletion summary and try again';
  end if;

  delete from public.traffic_observations as observations
  where observations.cctv_id = p_cctv_id;
  get diagnostics removed_observation_count = row_count;

  delete from public.cctv_private_config as config
  where config.cctv_id = p_cctv_id;
  get diagnostics removed_config_count = row_count;

  delete from public.cctv_locations as cameras
  where cameras.id = p_cctv_id;
  get diagnostics removed_camera_count = row_count;

  if removed_camera_count <> 1 or removed_observation_count <> actual_observation_count then
    raise exception using errcode = '40001', message = 'CCTV deletion did not remove the reviewed records';
  end if;

  return query select p_cctv_id, removed_observation_count, removed_config_count > 0, camera_snapshot_path;
end;
$$;

revoke all on function public.delete_cctv_permanently(uuid, bigint) from public, anon;
grant execute on function public.delete_cctv_permanently(uuid, bigint) to authenticated;

commit;
