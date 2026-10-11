import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maskForReaders } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { storySlug, type Chapter, type StoryStatus } from "@/lib/story-data";
import { hotStoryIds, type ViewStats } from "@/lib/views";

export type StorySummary = {
  id: string;
  slug: string;
  title: string;
  author: string;
  description: string;
  cover_url: string | null;
  audio_url: string | null;
  status: StoryStatus;
  lock_from_chapter: number | null;
  lock_price_coins: number;
  ads_disabled: boolean;
  genres: string[];
  chapter_count: number;
  created_at: string;
  updated_at: string;
};

export type StoryDetail = StorySummary & { chapters: (Required<Pick<Chapter, "id" | "chapter_number" | "title">> & { ads_enabled: boolean })[] };

type StoryRow = Omit<StorySummary, "genres" | "chapter_count"> & {
  story_genres: { genres: { name: string } | null }[] | null;
};

const summaryColumns = "id, slug, title, author, description, cover_url, audio_url, status, lock_from_chapter, lock_price_coins, ads_disabled, created_at, updated_at, story_genres(genres(name))";

function toSummary(row: StoryRow, chapterCounts: Map<string, number>): StorySummary {
  const { story_genres, ...story } = row;
  return {
    ...story,
    genres: (story_genres ?? []).map((item) => item.genres?.name).filter((name): name is string => !!name),
    chapter_count: chapterCounts.get(story.id) ?? 0,
  };
}

// chapters is not readable table-wide (text_url is hidden), so counts come from public.story_chapter_counts().
async function chapterCounts(supabase: SupabaseClient, storyIds?: string[]) {
  const { data, error } = await supabase.rpc("story_chapter_counts", { p_story_ids: storyIds ?? null });
  if (error) throw new Error(`Không thể đếm chương: ${error.message}`);
  return new Map(((data ?? []) as { story_id: string; chapter_count: number }[]).map((row) => [row.story_id, row.chapter_count]));
}

// All stories, most recently updated first. Public data (RLS: select is open).
export async function listStories(): Promise<StorySummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(summaryColumns).order("updated_at", { ascending: false });
  if (error) throw new Error(`Không thể tải danh sách truyện: ${error.message}`);
  const counts = await chapterCounts(supabase);
  return ((data ?? []) as unknown as StoryRow[]).map((row) => toSummary(row, counts));
}

// One story with all chapters in reading order, or null when the slug does not exist.
export const getStory = cache(async (slug: string): Promise<StoryDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(summaryColumns).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Không thể tải truyện: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as StoryRow;
  const { data: chapters, error: chapterError } = await supabase
    .from("chapters")
    .select("id, chapter_number, title, ads_enabled")
    .eq("story_id", row.id)
    .order("chapter_number", { ascending: true });
  if (chapterError) throw new Error(`Không thể tải danh sách chương: ${chapterError.message}`);
  const list = chapters ?? [];
  return { ...toSummary(row, new Map([[row.id, list.length]])), chapters: list };
});

// Story as shown to readers: dictionary words masked in the title, description and chapter titles.
export const getReaderStory = cache(async (slug: string): Promise<StoryDetail | null> => {
  const story = await getStory(slug);
  if (!story) return null;
  const [title, description, chapterTitles] = await Promise.all([
    maskForReaders(story.title),
    maskForReaders(story.description),
    Promise.all(story.chapters.map((chapter) => maskForReaders(chapter.title))),
  ]);
  return { ...story, title, description, chapters: story.chapters.map((chapter, index) => ({ ...chapter, title: chapterTitles[index] })) };
});

// Splits "Tiên Hiệp | Tu Tiên, Huyền Huyễn" into unique genre names.
export function parseGenreNames(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[|,;]/) : [];
  const names = items.map((item) => String(item).trim()).filter((item) => item && item.length <= 60);
  return [...new Map(names.map((name) => [name.toLocaleLowerCase(), name])).values()].slice(0, 10);
}

// Replaces a story's genres, creating missing genres by slug. Requires an admin session (RLS).
export async function setStoryGenres(supabase: SupabaseClient, storyId: string, names: string[]) {
  const { error: clearError } = await supabase.from("story_genres").delete().eq("story_id", storyId);
  if (clearError) throw new Error(clearError.message);
  if (!names.length) return;
  const rows = [...new Map(names.map((name) => [storySlug(name), { name, slug: storySlug(name) }])).values()].filter((row) => row.slug);
  const { data: genres, error } = await supabase.from("genres").upsert(rows, { onConflict: "slug", ignoreDuplicates: false }).select("id");
  if (error) throw new Error(error.message);
  const { error: linkError } = await supabase.from("story_genres").insert((genres ?? []).map((genre) => ({ story_id: storyId, genre_id: genre.id })));
  if (linkError) throw new Error(linkError.message);
}

export async function touchStory(supabase: SupabaseClient, storyId: string) {
  await supabase.from("stories").update({ updated_at: new Date().toISOString() }).eq("id", storyId);
}

export type ChapterAccess = { price: number; userId: string | null; unlocked: boolean; balance: number | null };

// Whether the current visitor may read a chapter: free, already unlocked, or locked (with their balance).
export async function getChapterAccess(chapterId: string, price: number): Promise<ChapterAccess> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { price, userId: null, unlocked: price === 0, balance: null };
  const [{ data: wallet }, { data: unlock }] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    price > 0 ? supabase.from("chapter_unlocks").select("chapter_id").eq("user_id", user.id).eq("chapter_id", chapterId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { price, userId: user.id, unlocked: price === 0 || !!unlock, balance: wallet?.balance ?? 0 };
}

// Content link of a chapter, or null when the visitor has no access (decided by public.chapter_text_url in SQL).
export async function getChapterTextUrl(chapterId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chapter_text_url", { p_chapter_id: chapterId });
  if (error) throw new Error(`Không thể tải chương: ${error.message}`);
  return typeof data === "string" ? data : null;
}

// Genre catalog created in admin, for the header menu and search filters.
export const getGenreCatalog = cache(async (): Promise<{ name: string; slug: string }[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("genres").select("name, slug").order("name");
  return (data ?? []).sort((a, b) => a.name.localeCompare(b.name, "vi"));
});

// Real view counts per story id plus the set of HOT story ids. Empty when the stats function is unavailable
// (e.g. migration 0009 not run yet), so pages still render without numbers.
export const getViewStats = cache(async (): Promise<{ stats: Map<string, ViewStats>; hot: Set<string> }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("story_view_stats");
  if (error || !data) return { stats: new Map(), hot: new Set() };
  const stats = new Map((data as ({ story_id: string } & ViewStats)[]).map(({ story_id, ...value }) => [story_id, value]));
  return { stats, hot: hotStoryIds(stats) };
});

// Shopee pop-up for a story's free chapters (migration 0012); null when off, no link, or before the migration.
export async function getStoryPopup(storyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("story_affiliate_popup", { p_story_id: storyId });
  const row = !error && Array.isArray(data) ? (data[0] as { link_id: string; name: string; image_url: string | null; headline: string | null; gate_minutes: number } | undefined) : undefined;
  return row ? { linkId: row.link_id, name: row.name, imageUrl: row.image_url, headline: row.headline, gateMinutes: row.gate_minutes } : null;
}
