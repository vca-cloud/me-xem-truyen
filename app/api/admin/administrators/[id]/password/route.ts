import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { guardAdminApi, roleAccess } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardAdminApi(roleAccess.admins);
    if (guard.error) return guard.error;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !url) {
      return NextResponse.json({ error: "Chưa cấu hình Supabase Admin API trên server." }, { status: 503 });
    }

    const body = await request.json() as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự." }, { status: 400 });
    }

    const { id } = await context.params;
    const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await adminClient.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: "Không thể cập nhật mật khẩu." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không thể xử lý yêu cầu đổi mật khẩu." }, { status: 500 });
  }
}
