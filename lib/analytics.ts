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
