import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";

const statuses = ["approved", "rejected", "suspended", "pending"];

// Approve/reject/suspend an author, set their revenue share (%) and force the trusted level on or off.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/authors/[id]">) {
  const guard = await guardAdminApi(roleAccess.money);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; review_note?: unknown; revenue_share?: unknown; trusted_override?: unknown };
  const update: Record<string, string | number | boolean | null> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!statuses.includes(String(body.status))) return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
    if (body.status === "rejected" && !(typeof body.review_note === "string" && body.review_note.trim())) return NextResponse.json({ error: "Vui lòng nhập lý do từ chối." }, { status: 400 });
    update.status = String(body.status);
    update.reviewed_by = guard.profile.id;
    update.reviewed_at = new Date().toISOString();
    update.review_note = typeof body.review_note === "string" ? body.review_note.trim().slice(0, 500) || null : null;
  }
  if (body.revenue_share !== undefined) {
    const share = Number(body.revenue_share);
    if (!Number.isInteger(share) || share < 0 || share > 100) return NextResponse.json({ error: "Tỷ lệ chia từ 0 đến 100%." }, { status: 400 });
    update.revenue_share = share;
  }
  if (body.trusted_override !== undefined) {
    if (body.trusted_override !== null && typeof body.trusted_override !== "boolean") return NextResponse.json({ error: "Giá trị tin cậy không hợp lệ." }, { status: 400 });
    update.trusted_override = body.trusted_override;
  }
  const { error, count } = await guard.supabase.from("author_profiles").update(update, { count: "exact" }).eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Không tìm thấy tác giả hoặc bạn không có quyền." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
