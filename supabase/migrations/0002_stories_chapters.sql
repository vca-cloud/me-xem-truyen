create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  description text not null default '',
  cover_url text,
  status text not null default 'Đang ra' check (status in ('Đang ra', 'Hoàn thành', 'Tạm dừng')),
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.story_genres (
  story_id uuid not null references public.stories(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (story_id, genre_id)
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title text not null,
  text_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, chapter_number)
);

create index chapters_story_number_idx on public.chapters (story_id, chapter_number desc);

alter table public.stories enable row level security;
alter table public.genres enable row level security;
alter table public.story_genres enable row level security;
alter table public.chapters enable row level security;

create policy "Published stories are public" on public.stories for select using (true);
create policy "Genres are public" on public.genres for select using (true);
create policy "Story genres are public" on public.story_genres for select using (true);
create policy "Chapter metadata is public" on public.chapters for select using (true);

create policy "Admins manage stories" on public.stories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage genres" on public.genres for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage story genres" on public.story_genres for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage chapters" on public.chapters for all to authenticated using (public.is_admin()) with check (public.is_admin());
