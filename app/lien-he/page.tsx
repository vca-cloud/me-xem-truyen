import { BrandName } from "@/components/logo";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Liên hệ", description: `Liên hệ ${siteInfo.name}.` };

export default function ContactPage() {
  return <LegalPage title="Liên hệ" updated="06/10/2026">
    <p>Mọi góp ý, báo lỗi, hỗ trợ nạp Xu hoặc yêu cầu về bản quyền, vui lòng liên hệ:</p>
    <ul>
      {siteInfo.company && <li>Đơn vị vận hành: {siteInfo.company}{siteInfo.taxCode && ` (MST ${siteInfo.taxCode})`}</li>}
      {siteInfo.address && <li>Địa chỉ: {siteInfo.address}</li>}
      <li>Email: {siteInfo.email ? <a className="text-primary underline" href={`mailto:${siteInfo.email}`}>{siteInfo.email}</a> : "(chưa cập nhật)"}</li>
      {siteInfo.phone && <li>Điện thoại: {siteInfo.phone}</li>}
    </ul>
    <h2>Yêu cầu gỡ nội dung vi phạm bản quyền</h2>
    <p>Vui lòng gửi: tên tác phẩm, đường dẫn trên <BrandName />, giấy tờ chứng minh quyền sở hữu và thông tin liên hệ của bạn. Chúng tôi phản hồi trong vòng 3 ngày làm việc.</p>
    <h2>Hỗ trợ nạp Xu</h2>
    <p>Khi nạp Xu bị lỗi, vui lòng gửi email đăng nhập, thời gian chuyển tiền, số tiền và ảnh chụp giao dịch.</p>
  </LegalPage>;
}
