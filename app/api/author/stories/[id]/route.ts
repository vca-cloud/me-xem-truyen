import { NextResponse, type NextRequest } from "next/server";
import { parseAuthorStory } from "@/lib/author-stories";
import { guardAuthorApi, ownedStory } from "@/lib/authors";
import { setStoryGenres } from "@/lib/stories";

// Author edits own story details. The slug (URL) never changes.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/author/stories/[id]">) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  if (!await ownedStory(guard.admin, id, guard.user.id)) return NextResponse.json({ error: "Không tìm thấy truyện của bạn." }, { status: 404 });
  const { data: genreRows } = await guard.admin.from("genres").select("name");
  const parsed = await parseAuthorStory(await request.json().catch(() => ({})), (genreRows ?? []).map((row) => row.name));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { error } = await guard.admin.from("stories").update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await setStoryGenres(guard.admin, id, parsed.genres);
  return NextResponse.json({ ok: true });
}
