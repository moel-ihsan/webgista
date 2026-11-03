begin;

create function private.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'administrator'
  );
$$;

create function private.is_agency_editor(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as roles
    join public.agency_memberships as memberships
      on memberships.user_id = roles.user_id
    where roles.user_id = (select auth.uid())
      and roles.role = 'agency_editor'
      and memberships.agency_id = target_agency_id
  );
$$;

create function private.can_manage_agency(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_administrator())
    or (select private.is_agency_editor(target_agency_id));
$$;

revoke execute on function private.is_administrator() from public;
revoke execute on function private.is_agency_editor(uuid) from public;
revoke execute on function private.can_manage_agency(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_administrator() to authenticated;
grant execute on function private.is_agency_editor(uuid) to authenticated;
grant execute on function private.can_manage_agency(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_memberships enable row level security;
alter table public.cctv_locations enable row level security;
alter table public.cctv_private_config enable row level security;
alter table public.traffic_observations enable row level security;
alter table public.admin_audit_events enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.agencies from anon, authenticated;
revoke all on table public.agency_memberships from anon, authenticated;
revoke all on table public.cctv_locations from anon, authenticated;
revoke all on table public.cctv_private_config from anon, authenticated;
revoke all on table public.traffic_observations from anon, authenticated;
revoke all on table public.admin_audit_events from anon, authenticated;
revoke all on sequence public.admin_audit_events_id_seq from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path) on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;
grant insert (user_id, role) on table public.user_roles to authenticated;
grant update (role) on table public.user_roles to authenticated;
grant delete on table public.user_roles to authenticated;
grant select (id, name, is_public, created_at, updated_at) on table public.agencies to authenticated;
grant insert (name, is_public) on table public.agencies to authenticated;
grant update (name, is_public) on table public.agencies to authenticated;
grant delete on table public.agencies to authenticated;
grant select (agency_id, user_id, created_at) on table public.agency_memberships to authenticated;
grant insert (agency_id, user_id) on table public.agency_memberships to authenticated;
grant delete on table public.agency_memberships to authenticated;
grant select (
  id,
  agency_id,
  name,
  address,
  category,
  longitude,
  latitude,
  snapshot_path,
  is_active,
  is_public,
  created_at,
  updated_at
) on table public.cctv_locations to authenticated;
grant insert (
  agency_id,
  name,
  address,
  category,
  longitude,
  latitude,
  snapshot_path,
  is_active,
  is_public
) on table public.cctv_locations to authenticated;
grant update (
  agency_id,
  name,
  address,
  category,
  longitude,
  latitude,
  snapshot_path,
  is_active,
  is_public
) on table public.cctv_locations to authenticated;
grant delete on table public.cctv_locations to authenticated;
grant select on table public.cctv_private_config to authenticated;
grant insert (cctv_id, source_kind, source_uri, credential_reference, notes)
  on table public.cctv_private_config to authenticated;
grant update (source_kind, source_uri, credential_reference, notes)
  on table public.cctv_private_config to authenticated;
grant delete on table public.cctv_private_config to authenticated;
grant select on table public.traffic_observations to authenticated;
grant insert (
  cctv_id,
  window_started_at,
  window_ended_at,
  counting_method,
  processing_status,
  source_kind,
  source_reference,
  model_name,
  model_version,
  algorithm_version,
  light_vehicle_count,
  heavy_vehicle_count,
  motorcycle_count,
  bicycle_count,
  sampled_frames,
  quality_flags
) on table public.traffic_observations to authenticated;
grant update (
  cctv_id,
  window_started_at,
  window_ended_at,
  counting_method,
  processing_status,
  source_kind,
  source_reference,
  model_name,
  model_version,
  algorithm_version,
  light_vehicle_count,
  heavy_vehicle_count,
  motorcycle_count,
  bicycle_count,
  sampled_frames,
  quality_flags
) on table public.traffic_observations to authenticated;
grant delete on table public.traffic_observations to authenticated;
grant select on table public.admin_audit_events to authenticated;

grant select (id, name, is_public) on table public.agencies to anon;
grant select (
  id,
  agency_id,
  name,
  address,
  category,
  longitude,
  latitude,
  snapshot_path,
  is_active,
  is_public,
  updated_at
) on table public.cctv_locations to anon;

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_administrator())
);

create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_administrator())
)
with check (
  user_id = (select auth.uid())
  or (select private.is_administrator())
);

create policy user_roles_select_self_or_admin
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_administrator())
);

