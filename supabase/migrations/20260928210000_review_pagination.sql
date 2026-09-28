-- The public review wall is paginated on the server: each page reads six
-- approved reviews in one of three orders, and the summary counts approved
-- reviews per star rating. These partial indexes keep both fast as reviews grow.

-- "All" shows the most complete reviews first: a photo outranks text, and any
-- written description outranks a title alone. Newest breaks ties.
alter table public.reviews
  add column detail_rank smallint generated always as (
    (case when image_path is null then 0 else 2 end)
    + (case when description = '' then 0 else 1 end)
  ) stored;

create index reviews_approved_detail_idx
  on public.reviews (detail_rank desc, created_at desc, id desc)
  where status = 'approved';

-- "Top rated" order, also used by the per-rating counts.
create index reviews_approved_rating_idx
  on public.reviews (rating desc, created_at desc, id desc)
  where status = 'approved';

-- "Newest" order.
create index reviews_approved_recent_idx
  on public.reviews (created_at desc, id desc)
  where status = 'approved';
