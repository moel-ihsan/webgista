begin;

create table public.app_map_settings (
  id smallint primary key default 1 check (id = 1),
  latitude numeric(8, 6) not null,
  longitude numeric(9, 6) not null,
  zoom numeric(4, 2) not null,
  constraint app_map_settings_latitude_range check (latitude between -90 and 90),
  constraint app_map_settings_longitude_range check (longitude between -180 and 180),
  constraint app_map_settings_zoom_range check (zoom between 8 and 18)
);

alter table public.app_map_settings enable row level security;
revoke all on table public.app_map_settings from public, anon, authenticated;
grant select on table public.app_map_settings to anon, authenticated;
grant insert (id, latitude, longitude, zoom), update (latitude, longitude, zoom)
  on table public.app_map_settings to authenticated;

create policy app_map_settings_read
on public.app_map_settings for select to anon, authenticated
using (true);

create policy app_map_settings_admin_insert
on public.app_map_settings for insert to authenticated
with check ((select private.is_administrator()));

create policy app_map_settings_admin_update
on public.app_map_settings for update to authenticated
using ((select private.is_administrator()))
with check ((select private.is_administrator()));

alter table public.agency_memberships
  drop constraint agency_memberships_agency_id_fkey,
  add constraint agency_memberships_agency_id_fkey
    foreign key (agency_id) references public.agencies (id) on delete restrict;

commit;
