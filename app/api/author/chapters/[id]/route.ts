import { NextResponse, type NextRequest } from "next/server";
import { MAX_CHAPTER_CHARS } from "@/lib/author-rules";
import { guardAuthorApi, isTrustedAuthor, ownedStory } from "@/lib/authors";
import { fetchChapterText } from "@/lib/chapter-content";
import { moderateContent } from "@/lib/moderation";
import { uploadChapterText } from "@/lib/r2-browser";

async function ownedChapter(guard: Exclude<Awaited<ReturnType<typeof guardAuthorApi>>, { error: unknown }>, id: string) {
  const { data: chapter } = await guard.admin.from("chapters").select("id, story_id, chapter_number, title, text_url, publish_status").eq("id", id).maybeSingle();
  if (!chapter || !await ownedStory(guard.admin, chapter.story_id, guard.user.id)) return null;
  return chapter;
}

// Author's own chapter text, for the editor.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/author/chapters/[id]">) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const chapter = await ownedChapter(guard, (await ctx.params).id);
  if (!chapter) return NextResponse.json({ error: "Không tìm thấy chương." }, { status: 404 });
  const content = await fetchChapterText(chapter.text_url).catch(() => "");
  return NextResponse.json({ ...chapter, content });
}

// Edit title/content and/or submit. Any change to a published chapter sends it back to review
// (unless the author is trusted and the new text is clean), so clean text cannot be swapped for bad text.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/author/chapters/[id]">) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const chapter = await ownedChapter(guard, (await ctx.params).id);
  if (!chapter) return NextResponse.json({ error: "Không tìm thấy chương." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { title?: unknown; content?: unknown; submit?: unknown };
  const title = typeof body.title === "string" ? body.title.normalize("NFC").trim().slice(0, 300) : chapter.title;
  if (!title) return NextResponse.json({ error: "Vui lòng nhập tên chương." }, { status: 400 });
  let content: string | null = null;
  let textUrl = chapter.text_url;
  if (typeof body.content === "string") {
    content = body.content.normalize("NFC").replace(/\r\n/g, "\n").trim();
    if (content.length < 200 || content.length > MAX_CHAPTER_CHARS) return NextResponse.json({ error: "Nội dung chương phải từ 200 ký tự." }, { status: 400 });
    try {
      textUrl = await uploadChapterText(guard.user.id, chapter.story_id, chapter.chapter_number, content);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Không lưu được nội dung." }, { status: 502 });
    }
  } else {
    content = await fetchChapterText(chapter.text_url).catch(() => null);
  }
  const moderation = await moderateContent({ title, text: content });
  const submit = body.submit === true || chapter.publish_status === "published" || chapter.publish_status === "submitted";
  const autoPublish = submit && moderation.moderation_status === "clean" && await isTrustedAuthor(guard.supabase);
  const publishStatus = !submit ? "draft" : autoPublish ? "published" : "submitted";
  const { error } = await guard.admin.from("chapters").update({
    title, text_url: textUrl, ...moderation, publish_status: publishStatus, review_note: null,
    submitted_at: submit ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }).eq("id", chapter.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ publish_status: publishStatus, flagged: moderation.moderation_status === "pending" });
}

// Only chapters that were never published can be deleted by the author.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/author/chapters/[id]">) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const chapter = await ownedChapter(guard, (await ctx.params).id);
  if (!chapter) return NextResponse.json({ error: "Không tìm thấy chương." }, { status: 404 });
  if (chapter.publish_status === "published") return NextResponse.json({ error: "Chương đã đăng không xóa được. Liên hệ admin nếu cần gỡ." }, { status: 409 });
  const { error } = await guard.admin.from("chapters").delete().eq("id", chapter.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
