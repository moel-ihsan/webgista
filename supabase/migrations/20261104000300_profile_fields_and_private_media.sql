begin;

alter table public.profiles
  add column address text,
  add column latitude numeric,
  add column longitude numeric,
  add column description text,
  add constraint profiles_address_length check (address is null or char_length(address) <= 500),
  add constraint profiles_description_length check (description is null or char_length(description) <= 2000),
  add constraint profiles_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint profiles_longitude_range check (longitude is null or longitude between -180 and 180),
  add constraint profiles_coordinates_pair check ((latitude is null) = (longitude is null));

grant update (address, latitude, longitude, description) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('cctv-images', 'cctv-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'profile-photos'
      and (name is distinct from 'profile-photos' or public is distinct from false or file_size_limit is distinct from 2097152
        or allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'])
  ) or exists (
    select 1
    from storage.buckets
    where id = 'cctv-images'
      and (name is distinct from 'cctv-images' or public is distinct from false or file_size_limit is distinct from 5242880
        or allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'])
  ) then
    raise exception 'Existing private media bucket configuration does not match WebGISTA requirements';
  end if;
end;
$$;

create policy profile_photos_read_own
on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy profile_photos_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy profile_photos_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy cctv_images_read_public
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'cctv-images'
  and exists (
    select 1
    from public.cctv_locations as cameras
    join public.agencies on agencies.id = cameras.agency_id
    where cameras.id::text = (storage.foldername(storage.objects.name))[1]
      and cameras.snapshot_path = storage.objects.name
      and cameras.is_active and cameras.is_public and agencies.is_public
  )
);

create policy cctv_images_read_managed
on storage.objects for select to authenticated
using (
  bucket_id = 'cctv-images'
  and exists (
    select 1 from public.cctv_locations as cameras
    where cameras.id::text = (storage.foldername(storage.objects.name))[1]
      and cameras.snapshot_path = storage.objects.name
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy cctv_images_insert_managed
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cctv-images'
  and exists (
    select 1 from public.cctv_locations as cameras
    where cameras.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

create policy cctv_images_delete_managed
on storage.objects for delete to authenticated
using (
  bucket_id = 'cctv-images'
  and exists (
    select 1 from public.cctv_locations as cameras
    where cameras.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.can_manage_agency(cameras.agency_id))
  )
);

commit;
