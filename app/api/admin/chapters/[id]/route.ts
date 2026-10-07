import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { contentUrlError } from "@/lib/chapter-content";

// Edits a chapter's title and/or content link. The chapter number is fixed (it is part of the reader URL).
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/chapters/[id]">) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({})) as { title?: unknown; text_url?: unknown; ads_enabled?: unknown; is_mature?: unknown; approve?: unknown; publish?: unknown; reject?: unknown };
  const update: Record<string, string | boolean | null> = {};
  // Author chapters: publish (readers can see it) or reject with a reason shown to the author.
  if (body.publish === true) { update.publish_status = "published"; update.review_note = null; }
  if (typeof body.reject === "string") {
    if (!body.reject.trim()) return NextResponse.json({ error: "Vui lòng nhập lý do từ chối." }, { status: 400 });
    update.publish_status = "rejected";
    update.review_note = body.reject.trim().slice(0, 500);
  }
  // Any manual ads/18+/approve decision counts as a review by this admin.
  if (typeof body.ads_enabled === "boolean") update.ads_enabled = body.ads_enabled;
  if (typeof body.is_mature === "boolean") update.is_mature = body.is_mature;
  if (typeof body.ads_enabled === "boolean" || body.approve === true || typeof body.is_mature === "boolean" || body.publish === true) {
    update.moderation_status = "approved";
    update.moderated_by = guard.profile.id;
    update.moderated_at = new Date().toISOString();
  }
  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "Tên chương không được để trống." }, { status: 400 });
    update.title = body.title.trim().slice(0, 300);
  }
  if (typeof body.text_url === "string") {
    const error = contentUrlError(body.text_url);
    if (error) return NextResponse.json({ error }, { status: 400 });
    update.text_url = body.text_url.trim();
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
  const { data, error } = await guard.supabase.from("chapters").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id).select("story_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: "Không tìm thấy chương." }, { status: 404 });
  await guard.supabase.from("stories").update({ updated_at: new Date().toISOString() }).eq("id", data[0].story_id);
  // Publishing makes the chapter (and an author's story) visible, so it also bumps the story to "recently updated".
  return NextResponse.json({ ok: true });
}

// Deletes a chapter. Chapters that members already paid for cannot be deleted — edit them instead.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/chapters/[id]">) {
  const guard = await guardAdminApi(roleAccess.destructive);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const { count: purchases } = await guard.supabase.from("chapter_unlocks").select("chapter_id", { count: "exact", head: true }).eq("chapter_id", id);
  if (purchases) return NextResponse.json({ error: `Chương đã có ${purchases} lượt mua bằng Xu, không thể xóa. Hãy sửa nội dung thay vì xóa.` }, { status: 409 });
  const { error, count } = await guard.supabase.from("chapters").delete({ count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Không tìm thấy chương." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
