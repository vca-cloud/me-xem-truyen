import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Chính sách bảo mật", description: `Chính sách bảo mật của ${siteInfo.name}.` };

export default function PrivacyPage() {
  return <LegalPage title="Chính sách bảo mật" updated="06/10/2026">
    <h2>1. Thông tin chúng tôi thu thập</h2>
    <ul>
      <li>Thông tin tài khoản: email, tên hiển thị. Mật khẩu được mã hóa bởi nhà cung cấp xác thực, chúng tôi không xem được.</li>
      <li>Lịch sử Xu: các lần nạp, mở khóa chương.</li>
      <li>Dữ liệu sử dụng ẩn danh: trang đã xem, loại thiết bị, trang giới thiệu. Chúng tôi dùng một mã ngẫu nhiên lưu trong cookie để không đếm trùng lượt xem; địa chỉ IP chỉ được lưu dưới dạng mã hóa một chiều để chống spam.</li>
    </ul>
    <h2>2. Mục đích sử dụng</h2>
    <p>Cung cấp và cải thiện dịch vụ, ghi nhận Xu, hỗ trợ người dùng, thống kê lượt đọc và phòng chống gian lận. Chúng tôi không bán thông tin cá nhân của bạn.</p>
    <h2>3. Cookie và quảng cáo của bên thứ ba</h2>
    <ul>
      <li>Các nhà cung cấp bên thứ ba, bao gồm Google, sử dụng cookie để phân phát quảng cáo dựa trên các lần truy cập trước đây của bạn vào trang web này hoặc các trang web khác.</li>
      <li>Việc Google sử dụng cookie quảng cáo cho phép Google và các đối tác phân phát quảng cáo cho bạn dựa trên lượt truy cập của bạn vào trang web này và/hoặc các trang web khác trên Internet.</li>
      <li>Bạn có thể tắt quảng cáo được cá nhân hóa tại <a className="text-[#08729c] underline" href="https://adssettings.google.com" target="_blank" rel="noreferrer">Cài đặt quảng cáo của Google</a>, hoặc tắt cookie của các nhà cung cấp bên thứ ba tại <a className="text-[#08729c] underline" href="https://www.aboutads.info/choices" target="_blank" rel="noreferrer">aboutads.info</a>.</li>
      <li>Liên kết tiếp thị (ví dụ Shopee) có thể đặt cookie của bên bán để ghi nhận đơn hàng.</li>
    </ul>
    <h2>4. Lưu trữ và bảo mật</h2>
    <p>Dữ liệu được lưu trên hạ tầng của các nhà cung cấp dịch vụ đám mây (Supabase, Vercel, Cloudflare), có kiểm soát truy cập và mã hóa đường truyền.</p>
    <h2>5. Quyền của bạn</h2>
    <p>Bạn có thể yêu cầu xem, sửa hoặc xóa tài khoản và dữ liệu cá nhân bằng cách liên hệ {siteInfo.email || "qua trang Liên hệ"}. Xu còn lại sẽ mất khi tài khoản bị xóa.</p>
  </LegalPage>;
}
