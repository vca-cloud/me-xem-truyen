import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validTextUrl } from "@/lib/story-data";
import { touchStory } from "@/lib/stories";
import { createClient } from "@/lib/supabase/server";

type ChapterInput = { chapter_number?: unknown; title?: unknown; text_url?: unknown };

// Adds new chapters to an existing story. Existing chapter numbers are rejected, never overwritten.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/stories/[id]/chapters">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({})) as { chapters?: ChapterInput[] };
    const input = Array.isArray(body.chapters) ? body.chapters : [];
    if (!input.length || input.length > 500) return NextResponse.json({ error: "Cần từ 1 đến 500 chương." }, { status: 400 });

    const chapters = input.map((chapter) => ({
      chapter_number: Number(chapter.chapter_number),
      title: typeof chapter.title === "string" ? chapter.title.trim() : "",
      text_url: typeof chapter.text_url === "string" ? chapter.text_url.trim() : "",
    }));
    const invalid = chapters.findIndex((chapter) => !Number.isInteger(chapter.chapter_number) || chapter.chapter_number < 1 || !chapter.title || !validTextUrl(chapter.text_url));
    if (invalid >= 0) return NextResponse.json({ error: `Chương thứ ${invalid + 1}: cần số chương, tên chương và link .txt hợp lệ.` }, { status: 400 });
    if (new Set(chapters.map((chapter) => chapter.chapter_number)).size !== chapters.length) return NextResponse.json({ error: "Có số chương bị trùng trong danh sách." }, { status: 400 });

    const supabase = await createClient();
    const { data: existing } = await supabase.from("chapters").select("chapter_number").eq("story_id", id).in("chapter_number", chapters.map((chapter) => chapter.chapter_number));
    if (existing?.length) return NextResponse.json({ error: `Chương đã tồn tại: ${existing.map((chapter) => chapter.chapter_number).join(", ")}.` }, { status: 409 });
    const { error } = await supabase.from("chapters").insert(chapters.map((chapter) => ({ ...chapter, story_id: id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await touchStory(supabase, id);
    return NextResponse.json({ added: chapters.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}

