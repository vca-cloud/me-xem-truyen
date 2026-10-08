import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { parseManuscriptBatch, storeManuscriptChapters } from "@/lib/manuscript-storage";
import { createClient } from "@/lib/supabase/server";

// Adds one batch of chapters split from an uploaded manuscript: each becomes "<Tên truyện>/Chương N.txt" on R2.
// `free: true` makes the whole story free (clears the chapter lock).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/stories/[id]/manuscript">) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const parsed = parseManuscriptBatch(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const supabase = await createClient();
  const { data: story } = await supabase.from("stories").select("id, title").eq("id", id).maybeSingle();
  if (!story) return NextResponse.json({ error: "Không tìm thấy truyện." }, { status: 404 });
  if (parsed.free) await supabase.from("stories").update({ lock_from_chapter: null }).eq("id", id);
  const results = await storeManuscriptChapters({ db: supabase, storyId: id, storyTitle: story.title, chapters: parsed.chapters, adminId: guard.profile.id });
  return NextResponse.json({ results });
}
