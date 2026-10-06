import type { MetadataRoute } from "next";
import { chapterPrice } from "@/lib/coins";
import { siteInfo } from "@/lib/site";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;
const MAX_URLS = 45_000;

// Home, info pages, every story and every free chapter. Paid chapters are left out (they are noindex).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteInfo.url;
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    ...["gioi-thieu", "dieu-khoan", "chinh-sach-bao-mat", "lien-he"].map((path) => ({ url: `${base}/${path}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return entries;
  try {
    // Cookie-less public client: the sitemap is the same for everyone and can be cached.
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: stories } = await supabase.from("stories").select("id, slug, updated_at, lock_from_chapter, lock_price_coins").order("updated_at", { ascending: false });
    for (const story of stories ?? []) {
      entries.push({ url: `${base}/truyen/${story.slug}`, lastModified: story.updated_at, changeFrequency: "daily", priority: 0.8 });
    }
    const bySlug = new Map((stories ?? []).map((story) => [story.id, story]));
    for (let from = 0; entries.length < MAX_URLS; from += 1000) {
      const { data: chapters } = await supabase.from("chapters").select("story_id, chapter_number, updated_at").order("story_id").order("chapter_number").range(from, from + 999);
      if (!chapters?.length) break;
      for (const chapter of chapters) {
        const story = bySlug.get(chapter.story_id);
        if (story && chapterPrice(story, chapter.chapter_number) === 0 && entries.length < MAX_URLS) {
          entries.push({ url: `${base}/truyen/${story.slug}/chuong/${chapter.chapter_number}`, lastModified: chapter.updated_at, changeFrequency: "monthly", priority: 0.5 });
        }
      }
      if (chapters.length < 1000) break;
    }
  } catch {
    // The sitemap must not fail the build or request; return what we have.
  }
  return entries;
}
