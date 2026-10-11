import { AffiliateManager } from "@/components/affiliate-manager";
import { PageHeading } from "@/components/admin-ui";
import { getRevenueDashboard, resolveRange } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

export default async function AffiliatePage() {
  const range = resolveRange("30d");
  const { data, error } = await getRevenueDashboard(range);
  // Pop-up fields (migration 0012); empty when the columns do not exist yet.
  const supabase = await createClient();
  const { data: extras } = await supabase.from("affiliate_links").select("id, image_url, headline");
  const extraById = new Map(((extras ?? []) as { id: string; image_url: string | null; headline: string | null }[]).map((row) => [row.id, row]));
  const links = data.links.map((link) => ({ ...link, image_url: extraById.get(link.id)?.image_url ?? null, headline: extraById.get(link.id)?.headline ?? null }));
  return <>
    <PageHeading title="Affiliate & doanh thu" description="Quản lý link Shopee, nhập báo cáo đơn hàng Shopee và báo cáo AdSense. Số liệu click/đơn tính trong 30 ngày gần nhất." />
    {error && <p role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Chưa tải được dữ liệu: cần Supabase hoạt động, đã chạy migration <code>0003_analytics.sql</code> và đăng nhập bằng tài khoản admin. Chi tiết: {error}</p>}
    <AffiliateManager links={links} />
  </>;
}
