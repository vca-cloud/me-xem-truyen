import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COIN_VND } from "@/lib/coins";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Điều khoản sử dụng", description: `Điều khoản sử dụng ${siteInfo.name}.` };

export default function TermsPage() {
  return <LegalPage title="Điều khoản sử dụng" updated="06/10/2026">
    <p>Khi sử dụng {siteInfo.name} ({siteInfo.url}), bạn đồng ý với các điều khoản dưới đây.</p>
    <h2>1. Tài khoản</h2>
    <ul><li>Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động trên tài khoản của mình.</li><li>Chúng tôi có thể tạm khóa tài khoản có dấu hiệu gian lận, spam hoặc vi phạm pháp luật.</li></ul>
    <h2>2. Xu</h2>
    <ul>
      <li>Xu là đơn vị dùng để mở khóa chương truyện trên {siteInfo.name}. Tỷ lệ tham khảo: 1 Xu tương đương {COIN_VND.toLocaleString("vi-VN")} đồng khi nạp.</li>
      <li>Xu <strong>không quy đổi ngược thành tiền</strong>, không chuyển nhượng cho tài khoản khác và chỉ dùng trên {siteInfo.name}.</li>
      <li>Chương đã mở khóa được đọc lại không giới hạn khi chương còn trên hệ thống.</li>
      <li>Nếu bạn đã chuyển tiền nhưng chưa nhận Xu, hoặc bị trừ Xu do lỗi hệ thống, vui lòng liên hệ trong vòng 30 ngày để được kiểm tra và hoàn Xu.</li>
      <li>Xu được tặng/thưởng có thể có điều kiện riêng theo từng chương trình.</li>
    </ul>
    <h2>3. Nội dung</h2>
    <ul><li>Nội dung truyện thuộc quyền của tác giả/chủ sở hữu. Không sao chép, phát tán lại nội dung trả phí.</li><li>Không dùng công cụ tự động để tải hàng loạt nội dung hoặc tạo lượt xem, lượt nhấp giả.</li></ul>
    <h2>4. Quảng cáo và liên kết</h2>
    <p>{siteInfo.name} có hiển thị quảng cáo và liên kết tiếp thị liên kết (affiliate). Khi bạn mua hàng qua liên kết, chúng tôi có thể nhận hoa hồng mà không làm tăng giá bạn trả.</p>
    <h2>5. Thay đổi điều khoản</h2>
    <p>Điều khoản có thể được cập nhật; ngày cập nhật được ghi ở đầu trang. Việc tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận điều khoản mới.</p>
  </LegalPage>;
}
