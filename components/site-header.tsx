"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Moon, Search, SlidersHorizontal, Sun } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type HeaderGenre = { name: string; slug: string };

// Site header for reader pages: logo, genre menu (from the admin genre catalog), search, account and theme.
export function SiteHeader({ genres, initialQuery = "" }: { genres: HeaderGenre[]; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [dark, setDark] = useState(false);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/tim-kiem?q=${encodeURIComponent(q)}` : "/tim-kiem");
  }

  function toggleTheme() {
    setDark((current) => {
      document.documentElement.classList.toggle("dark", !current);
      return !current;
    });
  }

  return <header className="sticky top-0 z-50 border-b border-white/15 bg-[#08729c] text-white shadow-md">
    <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
      <Link href="/" className="shrink-0 text-lg font-bold tracking-tight sm:text-xl"><span className="text-cyan-200">Mê</span> Xem Truyện</Link>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="shrink-0 border-white/35 bg-white/5 text-white hover:bg-white/15 hover:text-white" aria-label="Thể loại" />}>
          <Menu /><span className="hidden sm:inline">Thể loại</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(36rem,calc(100vw-2rem))]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Thể loại</DropdownMenuLabel>
            {genres.length
              ? <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">{genres.map((genre) => <DropdownMenuItem key={genre.slug} render={<Link href={`/tim-kiem?the_loai=${genre.slug}`} />}><span className="truncate">{genre.name}</span></DropdownMenuItem>)}</div>
              : <p className="px-2 py-1.5 text-sm text-muted-foreground">Chưa có thể loại nào.</p>}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/tim-kiem" />}><SlidersHorizontal />Tìm nâng cao (nhiều thể loại)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form onSubmit={search} role="search" className="relative min-w-0 max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên truyện, tác giả, thể loại..." aria-label="Tìm truyện" className="h-9 border-white/30 bg-white/10 pl-9 text-white placeholder:text-white/60" />
      </form>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <AccountMenu />
        <Button variant="outline" size="icon" aria-label="Đổi giao diện sáng tối" onClick={toggleTheme} className="hidden border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex">{dark ? <Sun /> : <Moon />}</Button>
      </div>
    </div>
  </header>;
}
