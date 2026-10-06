import Link from "next/link";
import { AlertTriangle, Download, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRevenueDashboard, resolveRange } from "@/lib/analytics";
import { deriveMetrics, formatNumber, formatPercent, formatVnd, placementLabel, rangeOptions, type RevenueDashboard } from "@/lib/analytics-shared";
import { cn } from "@/lib/utils";

const deviceLabels = { mobile: "Điện thoại", tablet: "Máy tính bảng", desktop: "Máy tính" } as const;
const dateTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function buildAlerts({ summary }: RevenueDashboard, metrics: ReturnType<typeof deriveMetrics>) {
  const alerts: { tone: "warn" | "info"; text: string }[] = [];
  if (summary.adsense_impressions > 1000 && metrics.adsenseCtr > 0.05) alerts.push({ tone: "warn", text: `CTR AdSense ${formatPercent(metrics.adsenseCtr)} cao bất thường (thường dưới 3%). Kiểm tra click không hợp lệ trước khi Google phát hiện.` });
  if (summary.adsense_page_views > 0 && summary.page_views > 0) {
    const gap = Math.abs(summary.adsense_page_views - summary.page_views) / summary.page_views;
    if (gap > 0.3) alerts.push({ tone: "info", text: `Lượt xem hệ thống (${formatNumber(summary.page_views)}) lệch ${formatPercent(gap)} so với AdSense (${formatNumber(summary.adsense_page_views)}). Kiểm tra mã theo dõi hoặc vị trí đặt quảng cáo.` });
  }
  if (summary.affiliate_clicks >= 200 && summary.affiliate_orders === 0) alerts.push({ tone: "warn", text: `${formatNumber(summary.affiliate_clicks)} click affiliate nhưng chưa có đơn nào được import. Kiểm tra link Shopee hoặc import báo cáo đơn hàng.` });
  if (!summary.last_adsense_sync) alerts.push({ tone: "info", text: "Chưa có dữ liệu AdSense. Import báo cáo tại trang Affiliate → Nhập báo cáo doanh thu." });
  if (!summary.last_conversion_import) alerts.push({ tone: "info", text: "Chưa import báo cáo đơn hàng Shopee." });
  return alerts;
}

