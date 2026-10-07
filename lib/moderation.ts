import "server-only";

import { createClient } from "@supabase/supabase-js";
import { fetchChapterText } from "@/lib/chapter-content";
import { compileTerms, maskText, moderationDecision, scanText, type CompiledTerm, type ModerationTerm } from "@/lib/moderation-core";

const CACHE_MS = 60_000;
let cache: { at: number; terms: CompiledTerm[] } | null = null;

// Active dictionary, cached for a minute per server instance (edits in /admin/kiem-duyet apply within ~1 minute).
export async function getModerationTerms(): Promise<CompiledTerm[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.terms;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("moderation_terms").select("term, category, severity, mask_style").eq("active", true);
  if (error) return cache?.terms ?? [];
  cache = { at: Date.now(), terms: compileTerms((data ?? []) as ModerationTerm[]) };
  return cache.terms;
}

export function clearModerationCache() {
  cache = null;
}

// Masks dictionary words in text shown to readers (titles, descriptions, chapter content).
export async function maskForReaders(text: string) {
  if (!text) return text;
  return maskText(text, await getModerationTerms());
}

export type ChapterModeration = { ads_enabled: boolean; moderation_status: string; moderation_score: number; moderation_hits: unknown; is_mature: boolean; moderated_at: string; moderated_by: string | null };

// Scans one chapter (title + file content) and returns the columns to store.
// `adsOverride` is the admin's own choice made while publishing: it counts as a manual review.
export async function moderateChapter(input: { title: string; text_url: string; adsOverride?: boolean; adminId?: string }): Promise<ChapterModeration> {
  const terms = await getModerationTerms();
  let text = "";
  try {
    text = await fetchChapterText(input.text_url);
  } catch {
    // Unreadable file: scan the title only and keep the chapter in review so an admin looks at it.
  }
  const result = scanText(`${input.title}\n${text}`, terms);
  const decision = moderationDecision(result);
  const status = !text ? "pending" : decision.moderation_status;
  const adsDefault = !text ? false : decision.ads_enabled;
  const overridden = typeof input.adsOverride === "boolean";
  return {
    ads_enabled: overridden ? input.adsOverride! : adsDefault,
    moderation_status: overridden && status === "pending" ? "approved" : status,
    moderation_score: result.score,
    moderation_hits: result.hits,
    is_mature: decision.is_mature,
    moderated_at: new Date().toISOString(),
    moderated_by: overridden ? input.adminId ?? null : null,
  };
}

// Runs moderateChapter over many chapters with limited concurrency (files are fetched from R2).
export async function moderateChapters<T extends { title: string; text_url: string; adsOverride?: boolean }>(chapters: T[], adminId?: string, concurrency = 8) {
  const results: ChapterModeration[] = new Array(chapters.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, chapters.length) }, async () => {
    while (next < chapters.length) {
      const index = next++;
      results[index] = await moderateChapter({ ...chapters[index], adminId });
    }
  }));
  return results;
}
