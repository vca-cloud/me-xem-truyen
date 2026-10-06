-- Admin tools and hardening: chapter management, real administrator management, per-IP view rate limit,
-- and a per-story switch to turn ads off (sensitive content).

alter table public.stories add column ads_disabled boolean not null default false;
comment on column public.stories.ads_disabled is 'true = never show AdSense on this story and its chapters (e.g. mature content).';

-- Chapters including their content link, for the admin editor (text_url is hidden from the public API).
create or replace function public.admin_list_chapters(p_story_id uuid)
returns table (id uuid, chapter_number integer, title text, text_url text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select c.id, c.chapter_number, c.title, c.text_url, c.updated_at
  from public.chapters c where c.story_id = p_story_id order by c.chapter_number;
end;
$$;

revoke all on function public.admin_list_chapters(uuid) from public, anon;
grant execute on function public.admin_list_chapters(uuid) to authenticated;

-- Per-IP rate limit for page views. ip_hash is a salted SHA-256 prefix computed by the server; raw IPs are never stored.
alter table public.view_events add column ip_hash text;
create index view_events_ip_idx on public.view_events (ip_hash, created_at) where ip_hash is not null;

drop function if exists public.track_view(text, integer, text, text, text);

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
      and created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.view_events (story_slug, chapter_number, visitor_id, device, referrer_host, ip_hash)
  values (p_story_slug, p_chapter_number, p_visitor_id, p_device, left(p_referrer_host, 200), p_ip_hash);
end;
$$;

revoke all on function public.track_view(text, integer, text, text, text, text) from public;
grant execute on function public.track_view(text, integer, text, text, text, text) to anon, authenticated;

-- 2-step verification enforced in the database too: an admin who enrolled an authenticator app only gets admin
-- rights on sessions that passed the second step (JWT aal = aal2). This also covers direct calls to the Supabase API.
create or replace function public.admin_mfa_ok()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where id = (select auth.uid())
      and role in ('admin', 'editor', 'moderator')
      and status = 'active'
  ) and public.admin_mfa_ok();
$$;

-- Full-access admin (role 'admin'), also subject to 2-step verification.
create or replace function public.is_full_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where id = (select auth.uid()) and role = 'admin' and status = 'active')
     and public.admin_mfa_ok();
$$;

create or replace function public.admin_adjust_coins(p_user_id uuid, p_amount integer, p_reason text)
returns integer
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_full_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_amount = 0 or abs(p_amount) > 1000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  return public.apply_coin_change(p_user_id, p_amount, 'admin_adjust', trim(p_reason), null, auth.uid());
end;
$$;

-- Administrator management (role 'admin' only). Never leaves the site without an active 'admin'.
-- The old "Admins can update admin profiles" policy let an editor raise their own role; changes now go only through these functions.
drop policy if exists "Admins can update admin profiles" on public.admin_profiles;

create or replace function public.admin_set_admin(p_email text, p_role public.admin_role, p_status public.admin_status)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
  target_email text;
begin
  if not public.is_full_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id, email into target, target_email from auth.users where lower(email) = lower(trim(p_email));
  if target is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if (p_role <> 'admin' or p_status <> 'active')
     and not exists (select 1 from public.admin_profiles where role = 'admin' and status = 'active' and id <> target) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  insert into public.admin_profiles (id, email, display_name, role, status)
  select target, target_email, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(target_email, '@', 1)), p_role, p_status
  from auth.users u where u.id = target
  on conflict (id) do update set role = excluded.role, status = excluded.status, updated_at = now();
  return target;
end;
$$;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_full_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admin_profiles where role = 'admin' and status = 'active' and id <> p_user_id) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  delete from public.admin_profiles where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_admin(text, public.admin_role, public.admin_status) from public, anon;
revoke all on function public.admin_remove_admin(uuid) from public, anon;
grant execute on function public.admin_set_admin(text, public.admin_role, public.admin_status) to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;
revoke all on function public.is_full_admin() from public, anon;
grant execute on function public.is_full_admin() to authenticated;
