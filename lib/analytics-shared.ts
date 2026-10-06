// Shared (client + server) analytics types, labels and derived metrics. All money values are VND.

export const affiliatePlacements = [
  { value: "dau-chuong", label: "Đầu chương" },
  { value: "giua-chuong", label: "Giữa chương" },
  { value: "cuoi-chuong", label: "Cuối chương" },
  { value: "trang-truyen", label: "Trang giới thiệu truyện" },
  { value: "trang-chu", label: "Trang chủ" },
  { value: "sidebar", label: "Thanh bên" },
  { value: "khac", label: "Khác" },
] as const;

export type AffiliatePlacement = (typeof affiliatePlacements)[number]["value"];

export function placementLabel(value: string) {
  return affiliatePlacements.find((item) => item.value === value)?.label ?? value;
}

export const rangeOptions = [
  { key: "7d", label: "7 ngày", days: 7 },
  { key: "30d", label: "30 ngày", days: 30 },
  { key: "90d", label: "90 ngày", days: 90 },
  { key: "365d", label: "12 tháng", days: 365 },
] as const;

export type RangeKey = (typeof rangeOptions)[number]["key"];

export type RevenueSummary = {
  page_views: number;
  visitors: number;
  adsense_earnings: number;
  adsense_impressions: number;
  adsense_clicks: number;
  adsense_page_views: number;
  affiliate_clicks: number;
  affiliate_orders: number;
  commission_pending: number;
  commission_approved: number;
  commission_cancelled: number;
  order_amount: number;
  last_adsense_sync: string | null;
  last_conversion_import: string | null;
};

export type RevenueDashboard = {
  summary: RevenueSummary;
  daily: { date: string; page_views: number; adsense: number; commission: number; affiliate_clicks: number }[];
  stories: { story_slug: string; title: string; page_views: number; visitors: number; affiliate_clicks: number; estimated_adsense: number }[];
  placements: { placement: string; clicks: number; orders: number; commission: number }[];
  links: { id: string; name: string; target_url: string; placement: string; sub_id: string | null; story_slug: string | null; active: boolean; clicks: number; orders: number; commission: number }[];
  ad_units: { ad_unit: string; page_views: number; impressions: number; clicks: number; earnings: number }[];
  devices: { device: "mobile" | "tablet" | "desktop"; page_views: number; affiliate_clicks: number }[];
};

export const emptySummary: RevenueSummary = {
  page_views: 0, visitors: 0, adsense_earnings: 0, adsense_impressions: 0, adsense_clicks: 0, adsense_page_views: 0,
  affiliate_clicks: 0, affiliate_orders: 0, commission_pending: 0, commission_approved: 0, commission_cancelled: 0,
  order_amount: 0, last_adsense_sync: null, last_conversion_import: null,
};

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export function deriveMetrics(summary: RevenueSummary) {
  const commission = summary.commission_pending + summary.commission_approved;
  const totalRevenue = summary.adsense_earnings + commission;
  return {
    commission,
    totalRevenue,
    siteRpm: ratio(totalRevenue, summary.page_views) * 1000,
    adsensePageRpm: ratio(summary.adsense_earnings, summary.adsense_page_views) * 1000,
    adsenseCtr: ratio(summary.adsense_clicks, summary.adsense_impressions),
    affiliateCtr: ratio(summary.affiliate_clicks, summary.page_views),
    conversionRate: ratio(summary.affiliate_orders, summary.affiliate_clicks),
    epc: ratio(commission, summary.affiliate_clicks),
    viewsPerVisitor: ratio(summary.page_views, summary.visitors),
  };
}

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("vi-VN");

export const formatVnd = (value: number) => vnd.format(value);
export const formatNumber = (value: number) => integer.format(value);
export const formatPercent = (value: number) => `${(value * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;

export const revenueImportTemplates = {
  shopee: {
    filename: "mau-don-hang-shopee.csv",
    headers: ["order_id", "sub_id", "order_amount", "commission", "status", "ordered_at"],
    sample: ["SPX0001", "cuoi-chuong-01", "250000", "17500", "pending", "2026-10-01 20:15"],
  },
  adsense: {
    filename: "mau-adsense-hang-ngay.csv",
    headers: ["date", "ad_unit", "page_views", "impressions", "clicks", "earnings"],
    sample: ["2026-10-01", "Cuối chương", "1200", "2400", "18", "35000"],
  },
} as const;

export type RevenueImportType = keyof typeof revenueImportTemplates;
