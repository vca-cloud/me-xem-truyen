import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { moderateChapters } from "@/lib/moderation";

// Re-scans every chapter of a story with the current dictionary. Chapters an admin already reviewed keep their
// ads/18+ decision; only the stored hits and score are refreshed for them.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/admin/stories/[id]/moderation">) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const { data: chapters, error } = await guard.supabase.rpc("admin_list_chapters", { p_story_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const list = (chapters ?? []) as { id: string; title: string; text_url: string; moderation_status: string }[];
  const results = await moderateChapters(list.map((chapter) => ({ title: chapter.title, text_url: chapter.text_url })));
  let pending = 0;
  for (let index = 0; index < list.length; index += 1) {
    const result = results[index];
    const reviewed = list[index].moderation_status === "approved";
    const update = reviewed
      ? { moderation_score: result.moderation_score, moderation_hits: result.moderation_hits, moderated_at: result.moderated_at }
      : { ...result, moderated_by: null };
    if (!reviewed && result.moderation_status === "pending") pending += 1;
    const { error: updateError } = await guard.supabase.from("chapters").update(update).eq("id", list[index].id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  }
  return NextResponse.json({ scanned: list.length, pending });
}
