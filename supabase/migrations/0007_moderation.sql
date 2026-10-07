-- Content moderation (Google AdSense publisher policies): a word list used to mask text on public pages and to
-- score chapters when they are published. Chapters with severity >= 2 hits start with ads off and wait for review.
-- Severity: 1 = mask only (ads stay on) · 2 = ads off + manual review · 3 = ads off + review (+ 18+ for sexual content).

create table public.moderation_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (length(trim(term)) between 1 and 80),
  category text not null check (category in ('violence', 'self_harm', 'sexual', 'drugs', 'hate', 'profanity')),
  severity smallint not null check (severity between 1 and 3),
  mask_style text not null default 'stars' check (mask_style in ('stars', 'dots', 'none')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index moderation_terms_term_idx on public.moderation_terms (lower(term));

alter table public.moderation_terms enable row level security;
-- Active terms are readable by everyone: the public pages need them to mask text.
create policy "Active moderation terms are public" on public.moderation_terms for select using (active or public.is_admin());
create policy "Admins manage moderation terms" on public.moderation_terms for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.chapters
  add column ads_enabled boolean not null default true,
  add column moderation_status text not null default 'unscanned' check (moderation_status in ('unscanned', 'clean', 'pending', 'approved')),
  add column moderation_score integer not null default 0,
  add column moderation_hits jsonb not null default '[]'::jsonb,
  add column is_mature boolean not null default false,
  add column moderated_at timestamptz,
  add column moderated_by uuid references auth.users(id) on delete set null;

comment on column public.chapters.ads_enabled is 'false = no AdSense on this chapter (set by moderation or an admin).';
comment on column public.chapters.is_mature is '18+ content; shown to admins only.';

-- Public pages may read ads_enabled; moderation details stay admin-only (read through admin_list_chapters()).
grant select (ads_enabled) on public.chapters to anon, authenticated;

-- Admin chapter list now includes moderation fields (return type changed, so drop and recreate).
drop function if exists public.admin_list_chapters(uuid);
create function public.admin_list_chapters(p_story_id uuid)
returns table (
  id uuid, chapter_number integer, title text, text_url text, updated_at timestamptz,
  ads_enabled boolean, moderation_status text, moderation_score integer, moderation_hits jsonb, is_mature boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select c.id, c.chapter_number, c.title, c.text_url, c.updated_at,
         c.ads_enabled, c.moderation_status, c.moderation_score, c.moderation_hits, c.is_mature
  from public.chapters c where c.story_id = p_story_id order by c.chapter_number;
end;
$$;

revoke all on function public.admin_list_chapters(uuid) from public, anon;
grant execute on function public.admin_list_chapters(uuid) to authenticated;

-- Per-story moderation summary for the admin story list and review queue.
create or replace function public.admin_moderation_summary()
returns table (story_id uuid, pending integer, ads_off integer, mature integer, unscanned integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select c.story_id,
         count(*) filter (where c.moderation_status = 'pending')::integer,
         count(*) filter (where not c.ads_enabled)::integer,
         count(*) filter (where c.is_mature)::integer,
         count(*) filter (where c.moderation_status = 'unscanned')::integer
  from public.chapters c group by c.story_id;
end;
$$;

revoke all on function public.admin_moderation_summary() from public, anon;
grant execute on function public.admin_moderation_summary() to authenticated;

-- Review queue: chapters waiting for review or marked 18+, most serious first.
create or replace function public.admin_moderation_queue(p_include_reviewed boolean default false)
returns table (
  id uuid, story_id uuid, story_title text, story_slug text, chapter_number integer, title text,
  ads_enabled boolean, moderation_status text, moderation_score integer, moderation_hits jsonb, is_mature boolean, moderated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  select c.id, c.story_id, s.title, s.slug, c.chapter_number, c.title,
         c.ads_enabled, c.moderation_status, c.moderation_score, c.moderation_hits, c.is_mature, c.moderated_at
  from public.chapters c join public.stories s on s.id = c.story_id
  where c.moderation_status = 'pending' or (p_include_reviewed and (c.is_mature or not c.ads_enabled or c.moderation_status = 'approved'))
  order by (c.moderation_status = 'pending') desc, c.moderation_score desc, s.title, c.chapter_number
  limit 500;
end;
$$;

revoke all on function public.admin_moderation_queue(boolean) from public, anon;
grant execute on function public.admin_moderation_queue(boolean) to authenticated;

-- Starter dictionary (309 entries). Admins edit it at /admin/kiem-duyet.
insert into public.moderation_terms (term, category, severity, mask_style) values
  ('chết', 'violence', 1, 'dots'),
  ('giết', 'violence', 1, 'dots'),
  ('giết người', 'violence', 1, 'dots'),
  ('giết chết', 'violence', 1, 'dots'),
  ('bị giết', 'violence', 1, 'dots'),
  ('chết chóc', 'violence', 1, 'dots'),
  ('giết chóc', 'violence', 1, 'dots'),
  ('chém giết', 'violence', 1, 'dots'),
  ('tàn sát', 'violence', 1, 'dots'),
  ('thảm sát', 'violence', 1, 'dots'),
  ('sát hại', 'violence', 1, 'dots'),
  ('ám sát', 'violence', 1, 'dots'),
  ('hạ sát', 'violence', 1, 'dots'),
  ('xác chết', 'violence', 1, 'dots'),
  ('thi thể', 'violence', 1, 'dots'),
  ('thi hài', 'violence', 1, 'dots'),
  ('tử thi', 'violence', 1, 'dots'),
  ('xác người', 'violence', 1, 'dots'),
  ('máu me', 'violence', 1, 'dots'),
  ('đổ máu', 'violence', 1, 'dots'),
  ('hộc máu', 'violence', 1, 'dots'),
  ('thổ huyết', 'violence', 1, 'dots'),
  ('phun máu', 'violence', 1, 'dots'),
  ('vũng máu', 'violence', 1, 'dots'),
  ('bê bết máu', 'violence', 1, 'dots'),
  ('đầm đìa máu', 'violence', 1, 'dots'),
  ('đánh chết', 'violence', 1, 'dots'),
  ('đâm chết', 'violence', 1, 'dots'),
  ('chém chết', 'violence', 1, 'dots'),
  ('bắn chết', 'violence', 1, 'dots'),
  ('đập chết', 'violence', 1, 'dots'),
  ('bóp cổ', 'violence', 1, 'dots'),
  ('siết cổ', 'violence', 1, 'dots'),
  ('bóp chết', 'violence', 1, 'dots'),
  ('hành hung', 'violence', 1, 'dots'),
  ('hành hạ', 'violence', 1, 'dots'),
  ('đánh đập', 'violence', 1, 'dots'),
  ('bạo hành', 'violence', 1, 'dots'),
  ('ngược đãi', 'violence', 1, 'dots'),
  ('hành quyết', 'violence', 1, 'dots'),
  ('xử trảm', 'violence', 1, 'dots'),
  ('xử tử', 'violence', 1, 'dots'),
  ('chém đầu', 'violence', 1, 'dots'),
  ('chặt đầu', 'violence', 1, 'dots'),
  ('treo cổ chết', 'violence', 1, 'dots'),
  ('thiêu sống', 'violence', 1, 'dots'),
  ('chôn sống', 'violence', 1, 'dots'),
  ('giết người diệt khẩu', 'violence', 1, 'dots'),
  ('diệt khẩu', 'violence', 1, 'dots'),
  ('thủ tiêu', 'violence', 1, 'dots'),
  ('sát thủ', 'violence', 1, 'dots'),
  ('bạo lực', 'violence', 1, 'dots'),
  ('tra tấn', 'violence', 2, 'dots'),
  ('cực hình', 'violence', 2, 'dots'),
  ('nhục hình', 'violence', 2, 'dots'),
  ('lăng trì', 'violence', 2, 'dots'),
  ('tùng xẻo', 'violence', 2, 'dots'),
  ('xẻo thịt', 'violence', 2, 'dots'),
  ('lóc thịt', 'violence', 2, 'dots'),
  ('lột da', 'violence', 2, 'dots'),
  ('móc mắt', 'violence', 2, 'dots'),
  ('cắt lưỡi', 'violence', 2, 'dots'),
  ('chặt tay', 'violence', 2, 'dots'),
  ('chặt chân', 'violence', 2, 'dots'),
  ('phanh thây', 'violence', 2, 'dots'),
  ('phân thây', 'violence', 2, 'dots'),
  ('banh xác', 'violence', 2, 'dots'),
  ('nát thây', 'violence', 2, 'dots'),
  ('nát bét', 'violence', 2, 'dots'),
  ('vỡ sọ', 'violence', 2, 'dots'),
  ('óc văng', 'violence', 2, 'dots'),
  ('lòi ruột', 'violence', 2, 'dots'),
  ('moi ruột', 'violence', 2, 'dots'),
  ('mổ bụng', 'violence', 2, 'dots'),
  ('xé xác', 'violence', 2, 'dots'),
  ('cắn xé', 'violence', 2, 'dots'),
  ('ăn thịt người', 'violence', 2, 'dots'),
  ('uống máu người', 'violence', 2, 'dots'),
  ('xác không toàn thây', 'violence', 2, 'dots'),
  ('thịt nát xương tan', 'violence', 2, 'dots'),
  ('máu thịt be bét', 'violence', 2, 'dots'),
  ('ruột gan lòi ra', 'violence', 2, 'dots'),
  ('giết trẻ em', 'violence', 3, 'dots'),
  ('hành hạ trẻ em', 'violence', 3, 'dots'),
  ('tra tấn đến chết', 'violence', 3, 'dots'),
  ('ngược sát', 'violence', 3, 'dots'),
  ('thú tính hành hạ', 'violence', 3, 'dots'),
  ('tự sát', 'self_harm', 2, 'dots'),
  ('tự tử', 'self_harm', 2, 'dots'),
  ('tự vẫn', 'self_harm', 2, 'dots'),
  ('quyên sinh', 'self_harm', 2, 'dots'),
  ('tìm đến cái chết', 'self_harm', 2, 'dots'),
  ('kết liễu đời mình', 'self_harm', 2, 'dots'),
  ('treo cổ', 'self_harm', 2, 'dots'),
  ('thắt cổ', 'self_harm', 2, 'dots'),
  ('nhảy lầu', 'self_harm', 2, 'dots'),
  ('nhảy cầu', 'self_harm', 2, 'dots'),
  ('nhảy sông tự tử', 'self_harm', 2, 'dots'),
  ('uống thuốc độc', 'self_harm', 2, 'dots'),
  ('uống thuốc ngủ', 'self_harm', 2, 'dots'),
  ('cắt cổ tay', 'self_harm', 2, 'dots'),
  ('rạch cổ tay', 'self_harm', 2, 'dots'),
  ('cứa tay', 'self_harm', 2, 'dots'),
  ('tự rạch', 'self_harm', 2, 'dots'),
  ('tự hại', 'self_harm', 2, 'dots'),
  ('tự làm hại bản thân', 'self_harm', 2, 'dots'),
  ('kết thúc cuộc đời', 'self_harm', 2, 'dots'),
  ('tuyệt thực đến chết', 'self_harm', 2, 'dots'),
  ('cách tự tử', 'self_harm', 3, 'dots'),
  ('hướng dẫn tự tử', 'self_harm', 3, 'dots'),
  ('rủ nhau tự tử', 'self_harm', 3, 'dots'),
  ('ma túy', 'drugs', 2, 'dots'),
  ('ma tuý', 'drugs', 2, 'dots'),
  ('heroin', 'drugs', 2, 'dots'),
  ('bạch phiến', 'drugs', 2, 'dots'),
  ('thuốc phiện', 'drugs', 2, 'dots'),
  ('nha phiến', 'drugs', 2, 'dots'),
  ('á phiến', 'drugs', 2, 'dots'),
  ('cần sa', 'drugs', 2, 'dots'),
  ('bồ đà', 'drugs', 2, 'dots'),
  ('thuốc lắc', 'drugs', 2, 'dots'),
  ('cocaine', 'drugs', 2, 'dots'),
  ('cô-ca-in', 'drugs', 2, 'dots'),
  ('methamphetamine', 'drugs', 2, 'dots'),
  ('ma túy đá', 'drugs', 2, 'dots'),
  ('hàng trắng', 'drugs', 2, 'dots'),
  ('chích hút', 'drugs', 2, 'dots'),
  ('tiêm chích', 'drugs', 2, 'dots'),
  ('phê thuốc', 'drugs', 2, 'dots'),
  ('hít thuốc lắc', 'drugs', 2, 'dots'),
  ('buôn ma túy', 'drugs', 2, 'dots'),
  ('nghiện ngập', 'drugs', 2, 'dots'),
  ('con nghiện', 'drugs', 2, 'dots'),
  ('hút chích', 'drugs', 2, 'dots'),
  ('mại dâm', 'sexual', 2, 'stars'),
  ('cách chế ma túy', 'drugs', 3, 'dots'),
  ('điều chế ma túy', 'drugs', 3, 'dots'),
  ('công thức ma túy', 'drugs', 3, 'dots'),
  ('lên giường', 'sexual', 1, 'stars'),
  ('mây mưa', 'sexual', 1, 'stars'),
  ('ân ái', 'sexual', 1, 'stars'),
  ('hoan ái', 'sexual', 1, 'stars'),
  ('giao hoan', 'sexual', 1, 'stars'),
  ('vui vẻ trên giường', 'sexual', 1, 'stars'),
  ('lõa thể', 'sexual', 1, 'stars'),
  ('khỏa thân', 'sexual', 1, 'stars'),
  ('trần truồng', 'sexual', 1, 'stars'),
  ('lộ hàng', 'sexual', 1, 'stars'),
  ('gợi dục', 'sexual', 1, 'stars'),
  ('khiêu dâm', 'sexual', 1, 'stars'),
  ('dâm đãng', 'sexual', 1, 'stars'),
  ('dâm loạn', 'sexual', 1, 'stars'),
  ('dâm tặc', 'sexual', 1, 'stars'),
  ('háo sắc', 'sexual', 1, 'stars'),
  ('sàm sỡ', 'sexual', 1, 'stars'),
  ('làm tình', 'sexual', 2, 'stars'),
  ('quan hệ tình dục', 'sexual', 2, 'stars'),
  ('ân ái mặn nồng', 'sexual', 2, 'stars'),
  ('động phòng hoa chúc kịch liệt', 'sexual', 2, 'stars'),
  ('giường chiếu', 'sexual', 2, 'stars'),
  ('chuyện giường chiếu', 'sexual', 2, 'stars'),
  ('tình một đêm', 'sexual', 2, 'stars'),
  ('lên đỉnh', 'sexual', 2, 'stars'),
  ('cực khoái', 'sexual', 2, 'stars'),
  ('dục vọng', 'sexual', 2, 'stars'),
  ('thú dục', 'sexual', 2, 'stars'),
  ('ham muốn thể xác', 'sexual', 2, 'stars'),
  ('xuân dược', 'sexual', 2, 'stars'),
  ('mị dược', 'sexual', 2, 'stars'),
  ('thuốc kích dục', 'sexual', 2, 'stars'),
  ('kích dục', 'sexual', 2, 'stars'),
  ('cưỡng hôn', 'sexual', 2, 'stars'),
  ('ép buộc thân mật', 'sexual', 2, 'stars'),
  ('loạn luân', 'sexual', 2, 'stars'),
  ('ngoại tình thể xác', 'sexual', 2, 'stars'),
  ('địt', 'sexual', 3, 'stars'),
  ('đụ', 'sexual', 3, 'stars'),
  ('chịch', 'sexual', 3, 'stars'),
  ('xếp hình', 'sexual', 3, 'stars'),
  ('bú mút', 'sexual', 3, 'stars'),
  ('bú cu', 'sexual', 3, 'stars'),
  ('thổi kèn', 'sexual', 3, 'stars'),
  ('liếm láp', 'sexual', 3, 'stars'),
  ('móc lồn', 'sexual', 3, 'stars'),
  ('lồn', 'sexual', 3, 'stars'),
  ('cặc', 'sexual', 3, 'stars'),
  ('buồi', 'sexual', 3, 'stars'),
  ('dương vật', 'sexual', 3, 'stars'),
  ('âm vật', 'sexual', 3, 'stars'),
  ('âm hộ', 'sexual', 3, 'stars'),
  ('âm đạo', 'sexual', 3, 'stars'),
  ('tinh dịch', 'sexual', 3, 'stars'),
  ('xuất tinh', 'sexual', 3, 'stars'),
  ('bắn tinh', 'sexual', 3, 'stars'),
  ('dâm thủy', 'sexual', 3, 'stars'),
  ('dâm thuỷ', 'sexual', 3, 'stars'),
  ('núm vú', 'sexual', 3, 'stars'),
  ('đầu vú', 'sexual', 3, 'stars'),
  ('ngực trần', 'sexual', 3, 'stars'),
  ('cương cứng', 'sexual', 3, 'stars'),
  ('thủ dâm', 'sexual', 3, 'stars'),
  ('sục cặc', 'sexual', 3, 'stars'),
  ('hiếp dâm', 'sexual', 3, 'stars'),
  ('cưỡng hiếp', 'sexual', 3, 'stars'),
  ('cưỡng bức', 'sexual', 3, 'stars'),
  ('luân dâm', 'sexual', 3, 'stars'),
  ('ấu dâm', 'sexual', 3, 'stars'),
  ('làm nhục thân thể', 'sexual', 3, 'stars'),
  ('sex', 'sexual', 3, 'stars'),
  ('porn', 'sexual', 3, 'stars'),
  ('phim sex', 'sexual', 3, 'stars'),
  ('truyện sex', 'sexual', 3, 'stars'),
  ('18+', 'sexual', 3, 'stars'),
  ('cởi sạch', 'sexual', 3, 'stars'),
  ('lột sạch quần áo', 'sexual', 3, 'stars'),
  ('hạ thể', 'sexual', 3, 'stars'),
  ('chỗ kín', 'sexual', 3, 'stars'),
  ('bắc kỳ', 'hate', 2, 'stars'),
  ('nam kỳ', 'hate', 2, 'stars'),
  ('parky', 'hate', 2, 'stars'),
  ('namkiki', 'hate', 2, 'stars'),
  ('đồ mọi', 'hate', 2, 'stars'),
  ('thằng mọi', 'hate', 2, 'stars'),
  ('mọi rợ', 'hate', 2, 'stars'),
  ('man di', 'hate', 2, 'stars'),
  ('đồ nhà quê', 'hate', 2, 'stars'),
  ('tàu khựa', 'hate', 2, 'stars'),
  ('khựa', 'hate', 2, 'stars'),
  ('đồ ăn hại', 'hate', 2, 'stars'),
  ('bê đê', 'hate', 2, 'stars'),
  ('pê đê', 'hate', 2, 'stars'),
  ('xăng pha nhớt', 'hate', 2, 'stars'),
  ('ô môi', 'hate', 2, 'stars'),
  ('đồng bóng', 'hate', 2, 'stars'),
  ('đồ thiểu năng', 'hate', 2, 'stars'),
  ('đồ tàn tật', 'hate', 2, 'stars'),
  ('đồ què', 'hate', 2, 'stars'),
  ('thằng mù', 'hate', 2, 'stars'),
  ('đồ điếc', 'hate', 2, 'stars'),
  ('giống chó', 'hate', 2, 'stars'),
  ('súc vật', 'hate', 2, 'stars'),
  ('loài súc sinh', 'hate', 2, 'stars'),
  ('đồ súc sinh', 'hate', 2, 'stars'),
  ('chủng tộc hạ đẳng', 'hate', 2, 'stars'),
  ('đàn bà ngu', 'hate', 2, 'stars'),
  ('giết sạch bọn', 'hate', 3, 'stars'),
  ('tiêu diệt chủng tộc', 'hate', 3, 'stars'),
  ('diệt chủng', 'hate', 3, 'stars'),
  ('chết tiệt', 'profanity', 1, 'stars'),
  ('khốn nạn', 'profanity', 1, 'stars'),
  ('khốn kiếp', 'profanity', 1, 'stars'),
  ('đồ khốn', 'profanity', 1, 'stars'),
  ('tên khốn', 'profanity', 1, 'stars'),
  ('mẹ kiếp', 'profanity', 1, 'stars'),
  ('cha mày', 'profanity', 1, 'stars'),
  ('mẹ mày', 'profanity', 1, 'stars'),
  ('con mẹ mày', 'profanity', 1, 'stars'),
  ('đồ chó', 'profanity', 1, 'stars'),
  ('thằng chó', 'profanity', 1, 'stars'),
  ('con chó cái', 'profanity', 1, 'stars'),
  ('chó má', 'profanity', 1, 'stars'),
  ('chó chết', 'profanity', 1, 'stars'),
  ('đồ ngu', 'profanity', 1, 'stars'),
  ('ngu như bò', 'profanity', 1, 'stars'),
  ('óc chó', 'profanity', 1, 'stars'),
  ('đồ rác rưởi', 'profanity', 1, 'stars'),
  ('đồ rẻ rách', 'profanity', 1, 'stars'),
  ('dâm phụ', 'profanity', 1, 'stars'),
  ('đm', 'profanity', 2, 'stars'),
  ('đmm', 'profanity', 2, 'stars'),
  ('dmm', 'profanity', 2, 'stars'),
  ('đcm', 'profanity', 2, 'stars'),
  ('dcm', 'profanity', 2, 'stars'),
  ('đkm', 'profanity', 2, 'stars'),
  ('vcl', 'profanity', 2, 'stars'),
  ('vkl', 'profanity', 2, 'stars'),
  ('vãi lồn', 'profanity', 2, 'stars'),
  ('vãi cả lồn', 'profanity', 2, 'stars'),
  ('vãi cặc', 'profanity', 2, 'stars'),
  ('đéo', 'profanity', 2, 'stars'),
  ('đếch', 'profanity', 2, 'stars'),
  ('đ** mẹ', 'profanity', 2, 'stars'),
  ('địt mẹ', 'profanity', 2, 'stars'),
  ('đụ mẹ', 'profanity', 2, 'stars'),
  ('đụ má', 'profanity', 2, 'stars'),
  ('đù má', 'profanity', 2, 'stars'),
  ('clgt', 'profanity', 2, 'stars'),
  ('cmm', 'profanity', 2, 'stars'),
  ('đĩ', 'profanity', 2, 'stars'),
  ('đĩ điếm', 'profanity', 2, 'stars'),
  ('con đĩ', 'profanity', 2, 'stars'),
  ('đồ đĩ', 'profanity', 2, 'stars'),
  ('gái điếm', 'profanity', 2, 'stars'),
  ('điếm', 'profanity', 2, 'stars'),
  ('cave', 'profanity', 2, 'stars'),
  ('gái gọi', 'profanity', 2, 'stars'),
  ('gái bao', 'profanity', 2, 'stars'),
  ('phò', 'profanity', 2, 'stars'),
  ('con phò', 'profanity', 2, 'stars'),
  ('đồ phò', 'profanity', 2, 'stars'),
  ('chó đẻ', 'profanity', 2, 'stars'),
  ('đồ chó đẻ', 'profanity', 2, 'stars'),
  ('mả cha', 'profanity', 2, 'stars'),
  ('mả mẹ', 'profanity', 2, 'stars'),
  ('tổ cha', 'profanity', 2, 'stars'),
  ('tiên sư', 'profanity', 2, 'stars'),
  ('tiên sư bố', 'profanity', 2, 'stars'),
  ('bố láo', 'profanity', 2, 'stars'),
  ('đồ mất nết', 'profanity', 2, 'stars')
on conflict do nothing;

notify pgrst, 'reload schema';
