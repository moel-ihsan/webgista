begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

select has_column('public', 'profiles', 'address', 'profiles stores address');
select has_column('public', 'profiles', 'latitude', 'profiles stores latitude');
select has_column('public', 'profiles', 'longitude', 'profiles stores longitude');
select has_column('public', 'profiles', 'description', 'profiles stores description');
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'address', 'UPDATE')
    and has_column_privilege('authenticated', 'public.profiles', 'latitude', 'UPDATE')
    and has_column_privilege('authenticated', 'public.profiles', 'longitude', 'UPDATE')
    and has_column_privilege('authenticated', 'public.profiles', 'description', 'UPDATE')
    and not has_table_privilege('anon', 'public.profiles', 'SELECT')
    and not has_column_privilege('anon', 'public.profiles', 'display_name', 'SELECT')
    and not has_column_privilege('anon', 'public.profiles', 'address', 'SELECT')
    and not has_column_privilege('anon', 'public.profiles', 'avatar_path', 'SELECT'),
  'only authenticated callers receive editable profile fields; anon has no profile read grant'
);
select ok(
  (select count(*) = 4 from pg_catalog.pg_constraint
   where conrelid = 'public.profiles'::regclass
     and conname in ('profiles_address_length', 'profiles_description_length', 'profiles_latitude_range', 'profiles_longitude_range'))
    and exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_coordinates_pair'),
  'profile fields have length, coordinate-range, and coordinate-pair constraints'
);
select ok(
  exists (select 1 from storage.buckets where id = 'profile-photos' and not public and file_size_limit = 2097152)
    and exists (select 1 from storage.buckets where id = 'cctv-images' and not public and file_size_limit = 5242880),
  'profile and CCTV image buckets are private and size limited'
);
select ok(
  (select count(*) = 2 from storage.buckets
   where id in ('profile-photos', 'cctv-images')
     and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']),
  'both image buckets restrict accepted MIME types'
);
select ok(
  exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.profiles'::regclass and polname = 'profiles_select_self_or_admin')
    and exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.profiles'::regclass and polname = 'profiles_update_self_or_admin'),
  'existing self-scoped profile RLS remains enabled'
);
select ok(
  (select count(*) = 3 from pg_catalog.pg_policy
   where polrelid = 'storage.objects'::regclass
     and polname in ('profile_photos_read_own', 'profile_photos_insert_own', 'profile_photos_delete_own')),
  'profile photos have own-folder read, insert, and delete policies'
);
select ok(
  not exists (select 1 from pg_catalog.pg_policy
              where polrelid = 'storage.objects'::regclass and polcmd = 'w'
                and polname like 'profile_photos_%')
    and not exists (select 1 from pg_catalog.pg_policy
                    where polrelid = 'storage.objects'::regclass and polcmd = 'w'
                      and polname like 'cctv_images_%'),
  'replacement uses new objects; no Storage object UPDATE policy permits overwrite'
);
select ok(
  (select count(*) = 4 from pg_catalog.pg_policy
   where polrelid = 'storage.objects'::regclass
     and polname in ('cctv_images_read_public', 'cctv_images_read_managed', 'cctv_images_insert_managed', 'cctv_images_delete_managed')),
  'CCTV images have public-approved read and agency-manager access policies'
);
select ok(
  (select bool_and(pg_catalog.pg_get_expr(polqual, polrelid) like '%snapshot_path%' and pg_catalog.pg_get_expr(polqual, polrelid) like '%is_public%' and pg_catalog.pg_get_expr(polqual, polrelid) like '%is_active%' and pg_catalog.pg_get_expr(polqual, polrelid) like '%agencies.is_public%')
   from pg_catalog.pg_policy where polrelid = 'storage.objects'::regclass and polname = 'cctv_images_read_public'),
  'anonymous CCTV image access is tied to the row path and publication flags'
);
select ok(
  (select bool_and(coalesce(pg_catalog.pg_get_expr(polqual, polrelid), pg_catalog.pg_get_expr(polwithcheck, polrelid)) like '%can_manage_agency%')
   from pg_catalog.pg_policy where polrelid = 'storage.objects'::regclass
     and polname in ('cctv_images_read_managed', 'cctv_images_insert_managed', 'cctv_images_delete_managed')),
  'manager access to CCTV images is agency scoped'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-admin@example.test', 'not-a-real-password', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-editor@example.test', 'not-a-real-password', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-viewer@example.test', 'not-a-real-password', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-other-editor@example.test', 'not-a-real-password', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.user_roles (user_id, role)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'administrator'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'agency_editor'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'agency_editor');

select throws_matching($$update public.profiles set latitude = 90.0000001, longitude = 0 where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'$$,
  'profiles_latitude_range', 'latitude validation rejects values just beyond its range without numeric rounding');
select throws_matching($$update public.profiles set latitude = 0, longitude = -180.0000001 where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'$$,
  'profiles_longitude_range', 'longitude validation rejects values just beyond its range without numeric rounding');

insert into public.agencies (id, name, is_public)
values ('20000000-0000-0000-0000-000000000001', 'Media Public Fixture', true),
       ('20000000-0000-0000-0000-000000000002', 'Media Private Fixture', false);

insert into public.agency_memberships (agency_id, user_id)
values ('20000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'),
       ('20000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4');

insert into public.cctv_locations (id, agency_id, name, address, longitude, latitude, snapshot_path, is_active, is_public)
values
  ('c1000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Published image fixture', 'Banda Aceh', 95.3, 5.5, 'c1000000-0000-0000-0000-000000000001/public.webp', true, true),
  ('c1000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Private image fixture', 'Banda Aceh', 95.3, 5.5, 'c1000000-0000-0000-0000-000000000002/private.webp', true, false),
  ('c1000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Inactive image fixture', 'Banda Aceh', 95.3, 5.5, 'c1000000-0000-0000-0000-000000000003/inactive.webp', false, true),
  ('c1000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Private agency image fixture', 'Banda Aceh', 95.3, 5.5, 'c1000000-0000-0000-0000-000000000004/agency-private.webp', true, true);

insert into storage.objects (bucket_id, name)
values ('cctv-images', 'c1000000-0000-0000-0000-000000000001/public.webp'),
       ('cctv-images', 'c1000000-0000-0000-0000-000000000002/private.webp'),
       ('cctv-images', 'c1000000-0000-0000-0000-000000000003/inactive.webp'),
       ('cctv-images', 'c1000000-0000-0000-0000-000000000004/agency-private.webp');
insert into storage.objects (bucket_id, name)
values ('profile-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1/profile.webp'),
       ('profile-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/profile.webp');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq($$select name from storage.objects where bucket_id = 'cctv-images' order by name$$,
  $$values ('c1000000-0000-0000-0000-000000000001/public.webp'::text)$$,
  'anonymous Storage reads only an image attached to an active public camera and public agency');
select results_eq($$select count(*)::bigint from storage.objects where bucket_id = 'profile-photos'$$,
  array[0::bigint], 'anonymous callers cannot read profile photos');
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$select name from storage.objects where bucket_id = 'cctv-images' and name like 'c1000000-0000-0000-0000-000000000002/%'$$,
  $$values ('c1000000-0000-0000-0000-000000000002/private.webp'::text)$$,
  'assigned agency editor can read its private camera image');
