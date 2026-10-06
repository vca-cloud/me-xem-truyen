import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";

const roles = ["admin", "editor", "moderator"];
const statuses = ["active", "suspended"];
const errors: Record<string, [string, number]> = {
  user_not_found: ["Không có tài khoản nào với email này. Người đó cần đăng ký tài khoản trước.", 404],
  last_admin: ["Phải luôn còn ít nhất một quản trị viên toàn quyền đang hoạt động.", 409],
  "not authorized": ["Chỉ quản trị viên toàn quyền được quản lý quản trị viên.", 403],
};

// Grants or updates admin access for an existing account (by email).
export async function POST(request: Request) {
  const guard = await guardAdminApi(roleAccess.admins);
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => ({})) as { email?: unknown; role?: unknown; status?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  if (!roles.includes(String(body.role)) || !statuses.includes(String(body.status))) return NextResponse.json({ error: "Vai trò hoặc trạng thái không hợp lệ." }, { status: 400 });
  const { error } = await guard.supabase.rpc("admin_set_admin", { p_email: email, p_role: body.role, p_status: body.status });
  if (error) {
    const [message, status] = errors[error.message] ?? ["Không thể lưu quản trị viên.", 500];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true });
}
