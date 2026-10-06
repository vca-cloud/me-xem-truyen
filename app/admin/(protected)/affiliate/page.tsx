import { AffiliateManager } from "@/components/affiliate-manager";
import { PageHeading } from "@/components/admin-ui";
import { getRevenueDashboard, resolveRange } from "@/lib/analytics";

export default async function AffiliatePage() {
  const range = resolveRange("30d");
  const { data, error } = await getRevenueDashboard(range);
  return <>
    <PageHeading title="Affiliate & doanh thu" description="Quản lý link Shopee, nhập báo cáo đơn hàng Shopee và báo cáo AdSense. Số liệu click/đơn tính trong 30 ngày gần nhất." />
    {error && <p role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Chưa tải được dữ liệu: cần Supabase hoạt động, đã chạy migration <code>0003_analytics.sql</code> và đăng nhập bằng tài khoản admin. Chi tiết: {error}</p>}
    <AffiliateManager links={data.links} />
  </>;
}
