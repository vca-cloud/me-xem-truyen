"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LibraryBig, Users, ShieldCheck, Tags, Settings, HandCoins, Menu, X, Bell, Search, ChevronRight, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/truyen", label: "Quản lý truyện", icon: LibraryBig },
  { href: "/admin/affiliate", label: "Affiliate", icon: HandCoins },
  { href: "/admin/thanh-vien", label: "Thành viên", icon: Users },
  { href: "/admin/quan-tri-vien", label: "Quản trị viên", icon: ShieldCheck },
  { href: "/admin/the-loai", label: "Thể loại", icon: Tags },
  { href: "/admin/cai-dat", label: "Cài đặt", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/admin/dang-nhap");
    router.refresh();
  }
  const current = navigation.find((item) => item.href === pathname) ?? navigation[0];
  return <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
    {open && <button aria-label="Đóng menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" />}
    <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r bg-white transition-transform lg:translate-x-0", open && "translate-x-0")}>
      <div className="flex h-16 items-center justify-between border-b px-6"><Link href="/" className="text-xl font-bold tracking-tight"><span className="text-cyan-600">Mê</span> Xem Truyện <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">Admin</span></Link><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng menu"><X /></Button></div>
      <nav className="flex-1 space-y-1 px-3 py-5">{navigation.map(({ href, label, icon: Icon }) => { const active = href === "/admin" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950", active && "bg-cyan-50 text-cyan-700") }><Icon className="size-[18px]" />{label}{active && <ChevronRight className="ml-auto size-4" />}</Link>})}</nav>
      <div className="border-t p-4"><Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"><ExternalLink className="size-4" />Xem trang chủ</Link><button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"><LogOut className="size-4" />Đăng xuất</button></div>
    </aside>
    <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur sm:px-6"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu /></Button><div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><span>Admin</span><ChevronRight className="size-4" /><span className="font-medium text-slate-900">{current.label}</span></div><div className="relative ml-auto hidden w-64 md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Tìm kiếm..." className="h-9 border-slate-200 bg-slate-50 pl-9" /></div><Button variant="ghost" size="icon" aria-label="Thông báo" className="relative"><Bell className="size-[18px]" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-orange-500" /></Button><div className="flex items-center gap-2 border-l pl-3"><div className="flex size-8 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">AD</div><div className="hidden text-sm sm:block"><p className="font-semibold">Admin</p><p className="text-xs text-slate-500">Quản trị viên</p></div></div></header><main className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</main></div>
  </div>;
}
