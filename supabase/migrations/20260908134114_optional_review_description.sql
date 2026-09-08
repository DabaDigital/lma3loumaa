-- Only a rating and a non-empty title are required for guest reviews.
alter table public.reviews
  drop constraint reviews_title_check,
  add constraint reviews_title_check
    check (title = btrim(title, E' \t\n\r\f') and char_length(title) between 1 and 100),
  drop constraint reviews_description_check,
  add constraint reviews_description_check
    check (description = btrim(description, E' \t\n\r\f') and char_length(description) <= 1500),
  alter column description set default '';
