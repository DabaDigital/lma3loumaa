-- Website content is public; mutations require explicit admin membership.
create function public.valid_translation(value jsonb) returns boolean
language sql immutable strict security invoker set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and jsonb_typeof(value->'fr') = 'string' and length(trim(value->>'fr')) between 1 and 1500
    and jsonb_typeof(value->'en') = 'string' and length(trim(value->>'en')) between 1 and 1500
    and jsonb_typeof(value->'ar') = 'string' and length(trim(value->>'ar')) between 1 and 1500
    and value ?& array['fr', 'en', 'ar'];
$$;

create function public.valid_variants(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare variant jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'array' then return false; end if;
  for variant in select jsonb_array_elements(value) loop
    if public.valid_translation(variant->'name') is distinct from true
      or jsonb_typeof(variant->'price') is distinct from 'number' then return false; end if;
    if (variant->>'price')::numeric < 0 or (variant->>'price')::numeric > 100000 then return false; end if;
  end loop;
  return true;
end;
$$;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
create policy "Admins can see their own membership" on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));
-- Membership can only be provisioned using a trusted server / SQL editor.

create table public.categories (
  id text primary key default gen_random_uuid()::text check (id <> 'all'),
  name jsonb not null check (public.valid_translation(name)),
  icon text not null default '✦' check (length(icon) between 1 and 8),
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000)
);
create table public.menu_items (
  id text primary key default gen_random_uuid()::text,
  category text not null references public.categories(id) on delete restrict,
  name jsonb not null check (public.valid_translation(name)),
  description jsonb not null check (public.valid_translation(description)),
  price numeric(10,2) not null check (price between 0 and 100000),
  "menuPrice" numeric(10,2) check ("menuPrice" between 0 and 100000),
  image text not null check (image in ('classic','cheddar','jalapeno','mexican','mezze','baba','moutabal','muhammara','spicy','houmousShawarma','beetroot','plate','rolls','family','fries','lemonade','drink','dessert','kunafa') or image ~ '^(https://|/assets/)'),
  tag text check (tag in ('signature','spicy','sharing')),
  variants jsonb check (public.valid_variants(variants)),
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000)
);
create index menu_items_category_idx on public.menu_items(category);
create table public.locations (
  id text primary key default gen_random_uuid()::text,
  name jsonb not null check (public.valid_translation(name)),
  area jsonb not null check (public.valid_translation(area)),
  address jsonb not null check (public.valid_translation(address)),
  image text not null check (image ~ '^(https://|/assets/)'),
  map text not null check (map ~ '^https://'),
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000)
);

alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.locations enable row level security;
revoke all on public.categories, public.menu_items, public.locations from anon, authenticated;
grant select on public.categories, public.menu_items, public.locations to anon;
grant select, insert, update, delete on public.categories, public.menu_items, public.locations to authenticated;

create policy "Public sees visible categories" on public.categories for select to anon, authenticated using (available);
create policy "Public sees visible menu" on public.menu_items for select to anon, authenticated
  using (available and exists (select 1 from public.categories c where c.id = category and c.available));
create policy "Public sees visible locations" on public.locations for select to anon, authenticated using (available);

create policy "Admins manage categories" on public.categories for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins manage menu" on public.menu_items for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins manage locations" on public.locations for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

-- Realtime with periodic/focus refresh in the client as a reconnect fallback.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.categories, public.menu_items, public.locations;
  end if;
end $$;
