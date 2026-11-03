begin;

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('administrator', 'agency_editor');
create type public.camera_category as enum ('regular', 'analytic');
create type public.camera_source_kind as enum (
  'public_https',
  'stored_clip',
  'private_stream',
  'other'
);
create type public.counting_method as enum (
  'frame_detections',
  'tracked_line_crossings',
  'manual'
);
create type public.processing_status as enum (
  'pending',
  'processing',
  'completed',
  'failed',
  'rejected'
);
create type public.observation_source_kind as enum (
  'browser',
  'worker',
  'manual',
  'v1_import'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(trim(display_name)) between 1 and 120),
  constraint profiles_avatar_path_length
    check (avatar_path is null or char_length(avatar_path) between 1 and 500)
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  constraint user_roles_not_self_granted
    check (granted_by is null or granted_by <> user_id)
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  legacy_id bigint unique,
  name text not null,
  is_public boolean not null default true,
  source_system text not null default 'manual',
  source_reference text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agencies_name_length
    check (char_length(trim(name)) between 2 and 120),
  constraint agencies_source_system
    check (source_system in ('manual', 'v1_import')),
  constraint agencies_source_reference_length
    check (source_reference is null or char_length(source_reference) between 1 and 500)
);

create unique index agencies_name_unique_ci
  on public.agencies (lower(trim(name)));

create table public.agency_memberships (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table public.cctv_locations (
  id uuid primary key default gen_random_uuid(),
  legacy_id bigint unique,
  agency_id uuid not null references public.agencies (id) on delete restrict,
  name text not null,
  address text not null,
  category public.camera_category not null default 'regular',
  longitude numeric(9, 6) not null,
  latitude numeric(8, 6) not null,
  snapshot_path text,
  is_active boolean not null default true,
  is_public boolean not null default false,
  source_system text not null default 'manual',
  source_reference text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cctv_locations_name_length
    check (char_length(trim(name)) between 2 and 160),
  constraint cctv_locations_address_length
    check (char_length(trim(address)) between 2 and 500),
  constraint cctv_locations_longitude_range
    check (longitude between -180 and 180),
  constraint cctv_locations_latitude_range
    check (latitude between -90 and 90),
  constraint cctv_locations_snapshot_path_length
    check (snapshot_path is null or char_length(snapshot_path) between 1 and 500),
  constraint cctv_locations_source_system
    check (source_system in ('manual', 'v1_import')),
  constraint cctv_locations_source_reference_length
    check (source_reference is null or char_length(source_reference) between 1 and 500)
);

create index cctv_locations_agency_id_idx
  on public.cctv_locations (agency_id);
create index cctv_locations_public_active_idx
  on public.cctv_locations (is_public, is_active)
  where is_public and is_active;
create index cctv_locations_coordinates_idx
  on public.cctv_locations (longitude, latitude);

create table public.cctv_private_config (
  cctv_id uuid primary key references public.cctv_locations (id) on delete cascade,
  source_kind public.camera_source_kind not null,
  source_uri text,
  credential_reference text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cctv_private_config_source_uri_length
    check (source_uri is null or char_length(source_uri) between 1 and 2000),
  constraint cctv_private_config_credential_reference_length
    check (credential_reference is null or char_length(credential_reference) between 1 and 500),
  constraint cctv_private_config_notes_length
    check (notes is null or char_length(notes) <= 1000),
  constraint cctv_private_config_has_source
    check (source_uri is not null or credential_reference is not null)
);

create table public.traffic_observations (
  id uuid primary key default gen_random_uuid(),
  legacy_id bigint unique,
  cctv_id uuid not null references public.cctv_locations (id) on delete restrict,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  counting_method public.counting_method not null,
  processing_status public.processing_status not null default 'pending',
  source_kind public.observation_source_kind not null,
  source_reference text,
  model_name text,
  model_version text,
  algorithm_version text,
  light_vehicle_count integer not null default 0,
  heavy_vehicle_count integer not null default 0,
  motorcycle_count integer not null default 0,
  bicycle_count integer not null default 0,
  sampled_frames integer not null default 0,
  quality_flags text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traffic_observations_time_window
    check (window_ended_at > window_started_at),
  constraint traffic_observations_nonnegative_counts
    check (
      light_vehicle_count >= 0
      and heavy_vehicle_count >= 0
      and motorcycle_count >= 0
      and bicycle_count >= 0
      and sampled_frames >= 0
    ),
  constraint traffic_observations_source_reference_length
    check (source_reference is null or char_length(source_reference) between 1 and 500),
  constraint traffic_observations_model_name_length
    check (model_name is null or char_length(model_name) between 1 and 120),
  constraint traffic_observations_model_version_length
    check (model_version is null or char_length(model_version) between 1 and 120),
  constraint traffic_observations_algorithm_version_length
    check (algorithm_version is null or char_length(algorithm_version) between 1 and 120),
  constraint traffic_observations_completed_provenance
    check (
      processing_status <> 'completed'
      or counting_method = 'manual'
      or (
        sampled_frames > 0
        and model_name is not null
        and model_version is not null
        and algorithm_version is not null
      )
    )
);

create index traffic_observations_cctv_window_idx
  on public.traffic_observations (cctv_id, window_ended_at desc);
create index traffic_observations_status_idx
  on public.traffic_observations (processing_status, window_ended_at desc);

create table public.admin_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint admin_audit_events_action
    check (action in ('INSERT', 'UPDATE', 'DELETE')),
  constraint admin_audit_events_entity_type_length
    check (char_length(entity_type) between 1 and 80),
  constraint admin_audit_events_details_object
    check (jsonb_typeof(details) = 'object')
);

