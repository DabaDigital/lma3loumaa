-- Video and cover uploads for the dashboard's posts & reels.
--
-- Run this once in the Supabase SQL Editor, after the migrations in migrations/.
-- It is re-runnable: every statement drops or upserts before it creates.
-- Like storage.sql, it lives outside migrations/ because it touches the
-- platform's `storage` schema, which the embedded test database lacks.

-- Public bucket: visitors play the videos straight from their URL. 50 MB is
-- also the per-file ceiling of Supabase's free plan; mirrored in
-- src/admin/PostsAdmin.tsx.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media',
  'social-media',
  true,
  52428800,
  array['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads social media" on storage.objects;
create policy "Public reads social media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'social-media');

drop policy if exists "Admins upload social media" on storage.objects;
create policy "Admins upload social media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'social-media'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

drop policy if exists "Admins replace social media" on storage.objects;
create policy "Admins replace social media" on storage.objects for update to authenticated
  using (
    bucket_id = 'social-media'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'social-media'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

drop policy if exists "Admins delete social media" on storage.objects;
create policy "Admins delete social media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'social-media'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

-- Verify the bucket and its four policies.
select id, public, file_size_limit, allowed_mime_types from storage.buckets
where id = 'social-media';
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%social media%'
order by policyname;
