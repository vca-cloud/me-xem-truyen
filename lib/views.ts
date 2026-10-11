// Real view counts and the HOT tag (shared by server and client code).
// Views come from view_events through story_view_stats() — never inflated.

// A story is HOT when an admin pinned it, or automatically when it is among the HOT_TOP most viewed stories
// of the last 7 days with at least HOT_MIN_VIEWS_7D views.
export const HOT_MIN_VIEWS_7D = 100;
// NEW tag: stories created in the last NEW_DAYS days.
export const NEW_DAYS = 7;
export const HOT_TOP = 5;

// Public pages only show a view count once a story reaches this many real views (a new site does not look empty,
// and no number is ever inflated). Admin pages always show the exact count.
export const PUBLIC_VIEWS_MIN = 1000;

// The count to show readers, or 0 (= hidden) below the threshold. Apply on the server so small exact numbers
// never reach the page.
export function publicViews(total: number) {
  return total >= PUBLIC_VIEWS_MIN ? total : 0;
}

export type ViewStats = { total_views: number; views_7d: number; hot_pinned: boolean };

export function hotStoryIds(stats: Map<string, ViewStats>) {
  const ranked = [...stats.entries()].filter(([, value]) => value.views_7d >= HOT_MIN_VIEWS_7D).sort((a, b) => b[1].views_7d - a[1].views_7d).slice(0, HOT_TOP);
  return new Set([...ranked.map(([id]) => id), ...[...stats.entries()].filter(([, value]) => value.hot_pinned).map(([id]) => id)]);
}

// 950 → "950", 1234 → "1,2K", 15400 → "15K", 2300000 → "2,3M" (Vietnamese decimal comma).
export function formatViews(value: number) {
  const short = (number: number, unit: string) => `${(number >= 10 ? Math.floor(number) : Math.floor(number * 10) / 10).toLocaleString("vi-VN")}${unit}`;
  if (value >= 1_000_000) return short(value / 1_000_000, "M");
  if (value >= 1_000) return short(value / 1_000, "K");
  return value.toLocaleString("vi-VN");
}
