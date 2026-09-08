-- Additive preparation. Apply review-protection.sql at deployment cutover to
-- remove the old direct guest writes once the protected endpoint is configured.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.review_submissions (
  id uuid primary key,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  day date not null default (now() at time zone 'Africa/Casablanca')::date,
  title text not null check (char_length(title) between 1 and 100 and title = btrim(title, E' \t\n\r\f')),
  description text not null default '' check (char_length(description) <= 1500 and description = btrim(description, E' \t\n\r\f')),
  rating smallint not null check (rating between 1 and 5),
  image_path text check (image_path is null or image_path in (id::text || '/photo.jpg', id::text || '/photo.png', id::text || '/photo.webp')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  completed boolean not null default false
);
create index review_submissions_source_day_idx on private.review_submissions(source_hash, day);
alter table private.review_submissions enable row level security;
revoke all on private.review_submissions from public, anon, authenticated;
grant select, insert, update, delete on private.review_submissions to service_role;

create function public.prepare_guest_review(p_id uuid, p_source text, p_title text, p_description text, p_rating smallint, p_image_path text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  previous private.review_submissions;
  today date := (statement_timestamp() at time zone 'Africa/Casablanca')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source, 0));
  select * into previous from private.review_submissions where id = p_id;
  if found then
    if previous.source_hash <> p_source or previous.title <> p_title or previous.description <> p_description
      or previous.rating <> p_rating or previous.image_path is distinct from p_image_path then
      raise exception 'REVIEW_CONFLICT' using errcode = 'P0001';
    end if;
    if previous.completed then return jsonb_build_object('id', p_id, 'completed', true); end if;
    if previous.day <> today then raise exception 'REVIEW_EXPIRED' using errcode = 'P0001'; end if;
    if previous.expires_at > statement_timestamp() then
      return jsonb_build_object('id', p_id, 'completed', false, 'image_path', p_image_path);
    end if;
  end if;
  if (select count(*) from private.review_submissions where source_hash = p_source and day = today
      and (completed or expires_at > statement_timestamp())) >= 2 then
    raise exception 'REVIEW_DAILY_LIMIT' using errcode = 'P0001';
  end if;
  insert into private.review_submissions(id, source_hash, title, description, rating, image_path)
  values (p_id, p_source, p_title, p_description, p_rating, p_image_path)
  on conflict (id) do update set expires_at = statement_timestamp() + interval '10 minutes';
  return jsonb_build_object('id', p_id, 'completed', false, 'image_path', p_image_path);
end;
$$;

create function public.get_guest_review_submission(p_id uuid, p_source text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare submission private.review_submissions;
begin
  select * into submission from private.review_submissions where id = p_id and source_hash = p_source;
  if not found then raise exception 'REVIEW_EXPIRED' using errcode = 'P0001'; end if;
  if not submission.completed and (submission.expires_at <= statement_timestamp()
     or submission.day <> (statement_timestamp() at time zone 'Africa/Casablanca')::date) then
    raise exception 'REVIEW_EXPIRED' using errcode = 'P0001';
  end if;
  return jsonb_build_object('id', p_id, 'image_path', submission.image_path, 'completed', submission.completed);
end;
$$;

create function public.complete_guest_review(p_id uuid, p_source text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare submission private.review_submissions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source, 0));
  perform public.get_guest_review_submission(p_id, p_source);
  select * into submission from private.review_submissions where id = p_id and source_hash = p_source for update;
  if submission.completed then return jsonb_build_object('id', p_id, 'completed', true); end if;
  -- Storage exists in hosted Supabase; the separate database test supplies it.
  if submission.image_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'review-images' and name = submission.image_path
  ) then raise exception 'REVIEW_PHOTO_MISSING' using errcode = 'P0001'; end if;
  insert into public.reviews(id, title, description, rating, image_path)
  values (submission.id, submission.title, submission.description, submission.rating, submission.image_path);
  update private.review_submissions set completed = true where id = p_id;
  return jsonb_build_object('id', p_id, 'completed', true);
end;
$$;

revoke all on function public.prepare_guest_review(uuid,text,text,text,smallint,text) from public, anon, authenticated;
revoke all on function public.get_guest_review_submission(uuid,text) from public, anon, authenticated;
revoke all on function public.complete_guest_review(uuid,text) from public, anon, authenticated;
grant execute on function public.prepare_guest_review(uuid,text,text,text,smallint,text) to service_role;
grant execute on function public.get_guest_review_submission(uuid,text) to service_role;
grant execute on function public.complete_guest_review(uuid,text) to service_role;
grant select, insert on public.reviews to service_role;
