-- Site-wide moderation re-scan: remember when the dictionary last changed, so chapters scanned before that
-- (chapters.moderated_at older than terms_changed_at, or never scanned) are known to be out of date.
-- Only the server (service role) reads this; no client access.

create table if not exists public.moderation_state (
  id boolean primary key default true check (id),
  terms_changed_at timestamptz not null default now()
);
insert into public.moderation_state (id) values (true) on conflict (id) do nothing;
alter table public.moderation_state enable row level security;
revoke all on public.moderation_state from anon, authenticated;

-- Any insert / update / delete on the dictionary moves the timestamp (once per statement).
create or replace function public.touch_moderation_terms()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.moderation_state set terms_changed_at = now();
  return null;
end;
$$;
revoke all on function public.touch_moderation_terms() from public;

drop trigger if exists moderation_terms_changed on public.moderation_terms;
create trigger moderation_terms_changed
  after insert or update or delete on public.moderation_terms
  for each statement execute function public.touch_moderation_terms();

create index if not exists chapters_moderated_at_idx on public.chapters (moderated_at);

notify pgrst, 'reload schema';
