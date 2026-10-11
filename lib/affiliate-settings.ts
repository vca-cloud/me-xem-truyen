// Per-story Shopee pop-up settings (migration 0012), shared by the admin form and the API.

// After a reader clicks the Shopee button, how long before the pop-up shows again on this story.
// 0 = every time a chapter page is opened (nothing remembered: leaving and coming back shows it again).
export const AFFILIATE_GATE_OPTIONS = [
  { value: 0, label: "Mỗi lần mở chương" },
  { value: 30, label: "Sau 30 phút" },
  { value: 120, label: "Sau 2 giờ" },
  { value: 1440, label: "Sau 24 giờ" },
] as const;

export function parseAffiliateSettings(body: Record<string, unknown>): { value: Record<string, boolean | number | string | null>; error: string | null } {
  const value: Record<string, boolean | number | string | null> = {};
  if (typeof body.affiliate_enabled === "boolean") value.affiliate_enabled = body.affiliate_enabled;
  if (body.affiliate_gate_minutes !== undefined) {
    const minutes = Number(body.affiliate_gate_minutes);
    if (!AFFILIATE_GATE_OPTIONS.some((option) => option.value === minutes)) return { value, error: "Tần suất pop-up không hợp lệ." };
    value.affiliate_gate_minutes = minutes;
  }
  if (body.affiliate_link_id !== undefined) {
    const id = body.affiliate_link_id;
    if (id !== null && id !== "" && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return { value, error: "Link affiliate không hợp lệ." };
    value.affiliate_link_id = id || null;
  }
  return { value, error: null };
}
