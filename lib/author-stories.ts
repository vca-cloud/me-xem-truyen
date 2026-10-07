import "server-only";

import { authorLockError } from "@/lib/author-rules";
import { maskForReaders } from "@/lib/moderation";
import { validTextUrl } from "@/lib/story-data";

const statuses = ["Đang ra", "Hoàn thành", "Tạm dừng"];

export type AuthorStoryInput = { title?: unknown; description?: unknown; cover_url?: unknown; status?: unknown; genres?: unknown; lock_from_chapter?: unknown; lock_price_coins?: unknown };

// Validates story fields an author may set (genres only from the existing catalog).
export async function parseAuthorStory(body: AuthorStoryInput, catalog: string[]) {
  const title = typeof body.title === "string" ? body.title.normalize("NFC").trim() : "";
  if (!title || title.length > 200) return { error: "Tên truyện từ 1 đến 200 ký tự." };
  // Story titles are public everywhere: refuse titles that the dictionary would mask.
  if ((await maskForReaders(title)) !== title.normalize("NFC")) return { error: "Tên truyện chứa từ không phù hợp, vui lòng đặt tên khác." };
  const cover = typeof body.cover_url === "string" ? body.cover_url.trim() : "";
  if (cover && !validTextUrl(cover)) return { error: "Link ảnh bìa phải bắt đầu bằng https://." };
  const status = typeof body.status === "string" && statuses.includes(body.status) ? body.status : "Đang ra";
  const lockText = body.lock_from_chapter === null || body.lock_from_chapter === undefined ? "" : String(body.lock_from_chapter).trim();
  const lockFrom = lockText === "" ? null : Number(lockText);
  const price = body.lock_price_coins === undefined || body.lock_price_coins === "" ? 3 : Number(body.lock_price_coins);
  if (lockFrom !== null && !Number.isInteger(lockFrom)) return { error: "Chương bắt đầu khóa phải là số." };
  if (!Number.isInteger(price)) return { error: "Giá chương phải là số nguyên." };
  const lockError = authorLockError(lockFrom, price);
  if (lockError) return { error: lockError };
  const lower = new Map(catalog.map((name) => [name.toLocaleLowerCase("vi"), name]));
  const genres = (Array.isArray(body.genres) ? body.genres : []).map((name) => lower.get(String(name).toLocaleLowerCase("vi"))).filter((name): name is string => !!name).slice(0, 5);
  return { value: { title, description: typeof body.description === "string" ? body.description.trim().slice(0, 5000) : "", cover_url: cover || null, status, lock_from_chapter: lockFrom, lock_price_coins: price }, genres };
}
