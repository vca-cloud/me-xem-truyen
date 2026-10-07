import { NextResponse } from "next/server";
import { DEFAULT_REVENUE_SHARE } from "@/lib/author-rules";
import { parseAuthorStory } from "@/lib/author-stories";
import { guardAuthorApi } from "@/lib/authors";
import { storySlug } from "@/lib/story-data";
import { setStoryGenres } from "@/lib/stories";

// Author creates a story (visible to readers once one chapter is published).
export async function POST(request: Request) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const { data: genreRows } = await guard.admin.from("genres").select("name");
  const parsed = await parseAuthorStory(await request.json().catch(() => ({})), (genreRows ?? []).map((row) => row.name));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // Unique slug: add a short suffix when the title is already taken.
  let slug = storySlug(parsed.value.title) || "truyen";
  const { data: taken } = await guard.admin.from("stories").select("slug").like("slug", `${slug}%`);
  if (taken?.some((row) => row.slug === slug)) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: story, error } = await guard.admin.from("stories").insert({ ...parsed.value, slug, author: guard.profile.pen_name, owner_id: guard.user.id }).select("id, slug").single();
  if (error || !story) return NextResponse.json({ error: error?.message ?? "Không thể tạo truyện." }, { status: 400 });
  await setStoryGenres(guard.admin, story.id, parsed.genres);
  return NextResponse.json({ story, revenue_share: guard.profile.revenue_share ?? DEFAULT_REVENUE_SHARE }, { status: 201 });
}
