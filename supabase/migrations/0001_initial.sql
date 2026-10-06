create type public.admin_role as enum ('admin', 'editor', 'moderator');
create type public.admin_status as enum ('active', 'suspended');

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.admin_role not null default 'moderator',
  status public.admin_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_profiles_email_idx on public.admin_profiles (lower(email));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where id = (select auth.uid())
      and role in ('admin', 'editor', 'moderator')
      and status = 'active'
  );
$$;

create or replace function public.handle_admin_profile_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.admin_profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated_admin_profile
after update of email on auth.users
for each row execute procedure public.handle_admin_profile_update();

alter table public.admin_profiles enable row level security;
create policy "Admins can view admin profiles"
  on public.admin_profiles for select to authenticated
  using (public.is_admin());
create policy "Admins can update admin profiles"
  on public.admin_profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Passwords are managed only by Supabase Auth and must never be stored here.