function Kpi({ title, value, note, accent = false }: { title: string; value: string; note: string; accent?: boolean }) {
  return <Card className="min-w-0 border-cyan-200 bg-white/90 shadow-none"><CardContent className="p-5"><p className="truncate text-sm text-[#36759e]">{title}</p><p className={cn("mt-3 truncate text-2xl font-bold tracking-tight", accent ? "text-[#f45132]" : "text-[#155295]")}>{value}</p><p className="mt-1 truncate text-xs text-[#4c7d9e]">{note}</p></CardContent></Card>;
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <Card className="min-w-0 border-cyan-200 bg-white/90 shadow-none"><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base text-[#155295] sm:text-lg">{title}</CardTitle>{action}</CardHeader><CardContent className="min-w-0">{children}</CardContent></Card>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-cyan-200 px-4 py-8 text-center text-sm text-[#4c7d9e]">{children}</p>;
}

function Table({ head, rows, minWidth = 560 }: { head: string[]; rows: React.ReactNode[][]; minWidth?: number }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm" style={{ minWidth }}><thead className="border-b border-cyan-200 text-[#36759e]"><tr>{head.map((label, index) => <th key={label} className={cn("px-2 py-3 font-normal", index > 0 && "text-right")}>{label}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-cyan-100 last:border-0">{row.map((value, index) => <td key={index} className={cn("max-w-56 truncate px-2 py-3", index > 0 && "text-right tabular-nums")}>{value}</td>)}</tr>)}</tbody></table></div>;
}

function RevenueChart({ daily }: { daily: RevenueDashboard["daily"] }) {
  const max = Math.max(...daily.map((day) => day.adsense + day.commission), 0);
  if (max === 0) return <Empty>Chưa có doanh thu trong khoảng thời gian này.</Empty>;
  return <div><div className="flex h-56 items-end gap-px border-b border-l border-slate-300 px-1">{daily.map((day) => <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${shortDate(day.date)} · AdSense ${formatVnd(day.adsense)} · Shopee ${formatVnd(day.commission)}`}><div className="bg-[#f45132]" style={{ height: `${(day.commission / max) * 100}%` }} /><div className="rounded-t-sm bg-[#155295]" style={{ height: `${(day.adsense / max) * 100}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>{shortDate(daily[0].date)}</span><span>{shortDate(daily[daily.length - 1].date)}</span></div><div className="mt-3 flex justify-center gap-5 text-xs text-[#4c7d9e]"><span><i className="mr-1.5 inline-block size-2.5 bg-[#155295]" />AdSense</span><span><i className="mr-1.5 inline-block size-2.5 bg-[#f45132]" />Hoa hồng Shopee</span><span>Cao nhất: {formatVnd(max)}/ngày</span></div></div>;
}

function TrafficChart({ daily }: { daily: RevenueDashboard["daily"] }) {
  const max = Math.max(...daily.map((day) => day.page_views), 0);
  if (max === 0) return <Empty>Chưa có lượt xem. Lượt xem được ghi khi người đọc mở trang truyện hoặc trang chương.</Empty>;
  return <div><div className="flex h-56 items-end gap-px border-b border-l border-slate-300 px-1">{daily.map((day) => <div key={day.date} className="relative flex h-full min-w-0 flex-1 items-end" title={`${shortDate(day.date)} · ${formatNumber(day.page_views)} lượt xem · ${formatNumber(day.affiliate_clicks)} click`}><div className="w-full rounded-t-sm bg-[#6b9fc2]" style={{ height: `${(day.page_views / max) * 100}%` }} /><div className="absolute inset-x-0 bottom-0 bg-[#f45132]" style={{ height: `${(day.affiliate_clicks / max) * 100}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>{shortDate(daily[0].date)}</span><span>{shortDate(daily[daily.length - 1].date)}</span></div><div className="mt-3 flex justify-center gap-5 text-xs text-[#4c7d9e]"><span><i className="mr-1.5 inline-block size-2.5 bg-[#6b9fc2]" />Lượt xem</span><span><i className="mr-1.5 inline-block size-2.5 bg-[#f45132]" />Click affiliate</span></div></div>;
}

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const range = resolveRange((await searchParams).range);
  const { data, error } = await getRevenueDashboard(range);
  const { summary } = data;
  const metrics = deriveMetrics(summary);
  const alerts = error ? [] : buildAlerts(data, metrics);

  return <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#c5e6eb] p-4 text-[#155295] sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Doanh thu &amp; Theo dõi</h1><p className="mt-1 text-sm text-[#36759e]">{shortDate(range.from)}/{range.from.slice(0, 4)} – {shortDate(range.to)}/{range.to.slice(0, 4)} (giờ Việt Nam) · AdSense cập nhật: {summary.last_adsense_sync ? dateTime.format(new Date(summary.last_adsense_sync)) : "chưa có"} · Đơn Shopee cập nhật: {summary.last_conversion_import ? dateTime.format(new Date(summary.last_conversion_import)) : "chưa có"}</p></div>
      <div className="flex flex-wrap gap-2"><nav aria-label="Khoảng thời gian" className="flex rounded-lg border border-cyan-300 bg-white/40 p-0.5">{rangeOptions.map((option) => <Link key={option.key} href={`/admin?range=${option.key}`} className={cn("rounded-md px-3 py-1.5 text-sm", option.key === range.key ? "bg-[#155295] text-white" : "hover:bg-white/70")}>{option.label}</Link>)}</nav><a href={`/api/admin/analytics/export?range=${range.key}`} download className="inline-flex h-9 items-center rounded-lg border border-cyan-300 bg-white/40 px-3 text-sm hover:bg-white/70"><Download className="mr-2 size-4" />Xuất CSV</a></div>
    </div>

    {error && <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">Chưa tải được số liệu, các chỉ số bên dưới đang hiển thị 0.</p><p className="mt-1">Cần: (1) Supabase hoạt động và đã chạy migration <code>0003_analytics.sql</code>; (2) đăng nhập bằng tài khoản admin thật (chế độ bỏ qua đăng nhập không có quyền đọc số liệu). Chi tiết: {error}</p></div></div>}
    {alerts.length > 0 && <div className="mb-6 space-y-2">{alerts.map((alert) => <div key={alert.text} className={cn("flex gap-3 rounded-lg border p-3 text-sm", alert.tone === "warn" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-cyan-200 bg-white/70 text-[#155295]")}>{alert.tone === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}{alert.text}</div>)}</div>}

    <section><h2 className="mb-4 text-xl font-semibold">1. Doanh thu</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi title="Tổng doanh thu" value={formatVnd(metrics.totalRevenue)} note="AdSense + hoa hồng (gồm chờ duyệt)" accent />
      <Kpi title="Doanh thu AdSense" value={formatVnd(summary.adsense_earnings)} note={`RPM trang ${formatVnd(metrics.adsensePageRpm)}`} />
      <Kpi title="Hoa hồng Shopee đã duyệt" value={formatVnd(summary.commission_approved)} note={`Chờ duyệt ${formatVnd(summary.commission_pending)} · Hủy ${formatVnd(summary.commission_cancelled)}`} />
      <Kpi title="RPM tổng" value={formatVnd(metrics.siteRpm)} note="Doanh thu / 1.000 lượt xem" accent />
    </div></section>

    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">2. Lưu lượng &amp; chuyển đổi</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi title="Lượt xem thực" value={formatNumber(summary.page_views)} note={`${formatNumber(summary.visitors)} người đọc · ${metrics.viewsPerVisitor.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} trang/người`} />
      <Kpi title="CTR AdSense" value={formatPercent(metrics.adsenseCtr)} note={`${formatNumber(summary.adsense_clicks)} click / ${formatNumber(summary.adsense_impressions)} hiển thị`} />
      <Kpi title="Click affiliate" value={formatNumber(summary.affiliate_clicks)} note={`CTR ${formatPercent(metrics.affiliateCtr)} trên lượt xem`} accent />
      <Kpi title="Đơn hàng Shopee" value={formatNumber(summary.affiliate_orders)} note={`Chuyển đổi ${formatPercent(metrics.conversionRate)} · EPC ${formatVnd(metrics.epc)}`} />
    </div></section>

    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">3. Biểu đồ theo ngày</h2><div className="grid gap-6 xl:grid-cols-2"><Panel title="Doanh thu theo ngày"><RevenueChart daily={data.daily} /></Panel><Panel title="Lượt xem & click affiliate"><TrafficChart daily={data.daily} /></Panel></div></section>

    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">4. Affiliate Shopee</h2><div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Hiệu quả theo vị trí đặt link">{data.placements.length ? <Table head={["Vị trí", "Click", "CTR", "Đơn", "Hoa hồng"]} rows={data.placements.map((item) => [placementLabel(item.placement), formatNumber(item.clicks), formatPercent(summary.page_views ? item.clicks / summary.page_views : 0), formatNumber(item.orders), formatVnd(item.commission)])} /> : <Empty>Chưa có link affiliate nào.</Empty>}</Panel>
      <Panel title="Top link affiliate" action={<Link href="/admin/affiliate" className="text-sm text-[#36759e] hover:underline">Quản lý link</Link>}>{data.links.length ? <Table head={["Link", "Click", "Đơn", "Hoa hồng", "EPC"]} rows={[...data.links].sort((a, b) => b.commission - a.commission || b.clicks - a.clicks).slice(0, 5).map((link) => [<span key="name" className={cn("font-medium", !link.active && "text-slate-400 line-through")}>{link.name}</span>, formatNumber(link.clicks), formatNumber(link.orders), formatVnd(link.commission), formatVnd(link.clicks ? link.commission / link.clicks : 0)])} /> : <Empty>Chưa có link affiliate nào.</Empty>}</Panel>
    </div></section>

    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">5. AdSense &amp; thiết bị</h2><div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Hiệu quả theo ad unit">{data.ad_units.length ? <Table head={["Ad unit", "Hiển thị", "Click", "CTR", "Doanh thu", "RPM trang"]} minWidth={620} rows={data.ad_units.map((unit) => [unit.ad_unit, formatNumber(unit.impressions), formatNumber(unit.clicks), formatPercent(unit.impressions ? unit.clicks / unit.impressions : 0), formatVnd(unit.earnings), formatVnd(unit.page_views ? (unit.earnings / unit.page_views) * 1000 : 0)])} /> : <Empty>Chưa có báo cáo AdSense.</Empty>}</Panel>
      <Panel title="Theo thiết bị">{data.devices.length ? <Table head={["Thiết bị", "Lượt xem", "Tỷ trọng", "Click affiliate", "CTR"]} rows={data.devices.map((item) => [deviceLabels[item.device] ?? item.device, formatNumber(item.page_views), formatPercent(summary.page_views ? item.page_views / summary.page_views : 0), formatNumber(item.affiliate_clicks), formatPercent(item.page_views ? item.affiliate_clicks / item.page_views : 0)])} /> : <Empty>Chưa có lượt xem.</Empty>}</Panel>
    </div></section>

    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">6. Truyện mang lại doanh thu</h2><Panel title="Top truyện theo lượt xem">{data.stories.length ? <><Table head={["Truyện", "Lượt xem", "Người đọc", "Click affiliate", "CTR affiliate", "AdSense ước tính"]} minWidth={720} rows={data.stories.map((story) => [<Link key="title" href={`/truyen/${story.story_slug}`} className="font-medium hover:underline">{story.title}</Link>, formatNumber(story.page_views), formatNumber(story.visitors), formatNumber(story.affiliate_clicks), formatPercent(story.page_views ? story.affiliate_clicks / story.page_views : 0), formatVnd(story.estimated_adsense)])} /><p className="mt-3 text-xs text-[#4c7d9e]">AdSense không báo cáo theo từng truyện. Cột ước tính = lượt xem của truyện × RPM AdSense toàn site.</p></> : <Empty>Chưa có lượt xem truyện nào.</Empty>}</Panel></section>
  </div>;
}
