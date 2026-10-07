import { HomePage, type HomeStory } from "@/components/home-page";
import type { HeaderGenre } from "@/components/site-header";
import { maskForReaders } from "@/lib/moderation";
import { getGenreCatalog, listStories } from "@/lib/stories";

export default async function Home() {
  let stories: HomeStory[] = [];
  let catalog: HeaderGenre[] = [];
  let loadError: string | null = null;
  try {
    [stories, catalog] = await Promise.all([
      listStories().then((rows) => Promise.all(rows.map(async ({ slug, title, author, status, genres, chapter_count, cover_url, created_at, updated_at }) => ({ slug, title: await maskForReaders(title), author, status, genres, chapter_count, cover_url, created_at, updated_at })))),
      getGenreCatalog(),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <HomePage stories={stories} catalog={catalog} loadError={loadError} />;
}
