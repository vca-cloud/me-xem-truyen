import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { storySlug } from "@/lib/story-data";

export async function POST(request: Request) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => ({})) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Tên thể loại từ 1 đến 60 ký tự." }, { status: 400 });
  const { error } = await guard.supabase.from("genres").insert({ name, slug: storySlug(name) });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Thể loại này đã tồn tại." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
