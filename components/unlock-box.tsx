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

  return <div className="relative mt-2 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 text-center">
    <Lock className="mx-auto size-8 text-amber-500" aria-hidden="true" />
    <p className="mt-3 text-lg font-semibold text-[#123047]">Chương này cần {formatCoins(price)} để đọc tiếp</p>
    <p className="mt-1 text-sm text-slate-500">Mở khóa một lần, đọc lại không mất thêm Xu.</p>
    {!loggedIn ? <div className="mt-5 flex flex-wrap justify-center gap-2">
      <Link href={`/dang-nhap?next=${encodeURIComponent(returnPath)}`}><Button className="bg-[#08729c] hover:bg-[#075f82]">Đăng nhập để mở khóa</Button></Link>
      <Link href="/dang-ky"><Button variant="outline">Tạo tài khoản</Button></Link>
    </div> : <>
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm text-slate-600 ring-1 ring-amber-200"><Coins className="size-4 text-amber-500" aria-hidden="true" />Số dư: <strong>{formatCoins(balance ?? 0)}</strong></p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {enough
          ? <Button onClick={unlock} disabled={pending} className="bg-orange-500 hover:bg-orange-600">{pending ? "Đang mở khóa..." : `Mở khóa – ${formatCoins(price)}`}</Button>
          : <Link href="/tai-khoan"><Button className="bg-orange-500 hover:bg-orange-600">Nạp thêm Xu</Button></Link>}
        <Link href="/tai-khoan"><Button variant="outline">Ví Xu của tôi</Button></Link>
      </div>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
  </div>;
}
