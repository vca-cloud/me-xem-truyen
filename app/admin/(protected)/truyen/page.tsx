import { AdminStoriesPage } from "@/components/admin-stories-page";
import { listStories, type StorySummary } from "@/lib/stories";

export default async function StoriesPage() {
  let stories: StorySummary[] = [];
  let loadError: string | null = null;
  try {
    stories = await listStories();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <AdminStoriesPage stories={stories} loadError={loadError} />;
}
