begin;

create policy cctv_images_admin_orphan_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cctv-images'
  and (select private.is_administrator())
  and not exists (
    select 1 from public.cctv_locations cameras
    where cameras.snapshot_path = storage.objects.name
  )
);

create policy cctv_images_admin_orphan_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cctv-images'
  and (select private.is_administrator())
  and not exists (
    select 1 from public.cctv_locations cameras
    where cameras.snapshot_path = storage.objects.name
  )
);

commit;
