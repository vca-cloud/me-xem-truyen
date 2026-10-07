-- Member authors: application + admin approval, author-owned stories, chapter publishing workflow,
-- revenue share in Xu and monthly payouts (paid on the 20th).
-- Authors never write tables directly: the server verifies the session and writes with the service role.

create table public.author_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pen_name text not null check (length(trim(pen_name)) between 2 and 60),
  bio text not null default '',
  contact text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  revenue_share smallint not null default 70 check (revenue_share between 0 and 100),
  trusted_override boolean,
  agreed_terms_at timestamptz not null,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  payout_bank text,
  payout_account text,
  payout_holder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index author_profiles_pen_name_idx on public.author_profiles (lower(pen_name));

alter table public.author_profiles enable row level security;
create policy "Authors read own profile" on public.author_profiles for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Full admins manage author profiles" on public.author_profiles for update to authenticated using (public.is_full_admin()) with check (public.is_full_admin());

alter table public.stories add column owner_id uuid references auth.users(id) on delete set null;
create index stories_owner_idx on public.stories (owner_id);
comment on column public.stories.owner_id is 'Author who owns the story; null = published by the site admins.';

alter table public.chapters
  add column publish_status text not null default 'published' check (publish_status in ('draft', 'submitted', 'published', 'rejected')),
  add column review_note text,
  add column submitted_at timestamptz;

create index chapters_publish_status_idx on public.chapters (publish_status) where publish_status <> 'published';
grant select (publish_status) on public.chapters to anon, authenticated;

-- Readers only see published chapters, and author stories only once they have a published chapter.
drop policy if exists "Chapter metadata is public" on public.chapters;
create policy "Published chapters are public" on public.chapters for select using (publish_status = 'published' or public.is_admin());

drop policy if exists "Published stories are public" on public.stories;
create policy "Published stories are public" on public.stories for select using (
  owner_id is null
  or public.is_admin()
  or exists (select 1 from public.chapters c where c.story_id = stories.id and c.publish_status = 'published')
);

create or replace function public.story_chapter_counts(p_story_ids uuid[] default null)
returns table (story_id uuid, chapter_count integer)
language sql stable security definer set search_path = public
as $$
  select c.story_id, count(*)::integer
  from public.chapters c
  where c.publish_status = 'published' and (p_story_ids is null or c.story_id = any (p_story_ids))
  group by c.story_id;
$$;

