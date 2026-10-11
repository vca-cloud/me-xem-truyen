import { HomePage, type HomeStory } from "@/components/home-page";
import type { HeaderGenre } from "@/components/site-header";
import { maskForReaders } from "@/lib/moderation";
import { getFeaturedStoryIds, getGenreCatalog, getViewStats, listStories } from "@/lib/stories";
import { publicViews } from "@/lib/views";

const RECOMMENDED_COUNT = 4;

export default async function Home() {
  let stories: HomeStory[] = [];
  let recommended: string[] = [];
  let catalog: HeaderGenre[] = [];
  let loadError: string | null = null;
  try {
    const [rows, genres, views, featured] = await Promise.all([listStories(), getGenreCatalog(), getViewStats(), getFeaturedStoryIds()]);
    catalog = genres;
    stories = await Promise.all(rows.map(async ({ id, slug, title, author, status, genres, chapter_count, cover_url, created_at, updated_at }) => ({ slug, title: await maskForReaders(title), author, status, genres, chapter_count, cover_url, created_at, updated_at, views: publicViews(views.stats.get(id)?.total_views ?? 0), hot: views.hot.has(id) })));
    // "Gợi ý truyện": admin picks first, then the most read stories of the last 7 days (real views), then the
    // most recently updated — so the section always has RECOMMENDED_COUNT stories once enough stories exist.
    const slugById = new Map(rows.map((row) => [row.id, row.slug]));
    const byViews = rows.filter((row) => (views.stats.get(row.id)?.views_7d ?? 0) > 0).sort((a, b) => (views.stats.get(b.id)?.views_7d ?? 0) - (views.stats.get(a.id)?.views_7d ?? 0));
    recommended = [...new Set([...featured.map((id) => slugById.get(id)).filter((slug): slug is string => !!slug), ...byViews.map((row) => row.slug), ...rows.map((row) => row.slug)])].slice(0, RECOMMENDED_COUNT);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <HomePage stories={stories} recommended={recommended} catalog={catalog} loadError={loadError} />;
}
