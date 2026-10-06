import { NextResponse, type NextRequest } from "next/server";
import { getRevenueDashboard, resolveRange } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth";

const cell = (value: string | number | null) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Daily revenue + traffic report for the selected range, as UTF-8 CSV.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xuất báo cáo." }, { status: 401 });
  }
  const range = resolveRange(request.nextUrl.searchParams.get("range") ?? undefined);
  const { data, error } = await getRevenueDashboard(range);
  if (error) return NextResponse.json({ error }, { status: 500 });

  const lines = [
    ["ngay", "luot_xem", "click_affiliate", "doanh_thu_adsense", "hoa_hong_shopee", "tong_doanh_thu"],
    ...data.daily.map((day) => [day.date, day.page_views, day.affiliate_clicks, day.adsense, day.commission, day.adsense + day.commission]),
  ];
  const csv = "﻿" + lines.map((line) => line.map(cell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="doanh-thu-${range.from}-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
