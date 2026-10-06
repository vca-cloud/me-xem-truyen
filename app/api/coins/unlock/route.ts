import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Spends the member's Xu to unlock one chapter. Price and balance are decided in the database, never by the client.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { chapter_id?: unknown } | null;
  const chapterId = typeof body?.chapter_id === "string" ? body.chapter_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(chapterId)) return NextResponse.json({ error: "Chương không hợp lệ." }, { status: 400 });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập để mở khóa chương." }, { status: 401 });
    const { data, error } = await supabase.rpc("unlock_chapter", { p_chapter_id: chapterId });
    if (error) return NextResponse.json({ error: "Không thể mở khóa chương, vui lòng thử lại." }, { status: 500 });
    const result = data as { status: string; price?: number; balance?: number };
    if (result.status === "not_found") return NextResponse.json({ error: "Không tìm thấy chương." }, { status: 404 });
    if (result.status === "insufficient") return NextResponse.json({ error: "Số Xu không đủ để mở khóa chương này.", ...result }, { status: 402 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Máy chủ chưa sẵn sàng, vui lòng thử lại." }, { status: 500 });
  }
}
