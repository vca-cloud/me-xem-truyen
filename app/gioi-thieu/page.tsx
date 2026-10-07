import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Giới thiệu", description: `Giới thiệu về ${siteInfo.name}.` };

export default function AboutPage() {
  return <LegalPage title={`Giới thiệu ${siteInfo.name}`} updated="06/10/2026">
    <p>{siteInfo.name} là nền tảng đọc truyện chữ trực tuyến, tập trung vào trải nghiệm đọc gọn gàng trên điện thoại và máy tính.</p>
    <h2>Nội dung</h2>
    <p>Truyện trên {siteInfo.name} được đăng bởi đội ngũ biên tập và các tác giả, dịch giả hợp tác. Chúng tôi tôn trọng quyền tác giả: nếu bạn là chủ sở hữu nội dung và cho rằng nội dung bị đăng không đúng quyền, vui lòng liên hệ qua trang <a className="text-primary underline" href="/lien-he">Liên hệ</a>, chúng tôi sẽ xem xét và gỡ trong thời gian sớm nhất.</p>
    <h2>Đọc miễn phí và Xu</h2>
    <p>Phần lớn truyện được đọc miễn phí. Một số chương mới hoặc chương đặc biệt cần Xu để mở khóa nhằm hỗ trợ tác giả và chi phí vận hành.</p>
    {siteInfo.company && <p>Đơn vị vận hành: <strong>{siteInfo.company}</strong>{siteInfo.taxCode && `, MST ${siteInfo.taxCode}`}{siteInfo.address && `, ${siteInfo.address}`}.</p>}
  </LegalPage>;
}
