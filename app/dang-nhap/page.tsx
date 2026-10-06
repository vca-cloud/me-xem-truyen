import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12"><Card className="w-full max-w-md shadow-lg"><CardHeader className="space-y-5 p-6 sm:p-8"><Link href="/" className="flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" />Về trang chủ</Link><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BookOpen className="size-5" aria-hidden="true" /></span><div><CardTitle className="text-2xl">Đăng nhập</CardTitle><p className="mt-1 text-sm text-muted-foreground">Chào mừng bạn quay trở lại</p></div></div></CardHeader><CardContent className="space-y-5 p-6 pt-0 sm:p-8 sm:pt-0"><LoginForm /><p className="text-center text-sm text-muted-foreground">Chưa có tài khoản? <Link href="/dang-ky" className="font-medium text-primary hover:underline">Đăng ký ngay</Link></p></CardContent></Card></main>;
}
