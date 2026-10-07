import { BrandName } from "@/components/logo";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { DEFAULT_REVENUE_SHARE, MIN_FREE_CHAPTERS, MIN_PAYOUT_COINS, PAYOUT_DAY, TRUST_THRESHOLD } from "@/lib/author-rules";
import { COIN_VND } from "@/lib/coins";
import { siteInfo } from "@/lib/site";

export const metadata: Metadata = { title: "Điều khoản tác giả", description: `Điều khoản dành cho tác giả đăng truyện trên ${siteInfo.name}.` };

export default function AuthorTermsPage() {
  return <LegalPage title="Điều khoản tác giả" updated="07/10/2026">
    <h2>1. Bản quyền</h2>
    <ul><li>Tác giả cam kết truyện do mình sáng tác hoặc có quyền đăng (văn bản cho phép của tác giả gốc/đơn vị giữ bản quyền).</li><li>Tác giả chịu trách nhiệm về khiếu nại bản quyền đối với nội dung mình đăng. <BrandName /> có quyền gỡ ngay nội dung bị khiếu nại và khóa tài khoản vi phạm.</li></ul>
    <h2>2. Nội dung được phép</h2>
    <ul><li>Không đăng nội dung khiêu dâm lộ liễu, bạo lực ghê rợn, cổ vũ tự hại, ma túy, phân biệt đối xử, chính trị, vi phạm pháp luật Việt Nam.</li><li>Mọi chương được hệ thống tự kiểm duyệt; từ ngữ nhạy cảm được che khi hiển thị. Chương có nội dung cần xem xét sẽ chờ admin duyệt.</li><li>Tác giả mới: mọi chương chờ duyệt trước khi đăng. Sau {TRUST_THRESHOLD} chương được đăng, chương không có vấn đề sẽ được đăng ngay.</li><li>Sửa nội dung chương đã đăng sẽ đưa chương về trạng thái chờ duyệt.</li></ul>
    <h2>3. Khóa chương và doanh thu</h2>
    <ul><li>Tác giả được khóa chương bằng Xu, nhưng {MIN_FREE_CHAPTERS} chương đầu của mỗi truyện luôn miễn phí.</li><li>Tác giả nhận {DEFAULT_REVENUE_SHARE}% số Xu người đọc dùng để mở khóa chương của mình (tỷ lệ có thể được điều chỉnh riêng cho từng tác giả). 1 Xu = {COIN_VND.toLocaleString("vi-VN")}đ.</li><li>Doanh thu quảng cáo thuộc về <BrandName />.</li></ul>
    <h2>4. Rút tiền</h2>
    <ul><li>Mỗi tháng gửi yêu cầu rút một lần; tiền được chuyển vào ngày {PAYOUT_DAY} hằng tháng. Yêu cầu gửi sau ngày {PAYOUT_DAY} được chi vào kỳ tháng sau.</li><li>Số dư tối thiểu để rút: {MIN_PAYOUT_COINS.toLocaleString("vi-VN")} Xu.</li><li>Khoản chi có thể được khấu trừ thuế thu nhập cá nhân theo quy định pháp luật trước khi chuyển.</li><li>Xu có được từ gian lận (tự mở khóa, tài khoản ảo…) sẽ bị thu hồi.</li></ul>
    <h2>5. Chấm dứt</h2>
    <p><BrandName /> có thể tạm khóa hoặc chấm dứt tư cách tác giả khi vi phạm điều khoản. Số Xu hợp lệ còn lại sẽ được chi ở kỳ gần nhất.</p>
  </LegalPage>;
}
