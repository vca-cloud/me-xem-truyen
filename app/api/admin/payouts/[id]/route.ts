import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";

// Mark a withdrawal request as paid (after the bank transfer on the 20th) or rejected (Xu go back to the author).
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/payouts/[id]">) {
  const guard = await guardAdminApi(roleAccess.money);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({})) as { status?: unknown; note?: unknown };
  if (body.status !== "paid" && body.status !== "rejected") return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  if (body.status === "rejected" && !note) return NextResponse.json({ error: "Vui lòng nhập lý do." }, { status: 400 });
  const { error, count } = await guard.supabase.from("author_payouts").update({ status: body.status, note: note || null, processed_at: new Date().toISOString(), processed_by: guard.profile.id }, { count: "exact" }).eq("id", id).eq("status", "requested");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Yêu cầu không còn ở trạng thái chờ chi." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
