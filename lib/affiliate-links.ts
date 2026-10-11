import "server-only";

import { affiliatePlacements } from "@/lib/analytics-shared";
import { validTextUrl } from "@/lib/story-data";

export type AffiliateLinkInput = { name: string; target_url: string; placement: string; sub_id: string | null; story_slug: string | null; image_url?: string | null; headline?: string | null; active?: boolean };

// Validates a partial or full affiliate link payload from an admin request.
export function parseAffiliateLink(body: Record<string, unknown>, partial = false): { value: Partial<AffiliateLinkInput>; error: string | null } {
  const value: Partial<AffiliateLinkInput> = {};
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : undefined);

  const name = text("name");
  if (name !== undefined || !partial) {
    if (!name || name.length > 120) return { value, error: "Tên link là bắt buộc (tối đa 120 ký tự)." };
    value.name = name;
  }
  const targetUrl = text("target_url");
  if (targetUrl !== undefined || !partial) {
    if (!targetUrl || !validTextUrl(targetUrl)) return { value, error: "Link đích phải bắt đầu bằng http:// hoặc https://." };
    value.target_url = targetUrl;
  }
  const placement = text("placement");
  if (placement !== undefined || !partial) {
    if (!affiliatePlacements.some((item) => item.value === placement)) return { value, error: "Vị trí đặt link không hợp lệ." };
    value.placement = placement;
  }
  const subId = text("sub_id");
  if (subId !== undefined) {
    if (subId && !/^[A-Za-z0-9_-]{1,50}$/.test(subId)) return { value, error: "Sub ID chỉ gồm chữ, số, '-' hoặc '_' (tối đa 50 ký tự)." };
    value.sub_id = subId || null;
  }
  const storySlug = text("story_slug");
  if (storySlug !== undefined) {
    if (storySlug && !/^[a-z0-9-]{1,200}$/.test(storySlug)) return { value, error: "Slug truyện không hợp lệ." };
    value.story_slug = storySlug || null;
  }
  // Shown in the chapter pop-up (migration 0012): product picture and one short line.
  const imageUrl = text("image_url");
  if (imageUrl !== undefined) {
    if (imageUrl && !validTextUrl(imageUrl)) return { value, error: "Link ảnh sản phẩm phải bắt đầu bằng http:// hoặc https://." };
    value.image_url = imageUrl || null;
  }
  const headline = text("headline");
  if (headline !== undefined) {
    if (headline.length > 160) return { value, error: "Câu giới thiệu tối đa 160 ký tự." };
    value.headline = headline || null;
  }
  if (typeof body.active === "boolean") value.active = body.active;
  return { value, error: null };
}
