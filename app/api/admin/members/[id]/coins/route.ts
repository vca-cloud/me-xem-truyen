import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const errors: Record<string, [string, number]> = {
  insufficient_balance: ["Số dư không đủ để trừ.", 400],
  invalid_amount: ["Số Xu phải khác 0 và không quá 1.000.000.", 400],
  reason_required: ["Vui lòng nhập lý do.", 400],
  user_not_found: ["Không tìm thấy thành viên.", 404],
  "not authorized": ["Chỉ quản trị viên toàn quyền (role admin) được cộng/trừ Xu.", 403],
};

// Manual credit (+) or debit (-) of a member's Xu, recorded in the ledger with the admin and reason.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/members/[id]/coins">) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({})) as { amount?: unknown; reason?: unknown };
  const amount = Number(body.amount);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (!Number.isInteger(amount) || amount === 0) return NextResponse.json({ error: "Số Xu phải là số nguyên khác 0." }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Vui lòng nhập lý do." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_coins", { p_user_id: id, p_amount: amount, p_reason: reason });
  if (error) {
    const [message, status] = errors[error.message] ?? ["Không thể cập nhật Xu.", 500];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ balance: data });
}
