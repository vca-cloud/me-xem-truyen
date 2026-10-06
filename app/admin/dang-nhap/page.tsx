import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth-forms";

export default function AdminLoginPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle>Đăng nhập quản trị</CardTitle><p className="text-sm text-muted-foreground">Chỉ tài khoản có quyền quản trị mới được truy cập.</p></CardHeader><CardContent className="space-y-4"><LoginForm admin /><Link href="/dang-nhap" className="block text-center text-sm text-muted-foreground hover:underline">Đăng nhập tài khoản thành viên</Link></CardContent></Card></main>;
}
