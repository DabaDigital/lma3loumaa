-- Serialize retries of the same submission ID even when they arrive from different networks.
create or replace function public.prepare_guest_review(p_id uuid, p_source text, p_title text, p_description text, p_rating smallint, p_image_path text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  previous private.review_submissions;
  today date := (statement_timestamp() at time zone 'Africa/Casablanca')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source, 0));
  perform pg_advisory_xact_lock(72419, hashtext(p_id::text));
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
