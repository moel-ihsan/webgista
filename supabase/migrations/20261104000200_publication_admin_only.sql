begin;

alter table public.agencies
  alter column is_public set default false;

revoke insert, update on table public.agencies from public, anon, authenticated;
revoke insert (is_public), update (is_public)
  on table public.agencies from public, anon, authenticated;
revoke insert, update on table public.cctv_locations from public, anon, authenticated;
revoke insert (is_public), update (is_public)
  on table public.cctv_locations from public, anon, authenticated;

drop policy if exists cctv_locations_authenticated_select on public.cctv_locations;

create policy cctv_locations_authenticated_select
on public.cctv_locations
for select
to authenticated
using (
  (
    is_public
    and is_active
    and exists (
      select 1
      from public.agencies as agency
      where agency.id = cctv_locations.agency_id
        and agency.is_public
    )
  )
  or (select private.can_manage_agency(agency_id))
);

create or replace function private.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_row_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
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
        'cctv_id', row_data -> 'cctv_id',
        'publication', case
          when tg_op = 'UPDATE'
            and tg_table_name in ('agencies', 'cctv_locations')
            and old_row_data -> 'is_public' is distinct from row_data -> 'is_public'
          then jsonb_build_object(
            'from', old_row_data -> 'is_public',
            'to', row_data -> 'is_public'
          )
        end
      )
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create function public.set_cctv_publication(p_cctv_id uuid, p_is_public boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_administrator()) then
    raise exception using errcode = '42501', message = 'administrator authorization required';
  end if;

  if p_cctv_id is null or p_is_public is null then
    raise exception using errcode = '22004', message = 'camera and publication state are required';
  end if;

  if p_is_public and not exists (
    select 1
    from public.cctv_locations as camera
    join public.agencies as agency on agency.id = camera.agency_id
    where camera.id = p_cctv_id
      and agency.is_public
  ) then
    raise exception using errcode = '23514', message = 'camera agency must be public before publishing';
  end if;

  update public.cctv_locations
  set is_public = p_is_public
  where id = p_cctv_id
    and is_public is distinct from p_is_public;

  return found;
end;
$$;

create function public.set_agency_publication(p_agency_id uuid, p_is_public boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_administrator()) then
    raise exception using errcode = '42501', message = 'administrator authorization required';
  end if;

  if p_agency_id is null or p_is_public is null then
    raise exception using errcode = '22004', message = 'agency and publication state are required';
  end if;

  update public.agencies
  set is_public = p_is_public
  where id = p_agency_id
    and is_public is distinct from p_is_public;

  return found;
end;
$$;

revoke all on function public.set_cctv_publication(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_agency_publication(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_cctv_publication(uuid, boolean) to authenticated;
grant execute on function public.set_agency_publication(uuid, boolean) to authenticated;

commit;
