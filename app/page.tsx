import { HomePage, type HomeStory } from "@/components/home-page";
import type { HeaderGenre } from "@/components/site-header";
import { maskForReaders } from "@/lib/moderation";
import { getGenreCatalog, getViewStats, listStories } from "@/lib/stories";
import { publicViews } from "@/lib/views";

export default async function Home() {
  let stories: HomeStory[] = [];
  let catalog: HeaderGenre[] = [];
  let loadError: string | null = null;
  try {
    const [rows, genres, views] = await Promise.all([listStories(), getGenreCatalog(), getViewStats()]);
    catalog = genres;
    stories = await Promise.all(rows.map(async ({ id, slug, title, author, status, genres, chapter_count, cover_url, created_at, updated_at }) => ({ slug, title: await maskForReaders(title), author, status, genres, chapter_count, cover_url, created_at, updated_at, views: publicViews(views.stats.get(id)?.total_views ?? 0), hot: views.hot.has(id) })));
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <HomePage stories={stories} catalog={catalog} loadError={loadError} />;
}
