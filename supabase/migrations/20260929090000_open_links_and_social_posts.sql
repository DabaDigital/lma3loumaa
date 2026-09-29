-- Links become an open list: admins add, reorder, hide and remove social
-- profiles and ordering platforms. Glovo stays, because every order button
-- uses it. Social posts and reels (Instagram, Facebook, TikTok) are new.

alter table public.site_links drop constraint if exists site_links_id_check;
alter table public.site_links drop constraint if exists site_links_check;
alter table public.site_links alter column id set default gen_random_uuid()::text;
alter table public.site_links
  add column kind text not null default 'social' check (kind in ('social', 'order')),
  add column platform text not null default 'other' check (platform ~ '^[a-z0-9-]{1,30}$'),
  add column label text not null default '' check (length(label) <= 40),
  add column available boolean not null default true,
  add column sort_order integer not null default 0 check (sort_order between 0 and 100000);

-- The fixed rows were named after their platform, and an empty URL meant
-- "not shown". Keep what was filled in, in its previous order.
update public.site_links set
  platform = id,
  kind = case when id in ('glovo', 'klit') then 'order' else 'social' end,
  sort_order = case id when 'facebook' then 1 when 'klit' then 1 else 0 end;
delete from public.site_links where url = '';

alter table public.site_links drop constraint if exists site_links_url_check;
alter table public.site_links add constraint site_links_url_check
  check (url ~ '^https://[^[:space:]]+$' and length(url) <= 500);
alter table public.site_links add constraint site_links_other_label_check
  check (platform <> 'other' or length(trim(label)) > 0);
alter table public.site_links add constraint site_links_glovo_check
  check (id <> 'glovo' or (kind = 'order' and platform = 'glovo' and available));

grant insert, delete on public.site_links to authenticated;
grant update (kind, platform, label, url, available, sort_order) on public.site_links to authenticated;

drop policy if exists "Public sees links" on public.site_links;
create policy "Public sees visible links" on public.site_links for select to anon, authenticated
  using (available);
drop policy if exists "Admins edit links" on public.site_links;
create policy "Admins manage links" on public.site_links for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Glovo cannot be deleted" on public.site_links as restrictive for delete to authenticated
  using (id <> 'glovo');

-- Posts and reels shown in the home page's follow-us carousel. `url` is the
-- post on its platform; `video` and `poster` are optional files that let the
-- site play Instagram and Facebook reels itself, muted until asked.
create table public.social_posts (
  id text primary key default gen_random_uuid()::text,
  url text not null check (
    url ~ '^https://([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.watch|tiktok\.com)/[^[:space:]]*$'
    and length(url) <= 500
  ),
  video text check (video ~ '^(https://|/assets/)[^[:space:]]+$' and length(video) <= 500),
  poster text check (poster ~ '^(https://|/assets/)[^[:space:]]+$' and length(poster) <= 500),
  caption text not null default '' check (length(caption) <= 300),
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000)
);

-- At most 8 posts. The lock serializes concurrent inserts so two requests
-- cannot both see 7 and each add one.
create function public.limit_social_posts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.social_posts'));
  if (select count(*) from public.social_posts) >= 8 then
    raise exception 'social posts are limited to 8' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_social_posts() from public;
create trigger social_posts_limit before insert on public.social_posts
  for each row execute function public.limit_social_posts();

alter table public.social_posts enable row level security;
revoke all on public.social_posts from anon, authenticated;
grant select on public.social_posts to anon, authenticated;
grant insert, delete on public.social_posts to authenticated;
grant update (url, video, poster, caption, available, sort_order) on public.social_posts to authenticated;

create policy "Public sees visible posts" on public.social_posts for select to anon, authenticated
  using (available);
create policy "Admins manage posts" on public.social_posts for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
