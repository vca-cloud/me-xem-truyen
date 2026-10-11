import { AdminStoriesPage } from "@/components/admin-stories-page";
import { r2Config } from "@/lib/r2";
import { getViewStats, listStories, type StorySummary } from "@/lib/stories";
import { createClient } from "@/lib/supabase/server";

export default async function StoriesPage() {
  let stories: (StorySummary & { moderation: { pending: number; mature: number; ads_off: number }; hot_pinned: boolean; hot: boolean; affiliate_enabled?: boolean; affiliate_gate_minutes?: number; affiliate_link_id?: string | null })[] = [];
  let genres: string[] = [];
  let affiliateLinks: { id: string; name: string; placement: string; active: boolean }[] = [];
  let loadError: string | null = null;
  try {
    const supabase = await createClient();
    const [list, { data: genreRows }, { data: summary }, views] = await Promise.all([listStories(), supabase.from("genres").select("name").order("name"), supabase.rpc("admin_moderation_summary"), getViewStats()]);
    const byStory = new Map(((summary ?? []) as { story_id: string; pending: number; mature: number; ads_off: number }[]).map((row) => [row.story_id, row]));
    stories = list.map((story) => ({ ...story, moderation: byStory.get(story.id) ?? { pending: 0, mature: 0, ads_off: 0 }, hot_pinned: views.stats.get(story.id)?.hot_pinned ?? false, hot: views.hot.has(story.id) }));
    genres = (genreRows ?? []).map((genre) => genre.name);
    // Shopee pop-up settings (migration 0012) and the links that can be chosen; empty before the migration.
    const [{ data: affiliateRows }, { data: linkRows }] = await Promise.all([
      supabase.from("stories").select("id, affiliate_enabled, affiliate_gate_minutes, affiliate_link_id"),
      supabase.from("affiliate_links").select("id, name, placement, active").order("name"),
    ]);
    const affiliateById = new Map(((affiliateRows ?? []) as { id: string; affiliate_enabled: boolean; affiliate_gate_minutes: number; affiliate_link_id: string | null }[]).map((row) => [row.id, row]));
    stories = stories.map((story) => ({ ...story, affiliate_enabled: affiliateById.get(story.id)?.affiliate_enabled ?? false, affiliate_gate_minutes: affiliateById.get(story.id)?.affiliate_gate_minutes ?? 0, affiliate_link_id: affiliateById.get(story.id)?.affiliate_link_id ?? null }));
    affiliateLinks = (linkRows ?? []) as typeof affiliateLinks;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  const publicBucket = process.env.R2_PUBLIC_BUCKET;
  const r2 = {
    dashboardBase: r2Config.accountId && publicBucket ? `https://dash.cloudflare.com/${r2Config.accountId}/r2/default/buckets/${encodeURIComponent(publicBucket)}` : null,
    publicBase: r2Config.publicUrl?.replace(/\/$/, "") ?? null,
  };
  return <AdminStoriesPage stories={stories} genres={genres} affiliateLinks={affiliateLinks} r2={r2} loadError={loadError} />;
}