create policy user_roles_insert_by_other_admin
on public.user_roles
for insert
to authenticated
with check (
  (select private.is_administrator())
  and user_id <> (select auth.uid())
  and granted_by = (select auth.uid())
);

create policy user_roles_update_by_other_admin
on public.user_roles
for update
to authenticated
using (
  (select private.is_administrator())
  and user_id <> (select auth.uid())
)
with check (
  (select private.is_administrator())
  and user_id <> (select auth.uid())
  and granted_by = (select auth.uid())
);

create policy user_roles_delete_by_other_admin
on public.user_roles
for delete
to authenticated
using (
  (select private.is_administrator())
  and user_id <> (select auth.uid())
);

create policy agencies_public_select
on public.agencies
for select
to anon
using (is_public);

create policy agencies_authenticated_select
on public.agencies
for select
to authenticated
using (
  is_public
  or (select private.can_manage_agency(id))
);

create policy agencies_admin_insert
on public.agencies
for insert
to authenticated
with check (
  (select private.is_administrator())
  and created_by = (select auth.uid())
);

create policy agencies_manager_update
on public.agencies
for update
to authenticated
using ((select private.can_manage_agency(id)))
with check ((select private.can_manage_agency(id)));

create policy agencies_admin_delete
on public.agencies
for delete
to authenticated
using ((select private.is_administrator()));

create policy agency_memberships_select_self_or_admin
on public.agency_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_administrator())
);

create policy agency_memberships_admin_insert
on public.agency_memberships
for insert
to authenticated
with check (
  (select private.is_administrator())
  and created_by = (select auth.uid())
);

create policy agency_memberships_admin_delete
on public.agency_memberships
for delete
to authenticated
using ((select private.is_administrator()));

create policy cctv_locations_public_select
on public.cctv_locations
for select
to anon
using (is_public and is_active);

create policy cctv_locations_authenticated_select
on public.cctv_locations
for select
to authenticated
using (
  (is_public and is_active)
  or (select private.can_manage_agency(agency_id))
);

create policy cctv_locations_manager_insert
on public.cctv_locations
for insert
to authenticated
with check (
  (select private.can_manage_agency(agency_id))
  and created_by = (select auth.uid())
);

create policy cctv_locations_manager_update
on public.cctv_locations
for update
to authenticated
using ((select private.can_manage_agency(agency_id)))
with check ((select private.can_manage_agency(agency_id)));

create policy cctv_locations_admin_delete
on public.cctv_locations
for delete
to authenticated
using ((select private.is_administrator()));

create policy cctv_private_config_manager_select
on public.cctv_private_config
for select
to authenticated
using (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy cctv_private_config_manager_insert
on public.cctv_private_config
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
  and created_by = (select auth.uid())
);

create policy cctv_private_config_manager_update
on public.cctv_private_config
for update
to authenticated
using (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
)
with check (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy cctv_private_config_manager_delete
on public.cctv_private_config
for delete
to authenticated
using (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy traffic_observations_manager_select
on public.traffic_observations
for select
to authenticated
using (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy traffic_observations_manager_insert
on public.traffic_observations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
  and created_by = (select auth.uid())
);

create policy traffic_observations_manager_update
on public.traffic_observations
for update
to authenticated
using (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
  and (
    processing_status <> 'completed'
    or (select private.is_administrator())
  )
)
with check (
  exists (
    select 1
    from public.cctv_locations as cameras
    where cameras.id = cctv_id
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy traffic_observations_admin_delete
on public.traffic_observations
for delete
to authenticated
using ((select private.is_administrator()));

create policy admin_audit_events_admin_select
on public.admin_audit_events
for select
to authenticated
using ((select private.is_administrator()));

create view public.public_cctv_locations
with (security_invoker = true, security_barrier = true)
as
select
  cameras.id,
  cameras.name,
  cameras.address,
  cameras.category,
  agencies.id as agency_id,
  agencies.name as agency_name,
  cameras.longitude,
  cameras.latitude,
  jsonb_build_object(
    'type', 'Point',
    'coordinates', jsonb_build_array(cameras.longitude, cameras.latitude)
  ) as location_geojson,
  cameras.snapshot_path,
  cameras.updated_at
from public.cctv_locations as cameras
join public.agencies
  on agencies.id = cameras.agency_id
where cameras.is_public
  and cameras.is_active
  and agencies.is_public;

revoke all on table public.public_cctv_locations from anon, authenticated;
grant select on table public.public_cctv_locations to anon, authenticated;

commit;
