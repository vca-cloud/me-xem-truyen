// Author program rules shared by the server and the author pages.

export const DEFAULT_REVENUE_SHARE = 70;
export const MIN_FREE_CHAPTERS = 5; // authors may lock from chapter 6 onwards
export const TRUST_THRESHOLD = 10; // published chapters before clean chapters publish without review
export const MAX_LOCK_PRICE = 20;
export const PAYOUT_DAY = 20;
export const MIN_PAYOUT_COINS = 500; // 500 Xu = 50.000đ
export const MAX_CHAPTER_CHARS = 200_000;

export const authorStatusLabels: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối", suspended: "Tạm khóa" };
export const publishStatusLabels: Record<string, string> = { draft: "Nháp", submitted: "Chờ duyệt đăng", published: "Đã đăng", rejected: "Bị từ chối" };

// Payout period = the month whose 20th the money is paid on (Vietnam time): requests after the 20th go to next month.
export function payoutPeriod(now = new Date()) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now).split("-").map(Number);
  const next = day > PAYOUT_DAY;
  const y = next && month === 12 ? year + 1 : year;
  const m = next ? (month % 12) + 1 : month;
  return { period: `${y}-${String(m).padStart(2, "0")}`, payDate: `${PAYOUT_DAY}/${String(m).padStart(2, "0")}/${y}` };
}

// Author lock rule: null (all free) or from chapter MIN_FREE_CHAPTERS + 1 onwards.
export function authorLockError(lockFrom: number | null, price: number) {
  if (lockFrom !== null && lockFrom <= MIN_FREE_CHAPTERS) return `Phải để ít nhất ${MIN_FREE_CHAPTERS} chương đầu miễn phí (khóa từ chương ${MIN_FREE_CHAPTERS + 1} trở đi).`;
  if (price < 1 || price > MAX_LOCK_PRICE) return `Giá mỗi chương từ 1 đến ${MAX_LOCK_PRICE} Xu.`;
  return null;
}
