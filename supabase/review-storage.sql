-- Run after the guest_reviews migration. Safe to re-run.
-- Review photos stay private until the linked review is approved.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images', 'review-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A browser generates a new UUID and uploads with upsert:false. The review
-- constraint binds this path to that same UUID. Existing objects cannot be
-- overwritten by guests, and review IDs and image paths cannot be reused.
drop policy if exists "Guests upload review images" on storage.objects;
create policy "Guests upload review images" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'review-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/photo\.(jpg|png|webp)$'
    -- Once approved, this UUID cannot receive a new photo, including if the
    -- original object was missing or an administrator subsequently deleted it.
    -- Only approved rows are needed here, so anonymous callers retain no access
    -- to pending/rejected reviews or to the admin membership table.
    and not exists (
      select 1 from public.reviews r
      where r.id::text = split_part(name, '/', 1) and r.status = 'approved'
    )
  );

drop policy if exists "Public reads approved review images" on storage.objects;
create policy "Public reads approved review images" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'review-images'
    and exists (
      select 1 from public.reviews r
      where r.image_path = name and r.status = 'approved'
    )
  );

drop policy if exists "Admins read review images" on storage.objects;
create policy "Admins read review images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'review-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

-- No guest UPDATE or DELETE policy. Admins may remove rejected/orphaned files
-- using the Storage dashboard/API; deleting only SQL metadata is not enough.
drop policy if exists "Admins delete review images" on storage.objects;
create policy "Admins delete review images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'review-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

-- Moderation must never publish a path awaiting an upload. Combined with the
-- INSERT guard above and the unique bucket/path, upload-first submissions keep
-- an existing photo immutable as the review moves from pending to approved.
-- This lives here because ordinary migration tests do not have Storage tables.
create or replace function public.require_review_photo_before_approval() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.image_path is not null and not exists (
    select 1 from storage.objects
    where bucket_id = 'review-images' and name = new.image_path
  ) then
    raise exception using
      errcode = '23514',
      message = 'A review photo must exist before approval.';
  end if;
  return new;
end;
$$;
revoke all on function public.require_review_photo_before_approval() from public, anon, authenticated;

drop trigger if exists reviews_require_photo_before_approval on public.reviews;
create trigger reviews_require_photo_before_approval
  before update of status on public.reviews
  for each row when (new.status = 'approved')
  execute function public.require_review_photo_before_approval();

select id, public, file_size_limit, allowed_mime_types from storage.buckets
where id = 'review-images';
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like '%review images%'
order by policyname;
