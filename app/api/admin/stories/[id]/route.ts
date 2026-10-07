import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { validTextUrl } from "@/lib/story-data";
import { parseGenreNames, setStoryGenres } from "@/lib/stories";
import { parseLockSettings } from "@/lib/coins";
import { createClient } from "@/lib/supabase/server";

const statuses = ["Đang ra", "Hoàn thành", "Tạm dừng"];

// Updates story details. The slug (URL) never changes, even when the title does, so links and stats stay valid.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/stories/[id]">) {
  try {
    const guard = await guardAdminApi(roleAccess.content);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : undefined);
    const update: Record<string, string | number | boolean | null> = {};

    const title = text("title");
    if (title !== undefined) { if (!title || title.length > 200) return NextResponse.json({ error: "Tên truyện từ 1 đến 200 ký tự." }, { status: 400 }); update.title = title; }
    const author = text("author");
    if (author !== undefined) { if (!author) return NextResponse.json({ error: "Tác giả là bắt buộc." }, { status: 400 }); update.author = author; }
    const description = text("description");
    if (description !== undefined) update.description = description;
    for (const key of ["cover_url", "audio_url"] as const) {
      const value = text(key);
      if (value === undefined) continue;
      if (value && !validTextUrl(value)) return NextResponse.json({ error: "Link ảnh bìa/audio phải bắt đầu bằng http:// hoặc https://." }, { status: 400 });
      update[key] = value || null;
    }
    const status = text("status");
    if (status !== undefined) { if (!statuses.includes(status)) return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 }); update.status = status; }

    if (typeof body.ads_disabled === "boolean") update.ads_disabled = body.ads_disabled;
    if ("lock_from_chapter" in body || "lock_price_coins" in body) {
      const lock = parseLockSettings(body.lock_from_chapter, body.lock_price_coins);
      if (lock.error) return NextResponse.json({ error: lock.error }, { status: 400 });
      Object.assign(update, lock.value);
    }

    const supabase = await createClient();
    const { error } = await supabase.from("stories").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (body.genres !== undefined) await setStoryGenres(supabase, id, parseGenreNames(body.genres));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && !error.message.includes("NEXT_REDIRECT") ? error.message : "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}

// Deletes a story with all its chapters and genre links.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/stories/[id]">) {
  try {
    const guard = await guardAdminApi(roleAccess.destructive);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const supabase = await createClient();
    const { error, count } = await supabase.from("stories").delete({ count: "exact" }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!count) return NextResponse.json({ error: "Không tìm thấy truyện hoặc bạn không có quyền xóa." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}
