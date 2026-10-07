import { AdminStoriesPage } from "@/components/admin-stories-page";
import { r2Config } from "@/lib/r2";
import { listStories, type StorySummary } from "@/lib/stories";
import { createClient } from "@/lib/supabase/server";

export default async function StoriesPage() {
  let stories: StorySummary[] = [];
  let genres: string[] = [];
  let loadError: string | null = null;
  try {
    const supabase = await createClient();
    const [list, { data: genreRows }] = await Promise.all([listStories(), supabase.from("genres").select("name").order("name")]);
    stories = list;
    genres = (genreRows ?? []).map((genre) => genre.name);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  const publicBucket = process.env.R2_PUBLIC_BUCKET;
  const r2 = {
    dashboardBase: r2Config.accountId && publicBucket ? `https://dash.cloudflare.com/${r2Config.accountId}/r2/default/buckets/${encodeURIComponent(publicBucket)}` : null,
    publicBase: r2Config.publicUrl?.replace(/\/$/, "") ?? null,
  };
  return <AdminStoriesPage stories={stories} genres={genres} r2={r2} loadError={loadError} />;
}
