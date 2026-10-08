-- Views: the same visitor re-opening the same page is counted again after 15 minutes (was 30).
-- Everything else in track_view is unchanged (bot filter is in the app; 300 views/hour/IP cap stays).

create or replace function public.track_view(
  p_story_slug text,
  p_chapter_number integer,
  p_visitor_id text,
  p_device text,
  p_referrer_host text,
  p_ip_hash text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_story_slug is null or length(p_story_slug) not between 1 and 200
     or p_visitor_id is null or length(p_visitor_id) not between 8 and 64
     or p_device not in ('mobile', 'tablet', 'desktop')
     or (p_ip_hash is not null and length(p_ip_hash) > 64)
     or not exists (select 1 from public.stories where slug = p_story_slug) then
    return;
  end if;

  -- One person reads at most a few hundred pages an hour; more than that from one IP is treated as a bot.
  if p_ip_hash is not null and (
    select count(*) from public.view_events
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 300 then
    return;
  end if;

  if exists (
    select 1 from public.view_events
    where visitor_id = p_visitor_id
      and story_slug = p_story_slug
      and chapter_number is not distinct from p_chapter_number
      and created_at > now() - interval '15 minutes'
  ) then
    return;
  end if;

  insert into public.view_events (story_slug, chapter_number, visitor_id, device, referrer_host, ip_hash)
  values (p_story_slug, p_chapter_number, p_visitor_id, p_device, left(p_referrer_host, 200), p_ip_hash);
end;
$$;

revoke all on function public.track_view(text, integer, text, text, text, text) from public;
grant execute on function public.track_view(text, integer, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
