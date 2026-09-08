-- Apply AFTER review-storage.sql and after the protected API is configured.
-- Old deployed clients can no longer submit directly after this cutover.
revoke insert on public.reviews from anon, authenticated;
revoke insert (id, title, description, rating, image_path) on public.reviews from anon, authenticated;
drop policy if exists "Guests submit pending reviews" on public.reviews;
drop policy if exists "Guests upload review images" on storage.objects;

-- Signed uploads land in staging, never in a publishable path. The server moves
-- them to review-images before completing the review. A leftover upload token
-- therefore cannot change a photo after approval, even after admin deletion.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('review-uploads', 'review-uploads', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
