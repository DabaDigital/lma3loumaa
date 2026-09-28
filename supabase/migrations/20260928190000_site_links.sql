-- Social profiles and ordering platforms linked from the website.
-- The platforms are fixed rows: admins edit their URLs but cannot add or remove
-- them. An empty URL keeps a platform off the website, except Glovo, which every
-- order button relies on.
create table public.site_links (
  id text primary key check (id in ('instagram', 'facebook', 'glovo', 'klit')),
  url text not null default '' check (
    url = '' or (url ~ '^https://[^[:space:]]+$' and length(url) <= 500)
  ),
  check (id <> 'glovo' or url <> '')
);
alter table public.site_links enable row level security;
revoke all on public.site_links from anon, authenticated;
grant select on public.site_links to anon, authenticated;
grant update (url) on public.site_links to authenticated;

create policy "Public sees links" on public.site_links for select to anon, authenticated
  using (true);
create policy "Admins edit links" on public.site_links for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

insert into public.site_links (id, url) values
  ('instagram', ''),
  ('facebook', ''),
  ('glovo', 'https://glovoapp.com/fr/ma/casablanca/stores/shawarma-lma3louma-cas'),
  ('klit', '')
on conflict (id) do nothing;
