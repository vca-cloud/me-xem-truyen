import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { clearModerationCache } from "@/lib/moderation";
import { parseTerm } from "@/lib/moderation-terms";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/moderation-terms/[id]">) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const parsed = parseTerm(await request.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { error, count } = await guard.supabase.from("moderation_terms").update({ ...parsed.value, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Từ này đã có trong từ điển." : error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Không tìm thấy từ." }, { status: 404 });
  clearModerationCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/moderation-terms/[id]">) {
  const guard = await guardAdminApi(roleAccess.destructive);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const { error, count } = await guard.supabase.from("moderation_terms").delete({ count: "exact" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Không tìm thấy từ." }, { status: 404 });
  clearModerationCache();
  return NextResponse.json({ ok: true });
}
