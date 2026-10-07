-- Chapter counts per story. PostgREST's embedded `chapters(count)` needs table-wide SELECT on chapters, which
-- 0004 removed to hide text_url; this function returns only the counts.
create or replace function public.story_chapter_counts(p_story_ids uuid[] default null)
returns table (story_id uuid, chapter_count integer)
language sql stable security definer set search_path = public
as $$
  select c.story_id, count(*)::integer
  from public.chapters c
  where p_story_ids is null or c.story_id = any (p_story_ids)
  group by c.story_id;
$$;

revoke all on function public.story_chapter_counts(uuid[]) from public;
grant execute on function public.story_chapter_counts(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
