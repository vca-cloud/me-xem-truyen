"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { AdSenseScript, AdSlot } from "@/components/ads";
import { SiteFooter } from "@/components/site-footer";
import {
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type HomeStory = { slug: string; title: string; author: string; status: "Đang ra" | "Hoàn thành" | "Tạm dừng"; genres: string[]; chapter_count: number; cover_url: string | null; created_at: string; updated_at: string };

const coverColors = ["from-slate-950 via-cyan-950 to-sky-700", "from-slate-950 via-sky-900 to-cyan-700", "from-slate-950 via-indigo-950 to-slate-800", "from-blue-950 via-sky-600 to-cyan-400", "from-zinc-950 via-cyan-950 to-blue-900", "from-stone-950 via-amber-950 to-slate-800"];
const NEW_DAYS = 7;

function coverColor(slug: string) {
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return coverColors[hash % coverColors.length];
}

function GenreBadges({ genres }: { genres: string[] }) {
  return (
    <div className="flex min-w-0 max-w-full shrink-0 flex-wrap gap-1 overflow-hidden">
      {genres.map((name) => (
        <span key={name} className="max-w-full truncate rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">{name}</span>
      ))}
    </div>
  );
}

function Cover({ story, badge }: { story: HomeStory; badge?: "NEW" | "FULL" }) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden rounded-md bg-gradient-to-br ${coverColor(story.slug)} shadow-sm`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- covers come from arbitrary admin-provided hosts */}
      {story.cover_url ? <img src={story.cover_url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : <><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,.15),transparent_35%)]" /><span className="absolute inset-x-2 bottom-2 text-xs font-semibold text-white drop-shadow-md">{story.title}</span></>}
      {badge && <span className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${badge === "NEW" ? "bg-emerald-500" : "bg-sky-600"}`}>{badge}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground sm:text-xl">{children}</h2>;
}

