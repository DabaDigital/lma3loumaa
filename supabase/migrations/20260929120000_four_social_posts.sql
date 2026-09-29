-- The follow-us section shows four posts: lower the limit from eight.
-- Existing rows stay; the website shows the first four visible ones.
create or replace function public.limit_social_posts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.social_posts'));
  if (select count(*) from public.social_posts) >= 4 then
    raise exception 'social posts are limited to 4' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_social_posts() from public;
