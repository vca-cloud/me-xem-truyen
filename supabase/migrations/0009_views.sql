-- Real view counts: per-story totals for the public pages (and the HOT tag), and a view-tracking report for admins.
-- Counts come only from view_events (bots filtered, same visitor/page deduplicated for 30 minutes by track_view).

-- Admin can pin a story as HOT by hand (editorial pick), in addition to the automatic rule in lib/views.ts.
alter table public.stories add column if not exists hot_pinned boolean not null default false;

-- Per-story real views (all time, last 7 days) and the manual HOT pin, for every story.
-- Public: only aggregated numbers, no visitor data.
create or replace function public.story_view_stats()
returns table (story_id uuid, total_views integer, views_7d integer, hot_pinned boolean)
language sql stable security definer set search_path = public
as $$
  select s.id,
         count(v.id)::integer,
         (count(v.id) filter (where v.created_at >= now() - interval '7 days'))::integer,
         s.hot_pinned
  from public.stories s
  left join public.view_events v on v.story_slug = s.slug
  -- Same visibility as the stories RLS: admin stories, or author stories with a published chapter.
  where s.owner_id is null
     or exists (select 1 from public.chapters c where c.story_id = s.id and c.publish_status = 'published')
  group by s.id;
$$;

revoke all on function public.story_view_stats() from public;
grant execute on function public.story_view_stats() to anon, authenticated;

-- Admin view report (Vietnam time): totals, a daily series for the last p_days days (missing days = 0),
-- and per-story totals with a 14-day sparkline.
create or replace function public.admin_view_stats(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with events as (
    select v.story_slug, v.visitor_id, (v.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day
    from public.view_events v
  ),
  daily as (
    select d::date as day,
           count(e.*)::integer as views,
           count(distinct e.visitor_id)::integer as visitors
    from generate_series(today - (days - 1), today, interval '1 day') d
    left join events e on e.day = d::date
    group by d
    order by d
  ),
  per_story as (
    select s.id, s.slug, s.title, s.hot_pinned,
           count(e.*)::integer as total,
           (count(e.*) filter (where e.day > today - 7))::integer as d7,
           (count(e.*) filter (where e.day > today - 30))::integer as d30,
           count(distinct e.visitor_id)::integer as visitors
    from public.stories s
    left join events e on e.story_slug = s.slug
    group by s.id
  ),
  spark as (
    select s.slug,
           jsonb_agg(coalesce(c.views, 0) order by d) as series
    from public.stories s
    cross join generate_series(today - 13, today, interval '1 day') d
    left join (
      select story_slug, day, count(*)::integer as views from events where day > today - 14 group by story_slug, day
    ) c on c.story_slug = s.slug and c.day = d::date
    group by s.slug
  )
  select jsonb_build_object(
    'total', (select count(*) from events),
    'visitors_total', (select count(distinct visitor_id) from events),
    'today', (select count(*) from events where day = today),
    'last7', (select count(*) from events where day > today - 7),
    'last30', (select count(*) from events where day > today - 30),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', day, 'views', views, 'visitors', visitors) order by day) from daily), '[]'::jsonb),
    'stories', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'hot_pinned', p.hot_pinned, 'total', p.total, 'd7', p.d7, 'd30', p.d30, 'visitors', p.visitors, 'spark', sp.series) order by p.total desc, p.title)
                         from per_story p join spark sp on sp.slug = p.slug), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_view_stats(integer) from public;
grant execute on function public.admin_view_stats(integer) to authenticated;

notify pgrst, 'reload schema';