export function HomePage({ stories, loadError }: { stories: HomeStory[]; loadError: string | null }) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Tất cả");
  const [page, setPage] = useState(1);
  const [dark, setDark] = useState(false);
  const genres = useMemo(() => ["Tất cả", ...[...new Set(stories.flatMap((story) => story.genres))].sort((a, b) => a.localeCompare(b, "vi"))], [stories]);
  const newest = useMemo(() => [...stories].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4), [stories]);
  const updated = stories.slice(0, 8);
  const completed = useMemo(() => stories.filter((story) => story.status === "Hoàn thành").slice(0, 4), [stories]);
  const [now] = useState(() => Date.now());
  const isNew = (story: HomeStory) => now - new Date(story.created_at).getTime() < NEW_DAYS * 86_400_000;
  const filtered = useMemo(() => stories.filter((story) => (genre === "Tất cả" || story.genres.includes(genre)) && `${story.title} ${story.author}`.toLowerCase().includes(query.toLowerCase())), [stories, genre, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const pageStories = filtered.slice((page - 1) * 10, page * 10);

  function toggleTheme() {
    setDark((current) => {
      const next = !current;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/15 bg-[#08729c] text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0 text-lg font-bold tracking-tight sm:text-xl"><span className="text-cyan-200">Mê</span> Xem Truyện</Link>
          <Button variant="outline" size="sm" className="hidden border-white/35 bg-white/5 text-white hover:bg-white/15 hover:text-white sm:inline-flex"><Menu className="mr-2 size-4" />Thể loại</Button>
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm kiếm tên truyện, tác giả..." className="h-9 border-white/30 bg-white/10 pl-9 text-white placeholder:text-white/60 focus-visible:ring-white/50" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <AccountMenu />
            <Button variant="outline" size="icon" aria-label="Đổi giao diện sáng tối" onClick={toggleTheme} className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-9 px-4 py-8 sm:px-6 lg:px-8">
        <AdSenseScript />
        <AdSlot placement="home-top" />
        {loadError && <p role="alert" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">Không tải được danh sách truyện. Vui lòng thử lại sau.</p>}
        {!loadError && stories.length === 0 && <p className="rounded-md border border-dashed px-4 py-12 text-center text-muted-foreground">Chưa có truyện nào được đăng.</p>}

        {newest.length > 0 && <section><SectionTitle>TRUYỆN MỚI ĐĂNG</SectionTitle><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-5">{newest.map((story) => <Link href={`/truyen/${story.slug}`} key={story.slug} className="group min-w-0"><Cover story={story} badge={isNew(story) ? "NEW" : story.status === "Hoàn thành" ? "FULL" : undefined} /><h3 className="mt-2 min-w-0 truncate font-semibold group-hover:text-primary">{story.title}</h3><div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground"><GenreBadges genres={story.genres} /><span className="shrink-0">· {story.chapter_count} chương</span></div></Link>)}</div></section>}

        {updated.length > 0 && <section><SectionTitle>MỚI CẬP NHẬT</SectionTitle><Card className="overflow-hidden border-border/70"><div className="grid grid-cols-[minmax(0,1fr)_110px_72px] border-b bg-muted/50 px-4 py-3 text-xs font-semibold sm:grid-cols-[minmax(0,1fr)_220px_120px] sm:px-5"><span>Tên truyện</span><span>Thể loại</span><span className="text-right sm:text-left">Số chương</span></div>{updated.map((story) => <div key={story.slug} className="grid grid-cols-[minmax(0,1fr)_110px_72px] items-center border-b px-4 py-3 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_220px_120px] sm:px-5"><Link href={`/truyen/${story.slug}`} className="min-w-0 truncate pr-3 font-medium hover:text-primary">{story.title}</Link><div className="min-w-0 pl-2"><GenreBadges genres={story.genres} /></div><span className="truncate text-right font-semibold text-primary sm:text-left">{story.chapter_count}</span></div>)}</Card></section>}

        {stories.length > 0 && <AdSlot placement="home-feed" />}

        {completed.length > 0 && <section><SectionTitle>TRUYỆN HOÀN THÀNH</SectionTitle><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-5">{completed.map((story) => <Link href={`/truyen/${story.slug}`} key={story.slug} className="group min-w-0"><Cover story={story} badge="FULL" /><h3 className="mt-2 min-w-0 truncate font-semibold group-hover:text-primary">{story.title}</h3><div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground"><GenreBadges genres={story.genres} /><span className="shrink-0">· {story.chapter_count} chương</span></div></Link>)}</div></section>}

        {stories.length > 0 && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><SectionTitle>DANH SÁCH TRUYỆN</SectionTitle><div className="flex items-center gap-2"><ListFilter className="size-4 text-muted-foreground" /><select aria-label="Lọc theo thể loại" value={genre} onChange={(event) => { setGenre(event.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{genres.map((item) => <option key={item}>{item}</option>)}</select></div></div><Card className="overflow-hidden border-border/70"><div className="grid grid-cols-[32px_minmax(0,1fr)_110px_64px] border-b bg-muted/50 px-3 py-3 text-xs font-semibold sm:grid-cols-[48px_minmax(0,1fr)_220px_120px] sm:px-5"><span>#</span><span>Tên truyện</span><span>Thể loại</span><span className="text-right sm:text-left">Chương</span></div>{pageStories.map((story, index) => <div key={story.slug} className="grid grid-cols-[32px_minmax(0,1fr)_110px_64px] items-center border-b px-3 py-3 text-sm last:border-0 sm:grid-cols-[48px_minmax(0,1fr)_220px_120px] sm:px-5"><span className="text-muted-foreground">{(page - 1) * 10 + index + 1}</span><Link href={`/truyen/${story.slug}`} className="min-w-0 truncate pr-3 font-medium hover:text-primary">{story.title}</Link><div className="min-w-0 pl-2"><GenreBadges genres={story.genres} /></div><span className="truncate text-right font-semibold text-primary sm:text-left">{story.chapter_count}</span></div>)}{pageStories.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Không tìm thấy truyện phù hợp.</p>}</Card>{pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-1"><Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <Button key={number} variant={page === number ? "default" : "outline"} size="icon-sm" aria-label={`Trang ${number}`} onClick={() => setPage(number)}>{number}</Button>)}<Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button></div>}</section>}
      </main>
      <SiteFooter />
    </div>
  );
}
