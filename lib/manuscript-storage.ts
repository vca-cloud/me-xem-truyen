import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CHAPTER_CHARS } from "@/lib/author-rules";
import { moderateContent } from "@/lib/moderation";
import { r2Config } from "@/lib/r2";
import { contentLinkFor, publicObjectExists, putPublicObject } from "@/lib/r2-browser";

// Chapters sent from the manuscript uploader (already split in the browser).
export type ManuscriptChapterInput = { number: number; title: string; content: string };
export type ManuscriptChapterResult = { number: number; status: "added" | "skipped" | "error"; message?: string; flagged?: boolean; publish_status?: string };

export const MANUSCRIPT_BATCH_CHAPTERS = 50;
const MAX_BATCH_CHARS = 1_500_000;

export function parseManuscriptBatch(body: unknown): { chapters: ManuscriptChapterInput[]; free: boolean } | { error: string } {
  const value = body as { chapters?: unknown; free?: unknown } | null;
  const raw = Array.isArray(value?.chapters) ? value.chapters : [];
  if (!raw.length || raw.length > MANUSCRIPT_BATCH_CHAPTERS) return { error: `Mỗi lần gửi từ 1 đến ${MANUSCRIPT_BATCH_CHAPTERS} chương.` };
  const chapters = raw.map((item) => {
    const chapter = item as { number?: unknown; title?: unknown; content?: unknown };
    return {
      number: Number(chapter.number),
      title: typeof chapter.title === "string" ? chapter.title.normalize("NFC").trim().slice(0, 200) : "",
      content: typeof chapter.content === "string" ? chapter.content.normalize("NFC").replace(/\r\n?/g, "\n") : "",
    };
  });
  if (chapters.some((chapter) => !Number.isInteger(chapter.number) || chapter.number < 1 || chapter.number > 100_000)) return { error: "Số chương không hợp lệ." };
  if (new Set(chapters.map((chapter) => chapter.number)).size !== chapters.length) return { error: "Có số chương bị trùng." };
  if (chapters.reduce((sum, chapter) => sum + chapter.content.length, 0) > MAX_BATCH_CHARS) return { error: "Gói gửi quá lớn." };
  return { chapters, free: value?.free === true };
}

// Folder of a story on R2 — the existing layout "<Tên truyện>/Chương N.txt". A story that already has
// files keeps its folder (even if the title changed since); otherwise the folder is the story title.
async function storyFolder(db: SupabaseClient, storyId: string, title: string) {
  const base = (r2Config.publicUrl ?? "").replace(/\/$/, "") + "/";
  const { data } = await db.from("chapters").select("text_url").eq("story_id", storyId).limit(50);
  for (const row of data ?? []) {
    const url = (row as { text_url?: string }).text_url;
    if (url?.startsWith(base)) {
      const path = decodeURIComponent(url.slice(base.length)).normalize("NFC");
      const folder = path.slice(0, path.lastIndexOf("/"));
      if (folder && !folder.startsWith("tac-gia/")) return folder;
    }
  }
  // No slashes, control characters or leading dots (a "." / ".." segment would be resolved away in the URL).
  const folder = title.normalize("NFC").replace(/[\/\\\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").trim().slice(0, 150);
  return folder || storyId;
}

// Stores each chapter as "<folder>/Chương N.txt" (never overwriting an existing file or chapter), scans it with the
// moderation dictionary, and inserts the chapter row with the extra columns from `rowFor` (author publishing state).
export async function storeManuscriptChapters(options: {
  db: SupabaseClient;
  storyId: string;
  storyTitle: string;
  chapters: ManuscriptChapterInput[];
  minChars?: number;
  rowFor?: (moderation: Awaited<ReturnType<typeof moderateContent>>) => Record<string, unknown>;
  adminId?: string;
}): Promise<ManuscriptChapterResult[]> {
  const { db, storyId, chapters } = options;
  const folder = await storyFolder(db, storyId, options.storyTitle);
  const { data: existingRows } = await db.from("chapters").select("chapter_number").eq("story_id", storyId).in("chapter_number", chapters.map((chapter) => chapter.number));
  const existing = new Set((existingRows ?? []).map((row) => (row as { chapter_number: number }).chapter_number));
  const results: ManuscriptChapterResult[] = [];

  for (const chapter of chapters) {
    if (existing.has(chapter.number)) { results.push({ number: chapter.number, status: "skipped", message: "Chương đã có trên web." }); continue; }
    const body = chapter.content.trim();
    const textLength = body.slice(body.indexOf("\n") + 1).trim().length;
    if (textLength < (options.minChars ?? 1)) { results.push({ number: chapter.number, status: "error", message: "Nội dung chương quá ngắn." }); continue; }
    if (body.length > MAX_CHAPTER_CHARS) { results.push({ number: chapter.number, status: "error", message: "Nội dung chương quá dài." }); continue; }
    const key = `${folder}/Chương ${chapter.number}.txt`;
    try {
      if (await publicObjectExists(key)) { results.push({ number: chapter.number, status: "skipped", message: "File đã có trên Cloudflare, không ghi đè." }); continue; }
      await putPublicObject(key, new TextEncoder().encode(`${body}\n`), "text/plain; charset=utf-8");
      const title = chapter.title || `Chương ${chapter.number}`;
      const moderation = await moderateContent({ title, text: body, adminId: options.adminId });
      const extra = options.rowFor?.(moderation) ?? {};
      const { error } = await db.from("chapters").insert({ story_id: storyId, chapter_number: chapter.number, title, text_url: contentLinkFor("public", key), ...moderation, ...extra });
      if (error) throw new Error(error.code === "23505" ? "Chương đã có trên web." : error.message);
      results.push({ number: chapter.number, status: "added", flagged: moderation.moderation_status === "pending", publish_status: typeof extra.publish_status === "string" ? extra.publish_status : "published" });
    } catch (error) {
      results.push({ number: chapter.number, status: "error", message: error instanceof Error ? error.message : "Không lưu được chương." });
    }
  }
  // Only published chapters move the story up in "Mới cập nhật" (author chapters waiting for review do not).
  if (results.some((result) => result.status === "added" && result.publish_status === "published")) await db.from("stories").update({ updated_at: new Date().toISOString() }).eq("id", storyId);
  return results;
}
