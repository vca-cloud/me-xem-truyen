-- Coins ("Xu"): member wallets, append-only ledger, per-story chapter locking and chapter unlocks.
-- 1 Xu = 100 VND. Balances change only through the security definer functions below, never by direct writes.

alter table public.stories
  add column lock_from_chapter integer check (lock_from_chapter is null or lock_from_chapter > 0),
  add column lock_price_coins integer not null default 3 check (lock_price_coins between 1 and 1000);

comment on column public.stories.lock_from_chapter is 'Chapters numbered >= this value cost lock_price_coins to read; null = whole story free.';

create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.coin_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  kind text not null check (kind in ('topup', 'bonus', 'unlock', 'admin_adjust', 'refund')),
  description text not null default '',
  ref_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index coin_transactions_user_idx on public.coin_transactions (user_id, created_at desc);
create index coin_transactions_created_idx on public.coin_transactions (created_at);

create table public.chapter_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  coins_spent integer not null check (coins_spent >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create index chapter_unlocks_chapter_idx on public.chapter_unlocks (chapter_id);
create index chapter_unlocks_created_idx on public.chapter_unlocks (created_at);

alter table public.wallets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.chapter_unlocks enable row level security;

create policy "Members read own wallet" on public.wallets for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Members read own coin history" on public.coin_transactions for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Members read own unlocks" on public.chapter_unlocks for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- Price in Xu to read a chapter; 0 = free.
create or replace function public.chapter_price(p_chapter_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case when s.lock_from_chapter is not null and c.chapter_number >= s.lock_from_chapter then s.lock_price_coins else 0 end
  from public.chapters c join public.stories s on s.id = c.story_id
  where c.id = p_chapter_id;
$$;

-- Internal: applies a balance change and writes the ledger row atomically. Not callable by clients.
create or replace function public.apply_coin_change(p_user_id uuid, p_amount integer, p_kind text, p_description text, p_ref_id text, p_created_by uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  insert into public.wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.wallets set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id and balance + p_amount >= 0
  returning balance into new_balance;
  if new_balance is null then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;
  insert into public.coin_transactions (user_id, amount, balance_after, kind, description, ref_id, created_by)
  values (p_user_id, p_amount, new_balance, p_kind, coalesce(p_description, ''), p_ref_id, p_created_by);
  return new_balance;
end;
$$;

revoke all on function public.apply_coin_change(uuid, integer, text, text, text, uuid) from public, anon, authenticated;

-- Unlocks a chapter for the signed-in member. Idempotent: an already unlocked or free chapter costs nothing.
-- Returns {status: free | already | unlocked | insufficient | not_found, price, balance}.
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
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  price := public.chapter_price(p_chapter_id);
  if price is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into public.wallets (user_id) values (uid) on conflict (user_id) do nothing;
  -- Lock the wallet row so concurrent unlock requests are serialized.
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

  select s.title || ' - Chương ' || c.chapter_number into chapter_label
  from public.chapters c join public.stories s on s.id = c.story_id where c.id = p_chapter_id;

  new_balance := public.apply_coin_change(uid, -price, 'unlock', 'Mở khóa ' || chapter_label, p_chapter_id::text, uid);
  insert into public.chapter_unlocks (user_id, chapter_id, coins_spent) values (uid, p_chapter_id, price);
  return jsonb_build_object('status', 'unlocked', 'price', price, 'balance', new_balance);
end;
$$;

revoke all on function public.unlock_chapter(uuid) from public, anon;
grant execute on function public.unlock_chapter(uuid) to authenticated;
grant execute on function public.chapter_price(uuid) to anon, authenticated;

-- Admin-only manual credit/debit with a mandatory reason (role 'admin' only). Returns the new balance.
create or replace function public.admin_adjust_coins(p_user_id uuid, p_amount integer, p_reason text)
returns integer
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_profiles where id = auth.uid() and role = 'admin' and status = 'active') then
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

revoke all on function public.admin_adjust_coins(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_coins(uuid, integer, text) to authenticated;

-- Admin-only member list with wallet totals.
create or replace function public.admin_list_members()
returns table (
  id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  balance integer, total_topup integer, total_spent integer, unlocked_chapters bigint, is_admin boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))::text,
         u.created_at, u.last_sign_in_at,
         coalesce(w.balance, 0),
         coalesce((select sum(t.amount) from public.coin_transactions t where t.user_id = u.id and t.kind in ('topup', 'bonus')), 0)::integer,
         coalesce((select -sum(t.amount) from public.coin_transactions t where t.user_id = u.id and t.kind = 'unlock'), 0)::integer,
         (select count(*) from public.chapter_unlocks cu where cu.user_id = u.id),
         exists (select 1 from public.admin_profiles a where a.id = u.id)
  from auth.users u
  left join public.wallets w on w.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;

-- Hide chapter content links (text_url) from the public API: anyone holding the publishable key could otherwise
-- list every paid chapter's file. Clients get the link only through chapter_text_url(), which checks access.
revoke select on public.chapters from anon, authenticated;
grant select (id, story_id, chapter_number, title, created_at, updated_at) on public.chapters to anon, authenticated;

-- Content link for a chapter: returned only when the chapter is free, unlocked by the caller, or the caller is an admin.
create or replace function public.chapter_text_url(p_chapter_id uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  price integer := public.chapter_price(p_chapter_id);
begin
  if price is null then
    return null;
  end if;
  if price = 0 or public.is_admin()
     or exists (select 1 from public.chapter_unlocks where user_id = auth.uid() and chapter_id = p_chapter_id) then
    return (select text_url from public.chapters where id = p_chapter_id);
  end if;
  return null;
end;
$$;

revoke all on function public.chapter_text_url(uuid) from public;
grant execute on function public.chapter_text_url(uuid) to anon, authenticated;

-- Page views are recorded only for stories that exist, so bots cannot fill the table with made-up slugs.
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
     or p_device not in ('mobile', 'tablet', 'desktop')
     or not exists (select 1 from public.stories where slug = p_story_slug) then
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
