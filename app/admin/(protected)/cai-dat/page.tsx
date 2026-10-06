import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/admin-ui";
import { MfaSettings } from "@/components/mfa-settings";
import { siteInfo } from "@/lib/site";

export default function SettingsPage() {
  const rows: [string, string][] = [
    ["Tên website", siteInfo.name],
    ["Địa chỉ web", siteInfo.url],
    ["Đơn vị vận hành", siteInfo.company || "(chưa điền)"],
    ["Mã số thuế", siteInfo.taxCode || "(chưa điền)"],
    ["Email liên hệ", siteInfo.email || "(chưa điền)"],
  ];
  return <>
    <PageHeading title="Cài đặt" description="Bảo mật tài khoản và thông tin hiển thị trên website." />
    <div className="grid max-w-3xl gap-6">
      <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base">Xác thực 2 lớp</CardTitle><CardDescription>Áp dụng cho tài khoản bạn đang đăng nhập.</CardDescription></CardHeader><CardContent><MfaSettings /></CardContent></Card>
      <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base">Thông tin website</CardTitle><CardDescription>Dùng ở chân trang, trang Giới thiệu/Liên hệ/Điều khoản và SEO. Thay đổi bằng biến môi trường NEXT_PUBLIC_* trên Vercel rồi deploy lại.</CardDescription></CardHeader>
        <CardContent><dl className="divide-y text-sm">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{label}</dt><dd className="min-w-0 truncate text-right font-medium">{value}</dd></div>)}</dl></CardContent></Card>
    </div>
  </>;
}
