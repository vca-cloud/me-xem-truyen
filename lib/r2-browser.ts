import "server-only";

import { AwsClient } from "aws4fetch";
import { r2Config } from "@/lib/r2";

// Browses R2 buckets through the S3 API (ListObjectsV2). The public r2.dev URL can read single files but cannot list
// folders, so this needs R2_ACCOUNT_ID + an API token with Object Read (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).

export type R2Source = "public" | "private";

export function r2Buckets(): Record<R2Source, string | null> {
  return { public: process.env.R2_PUBLIC_BUCKET || null, private: r2Config.bucket || null };
}

export function r2ApiReady() {
  return !!(r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey);
}

function client() {
  return new AwsClient({ accessKeyId: r2Config.accessKeyId!, secretAccessKey: r2Config.secretAccessKey!, service: "s3", region: "auto" });
}

const endpoint = (bucket: string) => `https://${r2Config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}`;
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const xmlDecode = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tags = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => xmlDecode(match[1]));

// Parses one ListObjectsV2 response page.
export function parseListObjects(xml: string) {
  const folders = [...xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)].flatMap((match) => tags(match[1], "Prefix"));
  const files = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((match) => ({ key: tags(match[1], "Key")[0] ?? "", size: Number(tags(match[1], "Size")[0] ?? 0) }));
  return { folders, files, truncated: tags(xml, "IsTruncated")[0] === "true", next: tags(xml, "NextContinuationToken")[0] ?? null };
}

// Lists sub-folders and files directly under `prefix` (one level, "/" delimited), following pagination.
export async function listR2(bucket: string, prefix: string) {
  const folders: string[] = [];
  const files: { key: string; size: number }[] = [];
  let token: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const url = new URL(endpoint(bucket));
    url.searchParams.set("list-type", "2");
    url.searchParams.set("delimiter", "/");
    url.searchParams.set("max-keys", "1000");
    if (prefix) url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const response = await client().fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 403 ? "Khóa API R2 không có quyền đọc bucket này." : `R2 trả lỗi HTTP ${response.status}.`);
    const result = parseListObjects(await response.text());
    folders.push(...result.folders);
    files.push(...result.files.filter((file) => file.key !== prefix));
    if (!result.truncated || !result.next) break;
    token = result.next;
  }
  return { folders, files };
}

// The link stored in chapters.text_url for an object: public URL for the public bucket, r2:// for the private one.
export function contentLinkFor(source: R2Source, key: string) {
  if (source === "private") return `r2://${key}`;
  return `${(r2Config.publicUrl ?? "").replace(/\/$/, "")}/${encodeKey(key)}`;
}

// "Chương 12.txt", "chuong-012.txt", "12 - Tên.txt" → 12. Returns null when the file name has no number.
export function chapterNumberFromFile(fileName: string) {
  const base = fileName.normalize("NFC").replace(/\.txt$/i, "");
  const labelled = base.match(/(?:chương|chuong|tập|tap|chapter|ch)[\s._-]*0*(\d+)/iu);
  const any = labelled ?? base.match(/(\d+)/);
  return any ? Number(any[1]) : null;
}

// Sentence case: only the first letter is upper-case ("BÁN VÀO ĐÔNG CUNG" → "Bán vào đông cung").
const sentenceCase = (value: string) => {
  const lower = value.toLocaleLowerCase("vi");
  return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("vi"));
};

// macOS uploads keep file names decomposed (NFD: "a" + combining mark). Object keys must stay as stored,
// but anything shown or saved as text (story title, chapter title, file name) is normalized to NFC.
// Chapter title from the file's first line, in sentence case ("CHƯƠNG 1: BÁN VÀO ĐÔNG CUNG" → "Bán vào đông cung").
export function chapterTitleFromText(text: string, chapterNumber: number) {
  const first = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  const match = first.match(/^(?:chương|chuong|tập|tap|chapter)\s*0*\d+\s*[:.\-–]\s*(.+)$/iu);
  const raw = (match ? match[1] : "").trim().slice(0, 200);
  if (!raw) return `Chương ${chapterNumber}`;
  return sentenceCase(raw.normalize("NFC"));
}

// Uploads chapter text written in the author editor to the public bucket under an unguessable key
// (random suffix), so the file cannot be found by guessing even though the bucket is public.
// Needs an R2 token with Object Read & Write on that bucket.
export async function uploadChapterText(authorId: string, storyId: string, chapterNumber: number, text: string) {
  const bucket = r2Buckets().public;
  if (!bucket || !r2ApiReady()) throw new Error("Chưa cấu hình R2 để lưu chương.");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const key = `tac-gia/${authorId}/${storyId}/chuong-${chapterNumber}-${random}.txt`;
  // Sign first, then send the bytes ourselves: re-sending the signed Request streams the body without a
  // Content-Length, which R2 rejects with HTTP 411.
  const body = new TextEncoder().encode(text);
  const signed = await client().sign(`${endpoint(bucket)}/${encodeKey(key)}`, { method: "PUT", body, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const response = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
  if (!response.ok) throw new Error(response.status === 403 ? "Khóa R2 chưa có quyền ghi (cần Object Read & Write)." : `R2 trả lỗi HTTP ${response.status} khi lưu chương.`);
  return contentLinkFor("public", key);
}

// Writes one object to the public bucket (cover images). Returns its public URL.
export async function putPublicObject(key: string, body: Uint8Array<ArrayBuffer>, contentType: string, cacheControl?: string) {
  const bucket = r2Buckets().public;
  if (!bucket || !r2ApiReady()) throw new Error("Chưa cấu hình R2 để lưu ảnh.");
  const headers: Record<string, string> = { "Content-Type": contentType, ...(cacheControl ? { "Cache-Control": cacheControl } : {}) };
  const signed = await client().sign(`${endpoint(bucket)}/${encodeKey(key)}`, { method: "PUT", body, headers });
  const response = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
  if (!response.ok) throw new Error(response.status === 403 ? "Khóa R2 chưa có quyền ghi (cần Object Read & Write)." : `R2 trả lỗi HTTP ${response.status} khi lưu ảnh.`);
  return contentLinkFor("public", key);
}

// Removes one object from the public bucket; a missing object is not an error.
export async function deletePublicObject(key: string) {
  const bucket = r2Buckets().public;
  if (!bucket || !r2ApiReady()) return;
  const signed = await client().sign(`${endpoint(bucket)}/${encodeKey(key)}`, { method: "DELETE" });
  const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
  if (!response.ok && response.status !== 404) throw new Error(`R2 trả lỗi HTTP ${response.status} khi xóa ảnh.`);
}
