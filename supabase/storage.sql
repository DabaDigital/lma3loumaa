-- Photo uploads for the dashboard's image field.
--
-- Run this once in the Supabase SQL Editor, after the migration in migrations/.
-- It is re-runnable: every statement drops or upserts before it creates.
--
-- This file lives outside migrations/ on purpose. It touches the platform's
-- `storage` schema, which only exists on a real Supabase project, while
-- `npm run test:database` replays migrations/ in a plain embedded PostgreSQL.

-- Public bucket: photos are read straight from their URL by website visitors,
-- so the limits below are the real gate on what can be stored.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880, -- 5 MB, mirrored by MAX_IMAGE_BYTES in src/admin/Editor.tsx
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read the photos. Only rows in public.admin_users may write them,
-- which is the same membership check that guards the content tables.
drop policy if exists "Public reads menu images" on storage.objects;
create policy "Public reads menu images" on storage.objects for select to anon, authenticated
  using (bucket_id = 'menu-images');

drop policy if exists "Admins upload menu images" on storage.objects;
create policy "Admins upload menu images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

drop policy if exists "Admins replace menu images" on storage.objects;
create policy "Admins replace menu images" on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'menu-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

drop policy if exists "Admins delete menu images" on storage.objects;
create policy "Admins delete menu images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

-- Verify the bucket and its four policies.
select id, public, file_size_limit, allowed_mime_types from storage.buckets
where id = 'menu-images';
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%menu images%'
order by policyname;
