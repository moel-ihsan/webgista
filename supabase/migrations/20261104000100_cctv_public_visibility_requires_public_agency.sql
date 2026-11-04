begin;

drop policy if exists cctv_locations_public_select on public.cctv_locations;

create policy cctv_locations_public_select
on public.cctv_locations
for select
to anon
using (
  is_public
  and is_active
  and exists (
    select 1
    from public.agencies as agency
    where agency.id = cctv_locations.agency_id
      and agency.is_public
  )
);

commit;