select results_eq($$select name from storage.objects where bucket_id = 'profile-photos' and name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/profile.webp'$$,
  $$values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/profile.webp'::text)$$,
  'user can read their own profile photo');
select results_eq($$select count(*)::bigint from storage.objects where bucket_id = 'profile-photos' and name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1/profile.webp'$$,
  array[0::bigint], 'user cannot read another profile photo');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('cctv-images', 'c1000000-0000-0000-0000-000000000001/editor-upload.webp')$$,
  'assigned agency editor can upload an image under its camera folder');
select throws_matching($$insert into storage.objects (bucket_id, name) values ('cctv-images', 'c1000000-0000-0000-0000-000000000004/forbidden.webp')$$,
  'row-level security', 'assigned agency editor cannot upload to an unrelated agency camera');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('profile-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/replacement.webp')$$,
  'user can upload a profile photo to their own folder');
select throws_matching($$insert into storage.objects (bucket_id, name) values ('profile-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1/forbidden.webp')$$,
  'row-level security', 'user cannot upload a profile photo to another user folder');
select lives_ok($$delete from storage.objects where bucket_id = 'cctv-images' and name = 'c1000000-0000-0000-0000-000000000002/private.webp'$$,
  'assigned agency editor can delete an image under its camera folder');
select results_eq($$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'cctv-images' and name = 'c1000000-0000-0000-0000-000000000001/public.webp' returning name$$,
  $$select null::text where false$$, 'agency editor cannot overwrite an existing CCTV image object');
select results_eq($$delete from storage.objects where bucket_id = 'profile-photos' and name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1/profile.webp' returning name$$,
  $$select null::text where false$$, 'user cannot delete another profile photo');
select results_eq($$delete from storage.objects where bucket_id = 'profile-photos' and name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/profile.webp' returning name$$,
  $$values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/profile.webp'::text)$$,
  'user can remove their own profile photo');
select lives_ok($$update public.profiles set address = 'Own profile edit' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'$$,
  'user can update their own added profile metadata');
select results_eq($$update public.profiles set address = 'Unauthorized edit' where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' returning user_id$$,
  $$select null::uuid where false$$, 'user cannot update another profile');
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$select count(*)::bigint from storage.objects where bucket_id = 'cctv-images' and name like 'c1000000-0000-0000-0000-000000000002/%'$$,
  array[0::bigint], 'unrelated agency editor cannot read another agency private image');
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3","role":"authenticated"}', true);
set local role authenticated;
select throws_matching($$insert into storage.objects (bucket_id, name) values ('cctv-images', 'c1000000-0000-0000-0000-000000000001/viewer-upload.webp')$$,
  'row-level security', 'authenticated user without a management role cannot upload a CCTV image');
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$select name from storage.objects where bucket_id = 'cctv-images' and name = 'c1000000-0000-0000-0000-000000000002/private.webp'$$,
  $$values ('c1000000-0000-0000-0000-000000000002/private.webp'::text)$$,
  'administrator can read a private CCTV image');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('cctv-images', 'c1000000-0000-0000-0000-000000000001/admin-upload.webp')$$,
  'administrator can upload under a managed camera folder');
select lives_ok($$delete from storage.objects where bucket_id = 'cctv-images' and name = 'c1000000-0000-0000-0000-000000000001/public.webp'$$,
  'administrator can delete an image under a managed camera folder');
reset role;

select * from finish();
rollback;
