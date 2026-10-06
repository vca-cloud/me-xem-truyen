import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { parseAffiliateLink } from "@/lib/affiliate-links";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/affiliate-links/[id]">) {
  try {
    const guard = await guardAdminApi(roleAccess.money);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const parsed = parseAffiliateLink(body, true);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const supabase = await createClient();
    const { error } = await supabase.from("affiliate_links").update({ ...parsed.value, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Sub ID đã được dùng cho link khác." : error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/affiliate-links/[id]">) {
  try {
    const guard = await guardAdminApi(roleAccess.money);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const supabase = await createClient();
    const { error } = await supabase.from("affiliate_links").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}
