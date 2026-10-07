"use client";

import { COVER_ASPECT_CLASS } from "@/lib/cover";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AdSenseScript, AdSlot } from "@/components/ads";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, type HeaderGenre } from "@/components/site-header";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type HomeStory = { slug: string; title: string; author: string; status: "Đang ra" | "Hoàn thành" | "Tạm dừng"; genres: string[]; chapter_count: number; cover_url: string | null; created_at: string; updated_at: string };

const coverColors = ["from-[#102D54] via-[#154B95] to-[#2D74A8]", "from-[#102D54] to-[#2D74A8]", "from-[#154B95] via-[#2D74A8] to-[#D4EEED]", "from-[#102D54] via-[#102D54] to-[#154B95]", "from-[#2D74A8] via-[#154B95] to-[#102D54]", "from-[#102D54] via-[#154B95] to-[#EE4D2D]"];
const NEW_DAYS = 7;

function coverColor(slug: string) {
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return coverColors[hash % coverColors.length];
}

export function GenreBadges({ genres, className }: { genres: string[]; className?: string }) {
  return (
    // One line only: extra genres are clipped with a soft fade instead of wrapping.
    <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent)]" title={genres.join(", ")}>
      {genres.map((name) => (
        <Badge key={name} variant="outline" className={cn("max-w-[10rem] shrink-0 truncate text-muted-foreground", className)}>{name}</Badge>
      ))}
    </div>
  );
}

function Cover({ story, badge }: { story: HomeStory; badge?: "NEW" | "FULL" }) {
  return (
    <div className={`relative ${COVER_ASPECT_CLASS} overflow-hidden rounded-md bg-gradient-to-br ${coverColor(story.slug)} shadow-sm`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- covers come from arbitrary admin-provided hosts */}
      {story.cover_url ? <img src={story.cover_url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : <><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,.15),transparent_35%)]" /><span className="absolute inset-x-3 bottom-3 line-clamp-2 text-base font-semibold text-white drop-shadow-md sm:text-lg">{story.title}</span></>}
      {badge && <span className={`absolute left-2.5 top-2.5 rounded px-2 py-0.5 text-[15px] font-bold text-white ${badge === "NEW" ? "bg-highlight" : "bg-[#154B95]"}`}>{badge}</span>}
    </div>
  );
}

// Story status ("Tình trạng"): ongoing in orange, completed in brand blue, paused muted.
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn("max-w-full truncate", status === "Đang ra" ? "border-highlight/50 text-highlight" : status === "Hoàn thành" ? "border-transparent bg-primary text-primary-foreground" : "text-muted-foreground")}>{status}</Badge>;
}

// Cover tile for the "Truyện mới đăng" / "Truyện hoàn thành" grids; text is 1.5× the base list size.
function StoryTile({ story, badge }: { story: HomeStory; badge?: "NEW" | "FULL" }) {
  return <Link href={`/truyen/${story.slug}`} className="group min-w-0">
    <Cover story={story} badge={badge} />
    <h3 className="mt-2.5 min-w-0 truncate text-xl font-semibold group-hover:text-highlight sm:text-2xl">{story.title}</h3>
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-base text-muted-foreground sm:text-[21px]"><GenreBadges genres={story.genres} className="h-6 px-2.5 text-sm sm:h-7 sm:text-[15px]" /><span className="shrink-0">· {story.chapter_count} chương</span></div>
  </Link>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{children}</h2>;
}

