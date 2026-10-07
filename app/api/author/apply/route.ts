import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/authors";
import { createServiceClient, serviceRoleReady } from "@/lib/supabase/admin";

// Member applies to become an author (or re-applies after a rejection). An admin approves it in /admin/tac-gia.
export async function POST(request: Request) {
  if (!serviceRoleReady()) return NextResponse.json({ error: "Máy chủ chưa cấu hình khóa service role." }, { status: 503 });
  const { user, profile } = await getAuthorContext();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  if (profile && profile.status !== "rejected") return NextResponse.json({ error: "Bạn đã gửi đơn đăng ký." }, { status: 409 });
  const body = await request.json().catch(() => ({})) as { pen_name?: unknown; bio?: unknown; contact?: unknown; agree?: unknown };
  const penName = typeof body.pen_name === "string" ? body.pen_name.normalize("NFC").trim() : "";
  if (penName.length < 2 || penName.length > 60) return NextResponse.json({ error: "Bút danh từ 2 đến 60 ký tự." }, { status: 400 });
  if (body.agree !== true) return NextResponse.json({ error: "Bạn cần đồng ý Điều khoản tác giả." }, { status: 400 });
  const row = {
    user_id: user.id, pen_name: penName,
    bio: typeof body.bio === "string" ? body.bio.trim().slice(0, 1000) : "",
    contact: typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "",
    status: "pending", agreed_terms_at: new Date().toISOString(), review_note: null, updated_at: new Date().toISOString(),
  };
  const { error } = await createServiceClient().from("author_profiles").upsert(row, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Bút danh đã có người dùng." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
