import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Coins, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { COIN_VND, coinKindLabels, formatCoins, topupPackages } from "@/lib/coins";
import { createClient } from "@/lib/supabase/server";

const dateTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

type Unlock = { created_at: string; coins_spent: number; chapters: { chapter_number: number; title: string; stories: { slug: string; title: string } | null } | null };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/dang-nhap?next=/tai-khoan");

  const [{ data: wallet }, { data: history }, { data: unlocks }] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("coin_transactions").select("id, amount, balance_after, kind, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("chapter_unlocks").select("created_at, coins_spent, chapters(chapter_number, title, stories(slug, title))").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const balance = wallet?.balance ?? 0;
  const name = (user.user_metadata?.display_name as string | undefined) || user.email;

  return <main className="min-h-screen bg-[#eaf5f7] px-4 py-8 text-[#123047]"><div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2 text-sm text-[#08729c] hover:underline"><ArrowLeft className="size-4" />Về trang chủ</Link><SignOutButton /></div>
    <div><h1 className="text-2xl font-bold text-[#08729c]">Ví Xu của tôi</h1><p className="text-sm text-slate-500">{name}</p></div>

    <Card className="flex flex-wrap items-center justify-between gap-4 border-0 bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white shadow-sm">
      <div><p className="text-sm text-white/80">Số dư hiện tại</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold"><Coins className="size-7" aria-hidden="true" />{formatCoins(balance)}</p></div>
      <p className="text-sm text-white/90">1 Xu = {vnd.format(COIN_VND)}</p>
    </Card>

    <Card className="border-0 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-[#08729c]">Nạp Xu</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">{topupPackages.map((item) => <div key={item.vnd} className="rounded-lg border p-4 text-center"><p className="text-lg font-bold">{vnd.format(item.vnd)}</p><p className="mt-1 text-sm text-slate-600">{formatCoins(item.coins)}</p>{item.bonus > 0 && <p className="mt-1 text-xs font-semibold text-emerald-600">+{formatCoins(item.bonus)} thưởng</p>}</div>)}</div>
      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nạp Xu tự động qua chuyển khoản ngân hàng và MoMo sắp ra mắt. Hiện tại vui lòng liên hệ quản trị viên để được hỗ trợ nạp Xu.</p>
    </Card>

    <Card className="border-0 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-[#08729c]">Chương đã mở khóa</h2>
      {(unlocks as unknown as Unlock[] | null)?.length ? <ul className="mt-3 divide-y text-sm">{(unlocks as unknown as Unlock[]).map((item) => item.chapters?.stories && <li key={`${item.chapters.stories.slug}-${item.chapters.chapter_number}`} className="flex items-center justify-between gap-3 py-2.5"><Link href={`/truyen/${item.chapters.stories.slug}/chuong/${item.chapters.chapter_number}`} className="min-w-0 truncate hover:underline">{item.chapters.stories.title} – Chương {item.chapters.chapter_number}: {item.chapters.title}</Link><span className="shrink-0 text-xs text-slate-500">{dateTime.format(new Date(item.created_at))}</span></li>)}</ul> : <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Lock className="size-4" aria-hidden="true" />Bạn chưa mở khóa chương nào.</p>}
    </Card>

    <Card className="border-0 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-[#08729c]">Lịch sử Xu</h2>
      {history?.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Thời gian</th><th className="py-2">Nội dung</th><th className="py-2 text-right">Thay đổi</th><th className="py-2 text-right">Số dư</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-t"><td className="whitespace-nowrap py-2.5 pr-3 text-slate-500">{dateTime.format(new Date(item.created_at))}</td><td className="max-w-72 truncate py-2.5 pr-3">{item.description || coinKindLabels[item.kind] || item.kind}</td><td className={`py-2.5 text-right font-semibold tabular-nums ${item.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>{item.amount > 0 ? "+" : ""}{item.amount.toLocaleString("vi-VN")}</td><td className="py-2.5 text-right tabular-nums text-slate-500">{item.balance_after.toLocaleString("vi-VN")}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">Chưa có giao dịch nào.</p>}
    </Card>
  </div></main>;
}
