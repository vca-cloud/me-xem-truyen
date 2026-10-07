import { NextResponse, type NextRequest } from "next/server";
import { MAX_CHAPTER_CHARS } from "@/lib/author-rules";
import { guardAuthorApi, isTrustedAuthor, ownedStory } from "@/lib/authors";
import { moderateContent } from "@/lib/moderation";
import { uploadChapterText } from "@/lib/r2-browser";

// Author writes a new chapter: the text is stored on R2, scanned, then saved as a draft or submitted.
// Trusted authors' clean chapters are published at once; everything else waits in the admin review queue.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/author/stories/[id]/chapters">) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const story = await ownedStory(guard.admin, id, guard.user.id);
  if (!story) return NextResponse.json({ error: "Không tìm thấy truyện của bạn." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { chapter_number?: unknown; title?: unknown; content?: unknown; submit?: unknown };
  const number = Number(body.chapter_number);
  const title = typeof body.title === "string" ? body.title.normalize("NFC").trim().slice(0, 300) : "";
  const content = typeof body.content === "string" ? body.content.normalize("NFC").replace(/\r\n/g, "\n").trim() : "";
  if (!Number.isInteger(number) || number < 1) return NextResponse.json({ error: "Số chương không hợp lệ." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Vui lòng nhập tên chương." }, { status: 400 });
  if (content.length < 200) return NextResponse.json({ error: "Nội dung chương quá ngắn (tối thiểu 200 ký tự)." }, { status: 400 });
  if (content.length > MAX_CHAPTER_CHARS) return NextResponse.json({ error: "Nội dung chương quá dài." }, { status: 400 });
  const { data: exists } = await guard.admin.from("chapters").select("id").eq("story_id", id).eq("chapter_number", number).maybeSingle();
  if (exists) return NextResponse.json({ error: `Chương ${number} đã có.` }, { status: 409 });

  let textUrl: string;
  try {
    textUrl = await uploadChapterText(guard.user.id, id, number, content);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không lưu được nội dung." }, { status: 502 });
  }
  const moderation = await moderateContent({ title, text: content });
  const submit = body.submit === true;
  const autoPublish = submit && moderation.moderation_status === "clean" && await isTrustedAuthor(guard.supabase);
  const publishStatus = !submit ? "draft" : autoPublish ? "published" : "submitted";
  const { data, error } = await guard.admin.from("chapters").insert({
    story_id: id, chapter_number: number, title, text_url: textUrl, ...moderation,
    publish_status: publishStatus, submitted_at: submit ? new Date().toISOString() : null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (publishStatus === "published") await guard.admin.from("stories").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ id: data.id, publish_status: publishStatus, flagged: moderation.moderation_status === "pending" }, { status: 201 });
}
