import { NextResponse, type NextRequest } from "next/server";
import { guardAuthorApi, isTrustedAuthor, ownedStory } from "@/lib/authors";
import { parseManuscriptBatch, storeManuscriptChapters } from "@/lib/manuscript-storage";

// Author uploads a batch of chapters split from a manuscript. Same rules as writing a chapter by hand:
// trusted authors' clean chapters are published at once, the rest wait for admin review.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/author/stories/[id]/manuscript">) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const story = await ownedStory(guard.admin, id, guard.user.id);
  if (!story) return NextResponse.json({ error: "Không tìm thấy truyện của bạn." }, { status: 404 });
  const parsed = parseManuscriptBatch(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.free) await guard.admin.from("stories").update({ lock_from_chapter: null }).eq("id", id);
  const trusted = await isTrustedAuthor(guard.supabase);
  const now = new Date().toISOString();
  const results = await storeManuscriptChapters({
    db: guard.admin, storyId: id, storyTitle: story.title, chapters: parsed.chapters, minChars: 200,
    rowFor: (moderation) => ({ publish_status: trusted && moderation.moderation_status === "clean" ? "published" : "submitted", submitted_at: now }),
  });
  return NextResponse.json({ results });
}