create index admin_audit_events_occurred_at_idx
  on public.admin_audit_events (occurred_at desc);
create index admin_audit_events_entity_idx
  on public.admin_audit_events (entity_type, entity_id, occurred_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.set_actor_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(caller_id, new.created_by);
    new.updated_by := coalesce(caller_id, new.updated_by, new.created_by);
  else
    new.created_by := old.created_by;
    new.updated_by := coalesce(caller_id, old.updated_by);
  end if;

  return new;
end;
$$;

create function private.set_role_grant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  new.granted_by := caller_id;
  new.granted_at := now();
  return new;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'User'
      ),
      120
    )
  );

  return new;
end;
$$;

create function private.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  audit_entity_id uuid;
begin
  audit_entity_id := coalesce(
    nullif(row_data ->> 'id', '')::uuid,
    nullif(row_data ->> 'user_id', '')::uuid,
    nullif(row_data ->> 'cctv_id', '')::uuid
  );

  insert into public.admin_audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    audit_entity_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'agency_id', row_data -> 'agency_id',
        'cctv_id', row_data -> 'cctv_id'
      )
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger user_roles_set_grant
before insert or update on public.user_roles
for each row execute function private.set_role_grant();

create trigger agencies_set_actor
before insert or update on public.agencies
for each row execute function private.set_actor_columns();
create trigger agencies_set_updated_at
before update on public.agencies
for each row execute function private.set_updated_at();

create trigger cctv_locations_set_actor
before insert or update on public.cctv_locations
for each row execute function private.set_actor_columns();
create trigger cctv_locations_set_updated_at
before update on public.cctv_locations
for each row execute function private.set_updated_at();

create trigger cctv_private_config_set_actor
before insert or update on public.cctv_private_config
for each row execute function private.set_actor_columns();
create trigger cctv_private_config_set_updated_at
before update on public.cctv_private_config
for each row execute function private.set_updated_at();

create trigger traffic_observations_set_actor
before insert or update on public.traffic_observations
for each row execute function private.set_actor_columns();
create trigger traffic_observations_set_updated_at
before update on public.traffic_observations
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger audit_user_roles
after insert or update or delete on public.user_roles
for each row execute function private.capture_audit_event();
create trigger audit_agencies
after insert or update or delete on public.agencies
for each row execute function private.capture_audit_event();
create trigger audit_agency_memberships
after insert or update or delete on public.agency_memberships
for each row execute function private.capture_audit_event();
create trigger audit_cctv_locations
after insert or update or delete on public.cctv_locations
for each row execute function private.capture_audit_event();
create trigger audit_cctv_private_config
after insert or update or delete on public.cctv_private_config
for each row execute function private.capture_audit_event();
create trigger audit_traffic_observations
after insert or update or delete on public.traffic_observations
for each row execute function private.capture_audit_event();

revoke execute on all functions in schema private from public;

commit;
