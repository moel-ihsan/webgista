with expected as (
  select
    'WebGISTA DEV — Testing'::text as agency_name,
    'TEST — CCTV Simpang Jambo Tape'::text as camera_name,
    'Simpang Jambo Tape, Banda Aceh, Aceh'::text as address,
    95.330911::numeric as longitude,
    5.559729::numeric as latitude
), supported_migrations(version) as (
  -- Exact schema contract for this disposable fixture; update deliberately with approved migrations.
  values
    ('20261103000100'),
    ('20261103000200'),
    ('20261104000100'),
    ('20261104000200'),
    ('20261104000300'),
    ('20261104000400')
), migration_state as (
  select
    not exists (
      select 1
      from supabase_migrations.schema_migrations as applied
      where not exists (
        select 1 from supported_migrations as supported where supported.version = applied.version
      )
    )
    and not exists (
      select 1
      from supported_migrations as supported
      where not exists (
        select 1 from supabase_migrations.schema_migrations as applied where applied.version = supported.version
      )
    ) as ready
), agency_matches as materialized (
  select agency.id, agency.name, agency.is_public
  from public.agencies as agency
  cross join expected
  where lower(trim(agency.name)) = lower(trim(expected.agency_name))
), camera_matches as materialized (
  select
    camera.id,
    camera.agency_id,
    camera.name,
    camera.address,
    camera.category,
    camera.longitude,
    camera.latitude,
    camera.is_active,
    camera.is_public
  from public.cctv_locations as camera
  cross join expected
  where lower(trim(camera.name)) = lower(trim(expected.camera_name))
), agency_state as (
  select
    (select count(*) <= 1 from agency_matches)
      and (
        not exists (select 1 from agency_matches)
        or exists (
          select 1 from agency_matches, expected
          where agency_matches.name = expected.agency_name
            and not agency_matches.is_public
        )
      ) as ready
), camera_state as (
  select
    (select count(*) <= 1 from camera_matches)
      and (
        not exists (select 1 from camera_matches)
        or exists (
          select 1
          from camera_matches, expected
          where camera_matches.name = expected.camera_name
            and camera_matches.address = expected.address
            and camera_matches.category = 'regular'::public.camera_category
            and camera_matches.longitude = expected.longitude
            and camera_matches.latitude = expected.latitude
            and camera_matches.is_active
            and not camera_matches.is_public
            and camera_matches.agency_id in (select id from agency_matches)
        )
      ) as ready
), preflight as (
  select
    migration_state.ready as migrations_ready,
    agency_state.ready as agency_ready,
    camera_state.ready as camera_ready,
    migration_state.ready and agency_state.ready and camera_state.ready as ready
  from migration_state, agency_state, camera_state
), inserted_agency as (
  insert into public.agencies (name, is_public)
  select expected.agency_name, false
  from expected, preflight
  where preflight.ready
    and not exists (select 1 from agency_matches)
  on conflict do nothing
  returning id
), target_agency as (
  select id from inserted_agency
  union all
  select agency_matches.id
  from agency_matches
  where not exists (select 1 from inserted_agency)
), inserted_camera as (
  insert into public.cctv_locations (
    agency_id,
    name,
    address,
    category,
    longitude,
    latitude,
    is_active,
    is_public
  )
  select
    target_agency.id,
    expected.camera_name,
    expected.address,
    'regular'::public.camera_category,
    expected.longitude,
    expected.latitude,
    true,
    false
  from target_agency, expected, preflight
  where preflight.ready
    and not exists (select 1 from camera_matches)
  on conflict do nothing
  returning id
), target_camera as (
  select id from inserted_camera
  union all
  select camera_matches.id
  from camera_matches
  where not exists (select 1 from inserted_camera)
)
select
  case
    when preflight.ready
      and (select count(*) from target_agency) = 1
      and (select count(*) from target_camera) = 1
      then 'phase2d_fixture_ready'
    else 'phase2d_fixture_blocked'
  end as status,
  preflight.migrations_ready,
  preflight.agency_ready,
  preflight.camera_ready,
  (select id from target_agency limit 1) as agency_id,
  exists (select 1 from inserted_agency) as agency_created,
  (select id from target_camera limit 1) as cctv_id,
  exists (select 1 from inserted_camera) as cctv_created
from preflight;
