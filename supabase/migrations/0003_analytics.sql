-- Analytics foundation: page views, affiliate links/clicks/conversions and AdSense daily reports.
-- Public tracking goes only through the security definer functions below; tables are admin-only under RLS.
-- All money columns are stored in VND.

create table public.view_events (
  id bigint generated always as identity primary key,
  story_slug text not null,
  chapter_number integer,
  visitor_id text not null,
  device text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  referrer_host text,
  created_at timestamptz not null default now()
);

create index view_events_created_idx on public.view_events (created_at);
create index view_events_story_idx on public.view_events (story_slug, created_at);
create index view_events_visitor_idx on public.view_events (visitor_id, created_at);

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_url text not null check (target_url ~* '^https?://'),
  placement text not null default 'khac',
  sub_id text unique,
  story_slug text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.affiliate_links(id) on delete cascade,
  story_slug text,
  chapter_number integer,
  placement text not null,
  visitor_id text not null,
  device text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);

create index affiliate_clicks_created_idx on public.affiliate_clicks (created_at);
create index affiliate_clicks_link_idx on public.affiliate_clicks (link_id, created_at);
create index affiliate_clicks_visitor_idx on public.affiliate_clicks (visitor_id, link_id, created_at);

create table public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  sub_id text,
  link_id uuid references public.affiliate_links(id) on delete set null,
  order_amount numeric(14, 2) not null default 0,
  commission numeric(14, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled')),
  ordered_at timestamptz not null,
  imported_at timestamptz not null default now()
);

create index affiliate_conversions_ordered_idx on public.affiliate_conversions (ordered_at);

