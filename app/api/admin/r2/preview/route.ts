import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { chapterNumberFromFile, chapterTitleFromText, contentLinkFor, listR2, r2ApiReady, r2Buckets, readR2Head, type R2Source } from "@/lib/r2-browser";

const MAX_FILES = 2000;

// Lists the .txt files of one folder, sorted by chapter number, with titles read from each file's first line.
export async function GET(request: NextRequest) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  if (!r2ApiReady()) return NextResponse.json({ error: "Chưa có khóa API R2." }, { status: 503 });
  const source = request.nextUrl.searchParams.get("source") as R2Source;
  const bucket = r2Buckets()[source];
  const prefix = request.nextUrl.searchParams.get("prefix") ?? "";
  if (!bucket || !prefix.endsWith("/")) return NextResponse.json({ error: "Thư mục không hợp lệ." }, { status: 400 });

  try {
    const { files } = await listR2(bucket, prefix);
    const txt = files.filter((file) => /\.txt$/i.test(file.key)).slice(0, MAX_FILES);
    const skipped: string[] = [];
    const numbered = txt.flatMap((file) => {
      const name = file.key.slice(prefix.length);
      const number = chapterNumberFromFile(name);
      if (number === null || number < 1) { skipped.push(name); return []; }
      return [{ key: file.key, name, number, size: file.size }];
    });
    const seen = new Map<number, string>();
    const duplicates: string[] = [];
    for (const file of numbered) {
      if (seen.has(file.number)) duplicates.push(`${seen.get(file.number)} / ${file.name}`);
      else seen.set(file.number, file.name);
    }
    const unique = numbered.filter((file) => seen.get(file.number) === file.name).sort((a, b) => a.number - b.number);

    // Read headings in small batches to stay polite with the API.
    const chapters: { chapter_number: number; title: string; text_url: string; file: string; size: number }[] = [];
    for (let index = 0; index < unique.length; index += 10) {
      const batch = unique.slice(index, index + 10);
      const heads = await Promise.all(batch.map((file) => readR2Head(bucket, file.key).catch(() => "")));
      batch.forEach((file, i) => chapters.push({ chapter_number: file.number, title: chapterTitleFromText(heads[i], file.number), text_url: contentLinkFor(source, file.key), file: file.name, size: file.size }));
    }
    const folderName = prefix.replace(/\/$/, "").split("/").pop() ?? "";
    return NextResponse.json({ source, prefix, folderName, chapters, skipped, duplicates, truncated: files.length > MAX_FILES });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không đọc được R2." }, { status: 502 });
  }
}
