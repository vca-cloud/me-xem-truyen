-- "Gợi ý truyện" on the home page: stories picked by an admin (most recently picked first).
-- Empty slots are filled automatically by real 7-day views (see app/page.tsx).
alter table public.stories
  add column if not exists featured boolean not null default false,
  add column if not exists featured_at timestamptz;

-- Picking / unpicking stamps the time, so the newest pick shows first.
create or replace function public.stamp_featured()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.featured is distinct from old.featured then
    new.featured_at := case when new.featured then now() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists stories_stamp_featured on public.stories;
create trigger stories_stamp_featured before update of featured on public.stories
  for each row execute function public.stamp_featured();

notify pgrst, 'reload schema';
