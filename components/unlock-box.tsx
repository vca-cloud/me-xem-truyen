"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCoins } from "@/lib/coins";

// Shown under the preview of a locked chapter. The server re-checks price and balance on every unlock.
export function UnlockBox({ chapterId, price, balance, loggedIn, returnPath }: { chapterId: string; price: number; balance: number | null; loggedIn: boolean; returnPath: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enough = balance !== null && balance >= price;

  async function unlock() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/coins/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapter_id: chapterId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setError(body.error ?? "Không thể mở khóa chương.");
      else router.refresh();
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return <div className="relative mt-2 rounded-xl border border-highlight/30 bg-gradient-to-b from-highlight/10 to-card p-6 text-center">
    <Lock className="mx-auto size-8 text-highlight" aria-hidden="true" />
    <p className="mt-3 text-lg font-semibold text-foreground">Chương này cần {formatCoins(price)} để đọc tiếp</p>
    <p className="mt-1 text-sm text-muted-foreground">Mở khóa một lần, đọc lại không mất thêm Xu.</p>
    {!loggedIn ? <div className="mt-5 flex flex-wrap justify-center gap-2">
      <Button className="bg-primary hover:bg-primary/90" nativeButton={false} render={<Link href={`/dang-nhap?next=${encodeURIComponent(returnPath)}`} />}>Đăng nhập để mở khóa</Button>
      <Button variant="outline" nativeButton={false} render={<Link href="/dang-ky" />}>Tạo tài khoản</Button>
    </div> : <>
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm text-muted-foreground ring-1 ring-highlight/30"><Coins className="size-4 text-highlight" aria-hidden="true" />Số dư: <strong>{formatCoins(balance ?? 0)}</strong></p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {enough
          ? <Button onClick={unlock} disabled={pending} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">{pending ? "Đang mở khóa..." : `Mở khóa – ${formatCoins(price)}`}</Button>
          : <Button className="bg-highlight text-highlight-foreground hover:bg-highlight/90" nativeButton={false} render={<Link href="/tai-khoan" />}>Nạp thêm Xu</Button>}
        <Button variant="outline" nativeButton={false} render={<Link href="/tai-khoan" />}>Ví Xu của tôi</Button>
      </div>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
  </div>;
}
