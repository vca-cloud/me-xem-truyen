import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";

// Renames a genre (the slug stays the same so existing links keep working).
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/genres/[id]">) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({})) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Tên thể loại từ 1 đến 60 ký tự." }, { status: 400 });
  const { error, count } = await guard.supabase.from("genres").update({ name }, { count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Đã có thể loại trùng tên." : error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Không tìm thấy thể loại." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Deletes a genre and removes it from every story (stories themselves are kept).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/genres/[id]">) {
  const guard = await guardAdminApi(roleAccess.destructive);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const { error, count } = await guard.supabase.from("genres").delete({ count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Không tìm thấy thể loại." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
