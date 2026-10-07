import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validTextUrl } from "@/lib/story-data";
import { contentUrlError } from "@/lib/chapter-content";
import { parseGenreNames, setStoryGenres } from "@/lib/stories";
import { parseLockSettings } from "@/lib/coins";
import { moderateChapters } from "@/lib/moderation";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  try {
    const guard = await guardAdminApi(roleAccess.content);
    if (guard.error) return guard.error;
    const body = await request.json() as { title?: string; author?: string; description?: string; cover_url?: string; audio_url?: string; status?: string; genres?: string[] | string; lock_from_chapter?: unknown; lock_price_coins?: unknown; ads_disabled?: unknown; chapters?: { chapter_number: number; title: string; text_url: string; ads_enabled?: boolean }[] };
    const title = body.title?.trim() ?? "";
    const author = body.author?.trim() ?? "";
    if (!title || !author) return NextResponse.json({ error: "Tên truyện và tác giả là bắt buộc." }, { status: 400 });
    if (body.cover_url?.trim() && !validTextUrl(body.cover_url.trim())) return NextResponse.json({ error: "Link ảnh bìa không hợp lệ." }, { status: 400 });
    if (body.audio_url && !validTextUrl(body.audio_url)) return NextResponse.json({ error: "Link Mê Nghe Truyện không hợp lệ." }, { status: 400 });
    const lock = parseLockSettings(body.lock_from_chapter, body.lock_price_coins);
    if (lock.error) return NextResponse.json({ error: lock.error }, { status: 400 });
    const chapters = body.chapters ?? [];
    const contentError = chapters.map((chapter) => contentUrlError(String(chapter.text_url ?? ""))).find(Boolean);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
    if (chapters.some((chapter) => !Number.isInteger(chapter.chapter_number) || chapter.chapter_number < 1)) return NextResponse.json({ error: "Mỗi chương phải có số hợp lệ và link Text URL hợp lệ." }, { status: 400 });
    const supabase = await createClient();
    const { data: story, error } = await supabase.from("stories").insert({ slug: slugify(title), title, author, description: body.description?.trim() ?? "", cover_url: body.cover_url?.trim() || null, audio_url: body.audio_url?.trim() || null, status: body.status ?? "Đang ra", ads_disabled: body.ads_disabled === true, ...lock.value }).select("id, slug, title, author, description, cover_url, audio_url, status").single();
    if (error || !story) return NextResponse.json({ error: error?.code === "23505" ? "Đã có truyện trùng tên (trùng slug)." : error?.message ?? "Không thể tạo truyện." }, { status: 400 });
    let pending = 0;
    try {
      if (chapters.length) {
        const moderation = await moderateChapters(chapters.map((chapter) => ({ title: chapter.title.trim(), text_url: chapter.text_url.trim(), adsOverride: typeof chapter.ads_enabled === "boolean" ? chapter.ads_enabled : undefined })), guard.profile.id);
        const { error: chapterError } = await supabase.from("chapters").insert(chapters.map((chapter, index) => ({ chapter_number: chapter.chapter_number, title: chapter.title.trim(), text_url: chapter.text_url.trim(), story_id: story.id, ...moderation[index] })));
        if (chapterError) throw new Error(chapterError.code === "23505" ? "Có số chương bị trùng." : chapterError.message);
        pending = moderation.filter((item) => item.moderation_status === "pending").length;
      }
      await setStoryGenres(supabase, story.id, parseGenreNames(body.genres));
    } catch (error) {
      await supabase.from("stories").delete().eq("id", story.id);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu chương." }, { status: 400 });
    }
    return NextResponse.json({ story, pending }, { status: 201 });
  } catch { return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 }); }
}

export async function GET() {
  try { const guard = await guardAdminApi(roleAccess.view);
    if (guard.error) return guard.error; const supabase = await createClient(); const { data, error } = await supabase.from("stories").select("id, slug, title, author, description, cover_url, audio_url, status, chapters(id, chapter_number, title, text_url)").order("updated_at", { ascending: false }); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ stories: data ?? [] }); } catch { return NextResponse.json({ error: "Không thể tải danh sách truyện." }, { status: 500 }); }
}