create table public.adsense_daily (
  date date not null,
  ad_unit text not null default 'Tất cả',
  page_views integer not null default 0 check (page_views >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  earnings numeric(14, 2) not null default 0,
  synced_at timestamptz not null default now(),
  primary key (date, ad_unit)
);

alter table public.view_events enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.adsense_daily enable row level security;

create policy "Admins read view events" on public.view_events for select to authenticated using (public.is_admin());
create policy "Admins read affiliate clicks" on public.affiliate_clicks for select to authenticated using (public.is_admin());
create policy "Admins manage affiliate links" on public.affiliate_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage affiliate conversions" on public.affiliate_conversions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage adsense daily" on public.adsense_daily for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Records one chapter/story view. The same visitor re-opening the same page within 30 minutes counts once.
create or replace function public.track_view(
  p_story_slug text,
  p_chapter_number integer,
  p_visitor_id text,
  p_device text,
  p_referrer_host text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_story_slug is null or length(p_story_slug) not between 1 and 200
     or p_visitor_id is null or length(p_visitor_id) not between 8 and 64
     or p_device not in ('mobile', 'tablet', 'desktop') then
    return;
  end if;

  if exists (
    select 1 from public.view_events
    where visitor_id = p_visitor_id
      and story_slug = p_story_slug
      and chapter_number is not distinct from p_chapter_number
      and created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.view_events (story_slug, chapter_number, visitor_id, device, referrer_host)
  values (p_story_slug, p_chapter_number, p_visitor_id, p_device, left(p_referrer_host, 200));
end;
$$;

-- Records an affiliate click and returns the destination URL (null when the link is missing or inactive).
-- Repeated clicks on the same link by the same visitor within 1 minute are not counted again.
create or replace function public.track_affiliate_click(
  p_link_id uuid,
  p_story_slug text,
  p_chapter_number integer,
  p_visitor_id text,
  p_device text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  link public.affiliate_links;
begin
  select * into link from public.affiliate_links where id = p_link_id and active;
  if not found then return null; end if;

  if p_visitor_id is not null and length(p_visitor_id) between 8 and 64
     and p_device in ('mobile', 'tablet', 'desktop')
     and not exists (
       select 1 from public.affiliate_clicks
       where visitor_id = p_visitor_id and link_id = p_link_id and created_at > now() - interval '1 minute'
     ) then
    insert into public.affiliate_clicks (link_id, story_slug, chapter_number, placement, visitor_id, device)
    values (p_link_id, left(p_story_slug, 200), p_chapter_number, link.placement, p_visitor_id, p_device);
  end if;

  return link.target_url;
end;
$$;

revoke all on function public.track_view(text, integer, text, text, text) from public;
revoke all on function public.track_affiliate_click(uuid, text, integer, text, text) from public;
grant execute on function public.track_view(text, integer, text, text, text) to anon, authenticated;
grant execute on function public.track_affiliate_click(uuid, text, integer, text, text) to anon, authenticated;

-- Dashboard aggregate for an inclusive date range in Vietnam time. Admin only.
create or replace function public.admin_revenue_dashboard(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  t_from timestamptz := (p_from::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  t_to timestamptz := ((p_to + 1)::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with
  views as (select * from public.view_events where created_at >= t_from and created_at < t_to),
  clicks as (select * from public.affiliate_clicks where created_at >= t_from and created_at < t_to),
  conversions as (
    select c.*, coalesce(c.link_id, l.id) as resolved_link_id
    from public.affiliate_conversions c
    left join public.affiliate_links l on c.link_id is null and l.sub_id = c.sub_id
    where c.ordered_at >= t_from and c.ordered_at < t_to
  ),
  ads as (select * from public.adsense_daily where date between p_from and p_to),
  site_rpm as (
    select case when (select count(*) from views) > 0
      then (select coalesce(sum(earnings), 0) from ads) * 1000.0 / (select count(*) from views)
      else 0 end as value
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'page_views', (select count(*) from views),
      'visitors', (select count(distinct visitor_id) from views),
      'adsense_earnings', (select coalesce(sum(earnings), 0) from ads),
      'adsense_impressions', (select coalesce(sum(impressions), 0) from ads),
      'adsense_clicks', (select coalesce(sum(clicks), 0) from ads),
      'adsense_page_views', (select coalesce(sum(page_views), 0) from ads),
      'affiliate_clicks', (select count(*) from clicks),
      'affiliate_orders', (select count(*) from conversions where status <> 'cancelled'),
      'commission_pending', (select coalesce(sum(commission), 0) from conversions where status = 'pending'),
      'commission_approved', (select coalesce(sum(commission), 0) from conversions where status = 'approved'),
      'commission_cancelled', (select coalesce(sum(commission), 0) from conversions where status = 'cancelled'),
      'order_amount', (select coalesce(sum(order_amount), 0) from conversions where status <> 'cancelled'),
      'last_adsense_sync', (select max(synced_at) from public.adsense_daily),
      'last_conversion_import', (select max(imported_at) from public.affiliate_conversions)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day,
        'page_views', (select count(*) from views v where (v.created_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day),
        'adsense', (select coalesce(sum(earnings), 0) from ads a where a.date = d.day),
        'commission', (select coalesce(sum(commission), 0) from conversions c where c.status <> 'cancelled' and (c.ordered_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day),
        'affiliate_clicks', (select count(*) from clicks k where (k.created_at at time zone 'Asia/Ho_Chi_Minh')::date = d.day)
      ) order by d.day)
      from (select generate_series(p_from, p_to, interval '1 day')::date as day) d
    ), '[]'::jsonb),
    'stories', coalesce((
      select jsonb_agg(s order by (s->>'page_views')::int desc) from (
        select jsonb_build_object(
          'story_slug', v.story_slug,
          'title', coalesce(st.title, v.story_slug),
          'page_views', count(*),
          'visitors', count(distinct v.visitor_id),
          'affiliate_clicks', (select count(*) from clicks k where k.story_slug = v.story_slug),
          'estimated_adsense', round(count(*) * (select value from site_rpm) / 1000.0, 2)
        ) as s
        from views v left join public.stories st on st.slug = v.story_slug
        group by v.story_slug, st.title
        order by count(*) desc
        limit 20
      ) top
    ), '[]'::jsonb),
    'placements', coalesce((
      select jsonb_agg(p order by (p->>'clicks')::int desc) from (
        select jsonb_build_object(
          'placement', l.placement,
          'clicks', (select count(*) from clicks k where k.placement = l.placement),
          'orders', (select count(*) from conversions c join public.affiliate_links l2 on l2.id = c.resolved_link_id where l2.placement = l.placement and c.status <> 'cancelled'),
          'commission', (select coalesce(sum(c.commission), 0) from conversions c join public.affiliate_links l2 on l2.id = c.resolved_link_id where l2.placement = l.placement and c.status <> 'cancelled')
        ) as p
        from (select distinct placement from public.affiliate_links) l
      ) placements
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'target_url', l.target_url,
        'placement', l.placement,
        'sub_id', l.sub_id,
        'story_slug', l.story_slug,
        'active', l.active,
        'clicks', (select count(*) from clicks k where k.link_id = l.id),
        'orders', (select count(*) from conversions c where c.resolved_link_id = l.id and c.status <> 'cancelled'),
        'commission', (select coalesce(sum(c.commission), 0) from conversions c where c.resolved_link_id = l.id and c.status <> 'cancelled')
      ) order by l.created_at desc)
      from public.affiliate_links l
    ), '[]'::jsonb),
    'ad_units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ad_unit', ad_unit, 'page_views', page_views, 'impressions', impressions, 'clicks', clicks, 'earnings', earnings
      ) order by earnings desc)
      from (
        select ad_unit, sum(page_views) as page_views, sum(impressions) as impressions, sum(clicks) as clicks, sum(earnings) as earnings
        from ads group by ad_unit
      ) units
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'device', device,
        'page_views', page_views,
        'affiliate_clicks', (select count(*) from clicks k where k.device = grouped.device)
      ) order by page_views desc)
      from (select device, count(*) as page_views from views group by device) grouped
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_revenue_dashboard(date, date) from public;
grant execute on function public.admin_revenue_dashboard(date, date) to authenticated;
