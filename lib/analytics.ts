import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emptySummary, rangeOptions, type RevenueDashboard } from "@/lib/analytics-shared";

function vietnamToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function shiftDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveRange(key?: string | string[]) {
  const option = rangeOptions.find((item) => item.key === key) ?? rangeOptions[1];
  const to = vietnamToday();
  return { ...option, from: shiftDate(to, -(option.days - 1)), to };
}

export type ResolvedRange = ReturnType<typeof resolveRange>;

export const emptyDashboard: RevenueDashboard = {
  summary: emptySummary, daily: [], stories: [], placements: [], links: [], ad_units: [], devices: [],
};

export async function getRevenueDashboard(range: ResolvedRange): Promise<{ data: RevenueDashboard; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_revenue_dashboard", { p_from: range.from, p_to: range.to });
    if (error) return { data: emptyDashboard, error: error.message };
    const value = data as Partial<RevenueDashboard> | null;
    return {
      data: {
        summary: { ...emptySummary, ...value?.summary },
        daily: value?.daily ?? [],
        stories: value?.stories ?? [],
        placements: value?.placements ?? [],
        links: value?.links ?? [],
        ad_units: value?.ad_units ?? [],
        devices: value?.devices ?? [],
      },
      error: null,
    };
  } catch (error) {
    return { data: emptyDashboard, error: error instanceof Error ? error.message : "Không thể tải số liệu." };
  }
}

export type ViewReport = {
  total: number; visitors_total: number; today: number; last7: number; last30: number;
  daily: { date: string; views: number; visitors: number }[];
  stories: { id: string; slug: string; title: string; hot_pinned: boolean; total: number; d7: number; d30: number; visitors: number; spark: number[] }[];
};

const emptyViewReport: ViewReport = { total: 0, visitors_total: 0, today: 0, last7: 0, last30: 0, daily: [], stories: [] };

// Real view report for /admin/luot-xem (RPC admin_view_stats, migration 0009).
export async function getViewReport(days: number): Promise<{ data: ViewReport; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_view_stats", { p_days: days });
    if (error) return { data: emptyViewReport, error: error.message };
    return { data: { ...emptyViewReport, ...(data as Partial<ViewReport>) }, error: null };
  } catch (error) {
    return { data: emptyViewReport, error: error instanceof Error ? error.message : "Không tải được dữ liệu." };
  }
}
