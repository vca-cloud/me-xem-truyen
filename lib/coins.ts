// Shared (client + server) coin ("Xu") constants. 1 Xu = 100 VND.

export const COIN_VND = 100;
export const DEFAULT_LOCK_PRICE = 3;

export const topupPackages = [
  { vnd: 10_000, coins: 100, bonus: 0 },
  { vnd: 20_000, coins: 200, bonus: 10 },
  { vnd: 50_000, coins: 500, bonus: 50 },
  { vnd: 100_000, coins: 1_000, bonus: 150 },
] as const;

export const coinKindLabels: Record<string, string> = {
  topup: "Nạp Xu",
  bonus: "Thưởng",
  unlock: "Mở khóa chương",
  admin_adjust: "Điều chỉnh bởi admin",
  refund: "Hoàn Xu",
};

export const formatCoins = (value: number) => `${value.toLocaleString("vi-VN")} Xu`;

// Price of a chapter under the story's lock setting; 0 = free. Mirrors public.chapter_price() in SQL.
export function chapterPrice(story: { lock_from_chapter: number | null; lock_price_coins: number }, chapterNumber: number) {
  return story.lock_from_chapter !== null && chapterNumber >= story.lock_from_chapter ? story.lock_price_coins : 0;
}

// Validates admin lock settings: blank lock_from = no lock.
export function parseLockSettings(lockFrom: unknown, lockPrice: unknown): { value: { lock_from_chapter: number | null; lock_price_coins: number }; error: string | null } {
  const fromText = lockFrom === null || lockFrom === undefined ? "" : String(lockFrom).trim();
  const priceText = lockPrice === null || lockPrice === undefined ? "" : String(lockPrice).trim();
  const from = fromText === "" ? null : Number(fromText);
  const price = priceText === "" ? DEFAULT_LOCK_PRICE : Number(priceText);
  if (from !== null && (!Number.isInteger(from) || from < 1)) return { value: { lock_from_chapter: null, lock_price_coins: DEFAULT_LOCK_PRICE }, error: "\"Khóa từ chương\" phải là số nguyên dương hoặc để trống." };
  if (!Number.isInteger(price) || price < 1 || price > 1000) return { value: { lock_from_chapter: null, lock_price_coins: DEFAULT_LOCK_PRICE }, error: "Giá mỗi chương phải từ 1 đến 1000 Xu." };
  return { value: { lock_from_chapter: from, lock_price_coins: price }, error: null };
}