export function HomePage({ stories, catalog, loadError }: { stories: HomeStory[]; catalog: HeaderGenre[]; loadError: string | null }) {
  const [genre, setGenre] = useState("Tất cả");
  const [page, setPage] = useState(1);
  const genres = useMemo(() => ["Tất cả", ...catalog.map((item) => item.name)], [catalog]);
  const newest = useMemo(() => [...stories].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4), [stories]);
  const updated = stories.slice(0, 8);
  const completed = useMemo(() => stories.filter((story) => story.status === "Hoàn thành").slice(0, 4), [stories]);
  const [now] = useState(() => Date.now());
  const isNew = (story: HomeStory) => now - new Date(story.created_at).getTime() < NEW_DAYS * 86_400_000;
  const filtered = useMemo(() => genre === "Tất cả" ? stories : stories.filter((story) => story.genres.includes(genre)), [stories, genre]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const pageStories = filtered.slice((page - 1) * 10, page * 10);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader genres={catalog} />

      <main className="mx-auto max-w-[1600px] space-y-9 px-4 py-8 sm:px-6 lg:px-8">
        <AdSenseScript />
        <AdSlot placement="home-top" />
        {loadError && <p role="alert" className="rounded-md border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-foreground">Không tải được danh sách truyện. Vui lòng thử lại sau.</p>}
        {!loadError && stories.length === 0 && <p className="rounded-md border border-dashed px-4 py-12 text-center text-muted-foreground">Chưa có truyện nào được đăng.</p>}

        {newest.length > 0 && <section><SectionTitle>Truyện mới đăng</SectionTitle><div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:gap-x-5">{newest.map((story) => <StoryTile key={story.slug} story={story} badge={isNew(story) ? "NEW" : story.status === "Hoàn thành" ? "FULL" : undefined} />)}</div></section>}

        {updated.length > 0 && <section><SectionTitle>Mới cập nhật</SectionTitle><Card className="overflow-hidden border-border/70"><div className="grid grid-cols-[minmax(0,1fr)_6.5rem_4rem] border-b bg-muted/50 px-4 py-3 text-xs font-bold sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_8rem_6rem] sm:px-5"><span>Tên truyện</span><span className="hidden truncate sm:block">Thể loại</span><span>Tình trạng</span><span className="text-right">Số chương</span></div>{updated.map((story) => <div key={story.slug} className="grid grid-cols-[minmax(0,1fr)_6.5rem_4rem] items-center border-b px-4 py-3 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_8rem_6rem] sm:px-5"><Link href={`/truyen/${story.slug}`} className="min-w-0 truncate pr-3 font-medium hover:text-highlight">{story.title}</Link><div className="hidden min-w-0 pr-3 sm:block"><GenreBadges genres={story.genres} /></div><div className="min-w-0 pr-2"><StatusBadge status={story.status} /></div><span className="truncate text-right font-semibold tabular-nums text-primary">{story.chapter_count}</span></div>)}</Card></section>}

        {stories.length > 0 && <AdSlot placement="home-feed" />}

        {completed.length > 0 && <section><SectionTitle>Truyện hoàn thành</SectionTitle><div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:gap-x-5">{completed.map((story) => <StoryTile key={story.slug} story={story} badge="FULL" />)}</div></section>}

        {stories.length > 0 && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><SectionTitle>Danh sách truyện</SectionTitle><div className="flex items-center gap-2"><ListFilter className="size-4 text-muted-foreground" /><Select items={genres.map((item) => ({ value: item, label: item }))} value={genre} onValueChange={(value) => { setGenre(String(value)); setPage(1); }}><SelectTrigger className="w-48" aria-label="Lọc theo thể loại"><SelectValue /></SelectTrigger><SelectContent>{genres.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div><Card className="overflow-hidden border-border/70"><div className="grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_4rem] border-b bg-muted/50 px-3 py-3 text-xs font-bold sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,16rem)_8rem_6rem] sm:px-5"><span>#</span><span>Tên truyện</span><span className="hidden truncate sm:block">Thể loại</span><span>Tình trạng</span><span className="text-right">Chương</span></div>{pageStories.map((story, index) => <div key={story.slug} className="grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_4rem] items-center border-b px-3 py-3 text-sm last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,16rem)_8rem_6rem] sm:px-5"><span className="text-muted-foreground">{(page - 1) * 10 + index + 1}</span><Link href={`/truyen/${story.slug}`} className="min-w-0 truncate pr-3 font-medium hover:text-highlight">{story.title}</Link><div className="hidden min-w-0 pr-3 sm:block"><GenreBadges genres={story.genres} /></div><div className="min-w-0 pr-2"><StatusBadge status={story.status} /></div><span className="truncate text-right font-semibold tabular-nums text-primary">{story.chapter_count}</span></div>)}{pageStories.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Không tìm thấy truyện phù hợp.</p>}</Card>{pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-1"><Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <Button key={number} variant={page === number ? "default" : "outline"} className={page === number ? "bg-highlight text-highlight-foreground hover:bg-highlight/90" : undefined} size="icon-sm" aria-label={`Trang ${number}`} onClick={() => setPage(number)}>{number}</Button>)}<Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button></div>}</section>}
      </main>
      <SiteFooter />
    </div>
  );
}
