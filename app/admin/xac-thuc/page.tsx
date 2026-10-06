import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaChallenge } from "@/components/mfa-challenge";

export default function AdminMfaPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle>Xác thực 2 lớp</CardTitle><p className="text-sm text-muted-foreground">Nhập mã 6 số trong ứng dụng xác thực trên điện thoại của bạn.</p></CardHeader><CardContent><MfaChallenge /></CardContent></Card></main>;
}
