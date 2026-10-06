import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-[#eaf5f7] px-4 text-center text-[#123047]">
    <div className="max-w-md space-y-4">
      <BookOpen className="mx-auto size-10 text-[#08729c]" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-[#08729c]">Không tìm thấy trang</h1>
      <p className="text-slate-600">Truyện hoặc chương này không tồn tại, hoặc đã bị gỡ.</p>
      <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-[#08729c] px-4 text-sm font-medium text-white hover:bg-[#075f82]">Về trang chủ</Link>
    </div>
  </main>;
}
