"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

// Friendly fallback when a page fails to load (e.g. the database is briefly unavailable).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-foreground">
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-primary">Có lỗi khi tải trang</h1>
      <p className="text-muted-foreground">Hệ thống đang bận hoặc tạm gián đoạn. Bạn thử tải lại sau ít phút nhé.</p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"><RefreshCw className="size-4" aria-hidden="true" />Thử lại</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-card">Về trang chủ</Link>
      </div>
    </div>
  </main>;
}
