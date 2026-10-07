import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-foreground">
    <div className="max-w-md space-y-4">
      <BookOpen className="mx-auto size-10 text-primary" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-primary">Không tìm thấy trang</h1>
      <p className="text-muted-foreground">Truyện hoặc chương này không tồn tại, hoặc đã bị gỡ.</p>
      <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Về trang chủ</Link>
    </div>
  </main>;
}
