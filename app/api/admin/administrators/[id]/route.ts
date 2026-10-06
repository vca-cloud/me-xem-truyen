import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";

// Removes admin access (the member account itself is kept).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/administrators/[id]">) {
  const guard = await guardAdminApi(roleAccess.admins);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const { error } = await guard.supabase.rpc("admin_remove_admin", { p_user_id: id });
  if (error) {
    const message = error.message === "last_admin" ? "Phải luôn còn ít nhất một quản trị viên toàn quyền đang hoạt động." : "Không thể gỡ quyền quản trị.";
    return NextResponse.json({ error: message }, { status: error.message === "last_admin" ? 409 : 500 });
  }
  return NextResponse.json({ ok: true });
}