-- Content link only for published chapters (admins: any).
create or replace function public.chapter_text_url(p_chapter_id uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  price integer := public.chapter_price(p_chapter_id);
  published boolean;
begin
  if price is null then
    return null;
  end if;
  if public.is_admin() then
    return (select text_url from public.chapters where id = p_chapter_id);
  end if;
  select publish_status = 'published' into published from public.chapters where id = p_chapter_id;
  if not published then
    return null;
  end if;
  if price = 0 or exists (select 1 from public.chapter_unlocks where user_id = auth.uid() and chapter_id = p_chapter_id) then
    return (select text_url from public.chapters where id = p_chapter_id);
  end if;
  return null;
end;
$$;

-- Author earnings: one row per paid unlock of an author's chapter, in Xu (decimals allowed: 70% of 3 Xu = 2.1).
create table public.author_earnings (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid references public.stories(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  reader_id uuid references auth.users(id) on delete set null,
  coins_spent integer not null check (coins_spent > 0),
  share_percent smallint not null check (share_percent between 0 and 100),
  author_coins numeric(12, 2) not null check (author_coins >= 0),
  created_at timestamptz not null default now()
);

create index author_earnings_author_idx on public.author_earnings (author_id, created_at desc);

create table public.author_payouts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  coins numeric(12, 2) not null check (coins > 0),
  amount_vnd integer not null check (amount_vnd > 0),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  payout_bank text not null,
  payout_account text not null,
  payout_holder text not null,
  note text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  unique (author_id, period)
);

alter table public.author_earnings enable row level security;
alter table public.author_payouts enable row level security;
create policy "Authors read own earnings" on public.author_earnings for select to authenticated using (author_id = (select auth.uid()) or public.is_admin());
create policy "Authors read own payouts" on public.author_payouts for select to authenticated using (author_id = (select auth.uid()) or public.is_admin());
create policy "Full admins process payouts" on public.author_payouts for update to authenticated using (public.is_full_admin()) with check (public.is_full_admin());

-- Unlocking a published chapter of an approved author also records the author's share.
create or replace function public.unlock_chapter(p_chapter_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  price integer;
  current_balance integer;
  new_balance integer;
  chapter_label text;
  owner uuid;
  share smallint;
  story uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.chapters where id = p_chapter_id and publish_status = 'published') then
    return jsonb_build_object('status', 'not_found');
  end if;
  price := public.chapter_price(p_chapter_id);
  if price is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into public.wallets (user_id) values (uid) on conflict (user_id) do nothing;
  select balance into current_balance from public.wallets where user_id = uid for update;

  if price = 0 then
    return jsonb_build_object('status', 'free', 'price', 0, 'balance', current_balance);
  end if;
  if exists (select 1 from public.chapter_unlocks where user_id = uid and chapter_id = p_chapter_id) then
    return jsonb_build_object('status', 'already', 'price', price, 'balance', current_balance);
  end if;
  if current_balance < price then
    return jsonb_build_object('status', 'insufficient', 'price', price, 'balance', current_balance);
  end if;

  select s.title || ' - Chương ' || c.chapter_number, s.owner_id, s.id into chapter_label, owner, story
  from public.chapters c join public.stories s on s.id = c.story_id where c.id = p_chapter_id;

  new_balance := public.apply_coin_change(uid, -price, 'unlock', 'Mở khóa ' || chapter_label, p_chapter_id::text, uid);
  insert into public.chapter_unlocks (user_id, chapter_id, coins_spent) values (uid, p_chapter_id, price);

  if owner is not null and owner <> uid then
    select revenue_share into share from public.author_profiles where user_id = owner and status = 'approved';
    if share is not null and share > 0 then
      insert into public.author_earnings (author_id, story_id, chapter_id, reader_id, coins_spent, share_percent, author_coins)
      values (owner, story, p_chapter_id, uid, price, share, round(price * share / 100.0, 2));
    end if;
  end if;

  return jsonb_build_object('status', 'unlocked', 'price', price, 'balance', new_balance);
end;
$$;

-- Author dashboard numbers: earned, already paid or requested, and available Xu.
create or replace function public.author_balance(p_author_id uuid default null)
returns table (earned numeric, withdrawn numeric, available numeric, published_chapters integer, trusted boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  target uuid := coalesce(p_author_id, auth.uid());
begin
  if target is null or (target <> auth.uid() and not public.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  with e as (select coalesce(sum(author_coins), 0) as v from public.author_earnings where author_id = target),
       w as (select coalesce(sum(coins), 0) as v from public.author_payouts where author_id = target and status in ('requested', 'paid')),
       p as (select count(*)::integer as v from public.chapters c join public.stories s on s.id = c.story_id where s.owner_id = target and c.publish_status = 'published')
  select e.v, w.v, e.v - w.v, p.v,
         coalesce((select a.trusted_override from public.author_profiles a where a.user_id = target), p.v >= 10)
  from e, w, p;
end;
$$;

revoke all on function public.author_balance(uuid) from public, anon;
grant execute on function public.author_balance(uuid) to authenticated;

-- Review queue now also lists chapters submitted by authors.
drop function if exists public.admin_moderation_queue(boolean);
create function public.admin_moderation_queue(p_include_reviewed boolean default false)
returns table (
  id uuid, story_id uuid, story_title text, story_slug text, chapter_number integer, title text,
  ads_enabled boolean, moderation_status text, moderation_score integer, moderation_hits jsonb, is_mature boolean, moderated_at timestamptz,
  publish_status text, review_note text, author_pen_name text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select c.id, c.story_id, s.title, s.slug, c.chapter_number, c.title,
         c.ads_enabled, c.moderation_status, c.moderation_score, c.moderation_hits, c.is_mature, c.moderated_at,
         c.publish_status, c.review_note, a.pen_name
  from public.chapters c
  join public.stories s on s.id = c.story_id
  left join public.author_profiles a on a.user_id = s.owner_id
  where c.publish_status = 'submitted' or c.moderation_status = 'pending'
     or (p_include_reviewed and (c.is_mature or not c.ads_enabled or c.moderation_status = 'approved' or c.publish_status = 'rejected'))
  order by (c.publish_status = 'submitted' or c.moderation_status = 'pending') desc, c.moderation_score desc, s.title, c.chapter_number
  limit 500;
end;
$$;

revoke all on function public.admin_moderation_queue(boolean) from public, anon;
grant execute on function public.admin_moderation_queue(boolean) to authenticated;

-- Admin list of authors with their numbers.
create or replace function public.admin_list_authors()
returns table (
  user_id uuid, email text, pen_name text, bio text, contact text, status text, revenue_share smallint, trusted_override boolean,
  review_note text, created_at timestamptz, stories integer, published_chapters integer, pending_chapters integer,
  earned numeric, withdrawn numeric, has_payout_info boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select a.user_id, u.email::text, a.pen_name, a.bio, a.contact, a.status, a.revenue_share, a.trusted_override, a.review_note, a.created_at,
         (select count(*)::integer from public.stories s where s.owner_id = a.user_id),
         (select count(*)::integer from public.chapters c join public.stories s on s.id = c.story_id where s.owner_id = a.user_id and c.publish_status = 'published'),
         (select count(*)::integer from public.chapters c join public.stories s on s.id = c.story_id where s.owner_id = a.user_id and c.publish_status = 'submitted'),
         coalesce((select sum(author_coins) from public.author_earnings e where e.author_id = a.user_id), 0),
         coalesce((select sum(coins) from public.author_payouts p where p.author_id = a.user_id and p.status in ('requested', 'paid')), 0),
         (a.payout_bank is not null and a.payout_account is not null and a.payout_holder is not null)
  from public.author_profiles a join auth.users u on u.id = a.user_id
  order by (a.status = 'pending') desc, a.created_at desc;
end;
$$;

revoke all on function public.admin_list_authors() from public, anon;
grant execute on function public.admin_list_authors() to authenticated;

notify pgrst, 'reload schema';
