import { HomePage, type HomeStory } from "@/components/home-page";
import { maskForReaders } from "@/lib/moderation";
import { listStories } from "@/lib/stories";

export default async function Home() {
  let stories: HomeStory[] = [];
  let loadError: string | null = null;
  try {
    stories = await Promise.all((await listStories()).map(async ({ slug, title, author, status, genres, chapter_count, cover_url, created_at, updated_at }) => ({ slug, title: await maskForReaders(title), author, status, genres, chapter_count, cover_url, created_at, updated_at })));
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <HomePage stories={stories} loadError={loadError} />;
}
