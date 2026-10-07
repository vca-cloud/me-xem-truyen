import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { clearModerationCache } from "@/lib/moderation";
import { parseTerm } from "@/lib/moderation-terms";

export async function POST(request: Request) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const parsed = parseTerm(await request.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { error } = await guard.supabase.from("moderation_terms").insert(parsed.value);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Từ này đã có trong từ điển." : error.message }, { status: 400 });
  clearModerationCache();
  return NextResponse.json({ ok: true }, { status: 201 });
}
