import "server-only";

import { COVER_SIZES, isManagedCover } from "@/lib/cover";
import { deletePublicObject, listR2, putPublicObject, r2ApiReady, r2Buckets } from "@/lib/r2-browser";
import { r2Config } from "@/lib/r2";
import type { createServiceClient } from "@/lib/supabase/admin";

type ImageInfo = { type: "webp" | "jpg"; width: number; height: number };

// Reads format and pixel size from the file header (JPEG SOF marker or WebP VP8/VP8L/VP8X chunk).
// Anything else (SVG, PNG, HTML…) returns null, so only real JPEG/WebP bytes are stored.
export function imageInfo(bytes: Uint8Array<ArrayBuffer>): ImageInfo | null {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ") return { type: "webp", width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    if (chunk === "VP8L") {
      const [b0, b1, b2, b3] = bytes.subarray(21, 25);
      return { type: "webp", width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === "VP8X") return { type: "webp", width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpg", height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
      }
      offset += 2 + length;
    }
  }
  return null;
}

// Checks one uploaded size against the expected dimensions and byte limit.
export function checkCoverFile(bytes: Uint8Array<ArrayBuffer>, size: keyof typeof COVER_SIZES): ImageInfo | string {
  const expected = COVER_SIZES[size];
  if (bytes.length > expected.maxBytes) return `Ảnh ${expected.width}px quá nặng (tối đa ${Math.round(expected.maxBytes / 1000)} KB).`;
  const info = imageInfo(bytes);
  if (!info) return "Ảnh phải ở định dạng WebP hoặc JPG.";
  if (info.width !== expected.width || info.height !== expected.height) return `Ảnh phải đúng ${expected.width} × ${expected.height} px.`;
  return info;
}

// Stores both sizes under an unguessable name, cached for a year (a new upload always gets a new name).
export async function storeCover(large: Uint8Array<ArrayBuffer>, small: Uint8Array<ArrayBuffer>, type: "webp" | "jpg") {
  const id = crypto.randomUUID().replace(/-/g, "");
  const contentType = type === "webp" ? "image/webp" : "image/jpeg";
  const cache = "public, max-age=31536000, immutable";
  await putPublicObject(`covers/${id}-sm.${type}`, small, contentType, cache);
  return putPublicObject(`covers/${id}.${type}`, large, contentType, cache);
}

// Deletes an uploaded cover (both sizes) once no story uses it any more. Covers from other hosts are left alone.
export async function deleteCoverIfUnused(admin: ReturnType<typeof createServiceClient>, url: string | null | undefined) {
  if (!url || !isManagedCover(url) || !url.startsWith((r2Config.publicUrl ?? "").replace(/\/$/, "") + "/")) return;
  const { count } = await admin.from("stories").select("id", { count: "exact", head: true }).eq("cover_url", url);
  if (count) return;
  const key = new URL(url).pathname.replace(/^\//, "");
  for (const target of [key, key.replace(/\.(webp|jpg)$/, "-sm.$1")]) {
    // A failure is logged, not thrown: the story change has already been saved, and the hourly cleanup retries later.
    await deletePublicObject(target).catch((error) => console.error("[covers]", error instanceof Error ? error.message : error));
  }
}

// Shared body of the admin and author upload endpoints: multipart form with "large" (600×750) and "small" (300×375),
// both already cropped and encoded in the browser. Returns the public URL of the large image.
export async function receiveCoverUpload(request: Request): Promise<{ url: string } | { error: string; status: number }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 700_000) return { error: "Ảnh quá nặng.", status: 413 };
  const form = await request.formData().catch(() => null);
  const large = form?.get("large");
  const small = form?.get("small");
  if (!(large instanceof Blob) || !(small instanceof Blob)) return { error: "Thiếu file ảnh.", status: 400 };
  const largeBytes = new Uint8Array(await large.arrayBuffer());
  const smallBytes = new Uint8Array(await small.arrayBuffer());
  const largeInfo = checkCoverFile(largeBytes, "large");
  if (typeof largeInfo === "string") return { error: largeInfo, status: 400 };
  const smallInfo = checkCoverFile(smallBytes, "small");
  if (typeof smallInfo === "string") return { error: smallInfo, status: 400 };
  if (smallInfo.type !== largeInfo.type) return { error: "Hai cỡ ảnh phải cùng định dạng.", status: 400 };
  try {
    return { url: await storeCover(largeBytes, smallBytes, largeInfo.type) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Không lưu được ảnh.", status: 503 };
  }
}

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanup = 0;

// Deletes uploaded covers that no story uses and that are older than 24 hours (uploaded, then the form was closed
// without saving). The age keeps covers of forms still being filled in. Runs at most once an hour per server instance.
export async function cleanupOrphanCovers(admin: ReturnType<typeof createServiceClient>) {
  const bucket = r2Buckets().public;
  if (!bucket || !r2ApiReady() || Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = Date.now();
  const { data, error } = await admin.from("stories").select("cover_url").like("cover_url", "%/covers/%");
  if (error) return;
  const used = new Set((data ?? []).map((row) => row.cover_url?.match(/\/covers\/([0-9a-f]{32})\./)?.[1]).filter(Boolean));
  const { files } = await listR2(bucket, "covers/");
  const stale = files.filter((file) => {
    const id = file.key.match(/^covers\/([0-9a-f]{32})(-sm)?\.(webp|jpg)$/)?.[1];
    return id && !used.has(id) && Date.now() - Date.parse(file.lastModified) > ORPHAN_AGE_MS;
  });
  for (const file of stale) await deletePublicObject(file.key).catch((error) => console.error("[covers]", error instanceof Error ? error.message : error));
}
