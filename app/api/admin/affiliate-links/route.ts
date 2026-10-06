import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { parseAffiliateLink } from "@/lib/affiliate-links";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const guard = await guardAdminApi(roleAccess.money);
    if (guard.error) return guard.error;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const parsed = parseAffiliateLink(body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase.from("affiliate_links").insert(parsed.value).select("id").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Sub ID đã được dùng cho link khác." : error.message }, { status: 400 });
    return NextResponse.json({ link: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}
