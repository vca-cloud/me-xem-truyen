import { AdminGenresPage, type AdminGenreRow } from "@/components/admin-genres-page";
import { createClient } from "@/lib/supabase/server";

export default async function GenresPage() {
  let genres: AdminGenreRow[] = [];
  let loadError: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("genres").select("id, name, slug, story_genres(count)").order("name");
    if (error) loadError = error.message;
    else genres = (data ?? []).map((genre) => ({ id: genre.id, name: genre.name, slug: genre.slug, stories: (genre.story_genres as unknown as { count: number }[])?.[0]?.count ?? 0 }));
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <AdminGenresPage genres={genres} loadError={loadError} />;
}
