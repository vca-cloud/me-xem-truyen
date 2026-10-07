import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Coins, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4" />Về trang chủ</Link><SignOutButton /></div>
    <div><h1 className="text-2xl font-bold text-primary">Ví Xu của tôi</h1><p className="text-sm text-muted-foreground">{name}</p></div>

    <Card className="flex flex-wrap items-center justify-between gap-4 border-0 bg-gradient-to-r from-[#102D54] via-[#154B95] to-[#2D74A8] p-6 text-white shadow-sm">
      <div><p className="text-sm text-white/80">Số dư hiện tại</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold"><Coins className="size-7" aria-hidden="true" />{formatCoins(balance)}</p></div>
      <p className="text-sm text-white/90">1 Xu = {vnd.format(COIN_VND)}</p>
    </Card>

    <Card className="flex flex-wrap items-center justify-between gap-3 border-0 bg-card p-6 shadow-sm"><div><h2 className="font-semibold text-primary">Bạn viết truyện?</h2><p className="text-sm text-muted-foreground">Đăng truyện của bạn, tự khóa chương bằng Xu và nhận 70% doanh thu.</p></div><Link href="/tac-gia" className="rounded-lg bg-highlight px-4 py-2 text-sm font-medium text-highlight-foreground hover:bg-highlight/90">Khu vực tác giả</Link></Card>

    <Card className="border-0 bg-card p-6 shadow-sm">
      <h2 className="font-semibold text-primary">Nạp Xu</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">{topupPackages.map((item) => <div key={item.vnd} className="rounded-lg border p-4 text-center"><p className="text-lg font-bold">{vnd.format(item.vnd)}</p><p className="mt-1 text-sm text-muted-foreground">{formatCoins(item.coins)}</p>{item.bonus > 0 && <p className="mt-1 text-xs font-semibold text-highlight">+{formatCoins(item.bonus)} thưởng</p>}</div>)}</div>
      <p className="mt-4 rounded-md border border-highlight/40 bg-highlight/10 px-3 py-2 text-sm text-foreground">Nạp Xu tự động qua chuyển khoản ngân hàng và MoMo sắp ra mắt. Hiện tại vui lòng liên hệ quản trị viên để được hỗ trợ nạp Xu.</p>
    </Card>

    <Card className="border-0 bg-card p-6 shadow-sm">
      <h2 className="font-semibold text-primary">Chương đã mở khóa</h2>
      {(unlocks as unknown as Unlock[] | null)?.length ? <ul className="mt-3 divide-y text-sm">{(unlocks as unknown as Unlock[]).map((item) => item.chapters?.stories && <li key={`${item.chapters.stories.slug}-${item.chapters.chapter_number}`} className="flex items-center justify-between gap-3 py-2.5"><Link href={`/truyen/${item.chapters.stories.slug}/chuong/${item.chapters.chapter_number}`} className="min-w-0 truncate hover:underline">{item.chapters.stories.title} – Chương {item.chapters.chapter_number}: {item.chapters.title}</Link><span className="shrink-0 text-xs text-muted-foreground">{dateTime.format(new Date(item.created_at))}</span></li>)}</ul> : <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" aria-hidden="true" />Bạn chưa mở khóa chương nào.</p>}
    </Card>

    <Card className="border-0 bg-card p-6 shadow-sm">
      <h2 className="font-semibold text-primary">Lịch sử Xu</h2>
      {history?.length ? <Table className="mt-3 min-w-[520px]"><TableHeader><TableRow><TableHead>Thời gian</TableHead><TableHead>Nội dung</TableHead><TableHead className="text-right">Thay đổi</TableHead><TableHead className="text-right">Số dư</TableHead></TableRow></TableHeader><TableBody>{history.map((item) => <TableRow key={item.id}><TableCell className="text-muted-foreground">{dateTime.format(new Date(item.created_at))}</TableCell><TableCell className="max-w-72 truncate">{item.description || coinKindLabels[item.kind] || item.kind}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${item.amount > 0 ? "text-highlight" : "text-destructive"}`}>{item.amount > 0 ? "+" : ""}{item.amount.toLocaleString("vi-VN")}</TableCell><TableCell className="text-right tabular-nums text-muted-foreground">{item.balance_after.toLocaleString("vi-VN")}</TableCell></TableRow>)}</TableBody></Table> : <p className="mt-3 text-sm text-muted-foreground">Chưa có giao dịch nào.</p>}
    </Card>
  </div></main>;
}
