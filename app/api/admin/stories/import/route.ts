import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseStoryImportCsv, type ImportRow } from "@/lib/story-import";
import { storySlug } from "@/lib/story-data";
import { setStoryGenres } from "@/lib/stories";
import { parseLockSettings } from "@/lib/coins";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn file CSV." }, { status: 400 });
    if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: "File import không được vượt quá 5 MB." }, { status: 413 });
    const parsed = parseStoryImportCsv(await file.text());
    if (parsed.errors.length) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    if (!parsed.rows.length) return NextResponse.json({ error: "File không có dòng dữ liệu hợp lệ." }, { status: 400 });

    const grouped = new Map<string, ImportRow[]>();
    for (const row of parsed.rows) {
      const key = row.title.toLocaleLowerCase();
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    const stories = [...grouped.values()].map((rows) => rows[0]);
    const slugs = stories.map((row) => storySlug(row.title));
    if (slugs.some((slug) => !slug) || new Set(slugs).size !== slugs.length) return NextResponse.json({ error: "Tên truyện tạo ra slug trùng hoặc không hợp lệ." }, { status: 400 });

    const locks = stories.map((row) => parseLockSettings(row.lock_from_chapter, row.lock_price_coins));
    const lockError = locks.findIndex((lock) => lock.error);
    if (lockError >= 0) return NextResponse.json({ error: `Dòng ${stories[lockError].line}: ${locks[lockError].error}` }, { status: 400 });

    const supabase = await createClient();
    const { data: existing } = await supabase.from("stories").select("slug").in("slug", slugs);
    if (existing?.length) return NextResponse.json({ error: `Truyện đã tồn tại: ${existing.map((item) => item.slug).join(", ")}.` }, { status: 409 });

    const insertedStoryIds: string[] = [];
    try {
      for (let index = 0; index < stories.length; index += 1) {
        const row = stories[index];
        const { data: story, error } = await supabase.from("stories").insert({ slug: slugs[index], title: row.title, author: row.author, description: row.description, cover_url: row.cover_url || null, audio_url: row.audio_url || null, status: row.status, ...locks[index].value }).select("id").single();
        if (error || !story) throw new Error(`Dòng ${row.line}: ${error?.message ?? "Không thể tạo truyện."}`);
        insertedStoryIds.push(story.id);
        const chapterRows = (grouped.get(row.title.toLocaleLowerCase()) ?? []).map((chapter) => ({ story_id: story.id, chapter_number: chapter.chapter_number, title: chapter.chapter_title, text_url: chapter.text_url }));
        const { error: chapterError } = await supabase.from("chapters").insert(chapterRows);
        if (chapterError) throw new Error(`Truyện "${row.title}": ${chapterError.message}`);
        await setStoryGenres(supabase, story.id, row.genres);
      }
    } catch (error) {
      if (insertedStoryIds.length) await supabase.from("stories").delete().in("id", insertedStoryIds);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể import dữ liệu." }, { status: 400 });
    }
    return NextResponse.json({ stories: stories.length, chapters: parsed.rows.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}
