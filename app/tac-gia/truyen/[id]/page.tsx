import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthorStoryChapters, type AuthorChapter } from "@/components/author-chapters";
import { getAuthorContext, isTrustedAuthor, loadAuthorStories } from "@/lib/authors";
import { createServiceClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Quản lý chương", robots: { index: false } };

export default async function AuthorStoryPage({ params }: PageProps<"/tac-gia/truyen/[id]">) {
  const { id } = await params;
  const { user, profile, supabase } = await getAuthorContext();
  if (!user) redirect(`/dang-nhap?next=/tac-gia/truyen/${id}`);
  if (!profile || profile.status !== "approved") redirect("/tac-gia");
  const admin = createServiceClient();
  const [story] = await loadAuthorStories(admin, user.id, id);
  if (!story) notFound();
  const [{ data: chapters }, { data: genres }, trusted] = await Promise.all([
    admin.from("chapters").select("id, chapter_number, title, publish_status, review_note, ads_enabled, updated_at").eq("story_id", id).order("chapter_number"),
    admin.from("genres").select("name").order("name"),
    isTrustedAuthor(supabase),
  ]);
  return <main className="min-h-screen bg-muted/30 px-4 py-8"><div className="mx-auto max-w-5xl">
    <AuthorStoryChapters story={story} chapters={(chapters ?? []) as AuthorChapter[]} catalog={(genres ?? []).map((genre) => genre.name)} trusted={trusted} />
  </div></main>;
}
