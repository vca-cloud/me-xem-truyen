"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

// Friendly fallback when a page fails to load (e.g. the database is briefly unavailable).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#eaf5f7] px-4 text-center text-[#123047]">
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-[#08729c]">Có lỗi khi tải trang</h1>
      <p className="text-slate-600">Hệ thống đang bận hoặc tạm gián đoạn. Bạn thử tải lại sau ít phút nhé.</p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#08729c] px-4 text-sm font-medium text-white hover:bg-[#075f82]"><RefreshCw className="size-4" aria-hidden="true" />Thử lại</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-white">Về trang chủ</Link>
      </div>
    </div>
  </main>;
}
