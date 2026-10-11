-- Per-story monetization switches and the Shopee affiliate pop-up on free chapters.
-- AdSense per story already exists (stories.ads_disabled). This adds:
--   stories.affiliate_enabled       – show the Shopee pop-up on this story's free chapters
--   stories.affiliate_gate_minutes  – after a click, how long before the pop-up shows again (0 = every chapter)
--   stories.affiliate_link_id       – a specific link for this story (null = any active "popup" link)
--   affiliate_links.image_url / headline – product picture and short line shown in the pop-up

alter table public.stories
  add column if not exists affiliate_enabled boolean not null default false,
  add column if not exists affiliate_gate_minutes integer not null default 0 check (affiliate_gate_minutes between 0 and 10080),
  add column if not exists affiliate_link_id uuid references public.affiliate_links(id) on delete set null;

alter table public.affiliate_links
  add column if not exists image_url text check (image_url is null or image_url ~* '^https?://'),
  add column if not exists headline text check (headline is null or char_length(headline) <= 160);

-- The pop-up for one story: nothing when the story has the pop-up off or no active link is available.
-- Public (readers need it), returns only what the pop-up shows; the Shopee URL itself stays behind /go/<id>.
create or replace function public.story_affiliate_popup(p_story_id uuid)
returns table (link_id uuid, name text, image_url text, headline text, gate_minutes integer)
language sql stable security definer set search_path = public
as $$
  select l.id, l.name, l.image_url, l.headline, s.affiliate_gate_minutes
  from public.stories s
  join lateral (
    select * from public.affiliate_links l
    where l.active
      and (
        l.id = s.affiliate_link_id
        or (s.affiliate_link_id is null and l.placement = 'popup' and (l.story_slug is null or l.story_slug = s.slug))
      )
    order by (l.id = s.affiliate_link_id) desc, (l.story_slug = s.slug) desc nulls last, random()
    limit 1
  ) l on true
  where s.id = p_story_id and s.affiliate_enabled;
$$;

revoke all on function public.story_affiliate_popup(uuid) from public;
grant execute on function public.story_affiliate_popup(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
