import type { Metadata } from "next";
import { COVER_ASPECT_CLASS, coverImageProps } from "@/lib/cover";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Bookmark, ChevronLeft, ChevronRight, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdSenseScript, AdSlot } from "@/components/ads";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ViewTracker } from "@/components/view-tracker";
import { defaultAudioSiteUrl, validTextUrl } from "@/lib/story-data";
import { chapterPrice, formatCoins } from "@/lib/coins";
import { getGenreCatalog, getReaderStory, getViewStats } from "@/lib/stories";
import { formatViews } from "@/lib/views";
import { StoryTag } from "@/components/home-page";

const CHAPTERS_PER_COLUMN = 10;
const CHAPTERS_PER_PAGE = CHAPTERS_PER_COLUMN * 2;
const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export async function generateMetadata({ params }: PageProps<"/truyen/[slug]">): Promise<Metadata> {
  const story = await getReaderStory((await params).slug);
  if (!story) return { title: "Không tìm thấy truyện" };
  const description = (story.description || `Đọc truyện ${story.title} của tác giả ${story.author}.`).replace(/\s+/g, " ").slice(0, 160);
  const cover = story.cover_url && validTextUrl(story.cover_url) ? [story.cover_url] : undefined;
  return {
    title: `${story.title} – ${story.author}`,
    description,
    alternates: { canonical: `/truyen/${story.slug}` },
    openGraph: { type: "book", title: story.title, description, url: `/truyen/${story.slug}`, images: cover },
  };
}

export default async function StoryPage({ params, searchParams }: PageProps<"/truyen/[slug]">) {
  const { slug } = await params;
  const story = await getReaderStory(slug);
  if (!story) notFound();
  const viewStats = await getViewStats();
  const views = viewStats.stats.get(story.id)?.total_views ?? 0;
  const hot = viewStats.hot.has(story.id);
  const query = await searchParams;
  const newestFirst = query.thu_tu === "moi";
  const ordered = newestFirst ? [...story.chapters].reverse() : story.chapters;
  // 20 chapters per page: two columns of at most 10.
  const pageCount = Math.max(1, Math.ceil(ordered.length / CHAPTERS_PER_PAGE));
  const page = Math.min(Math.max(Number(query.trang) || 1, 1), pageCount);
  const chapters = ordered.slice((page - 1) * CHAPTERS_PER_PAGE, page * CHAPTERS_PER_PAGE);
  const columns = [chapters.slice(0, CHAPTERS_PER_COLUMN), chapters.slice(CHAPTERS_PER_COLUMN)].filter((column) => column.length);
  const pageHref = (target: number) => `/truyen/${story.slug}?${new URLSearchParams({ ...(newestFirst ? { thu_tu: "moi" } : {}), ...(target > 1 ? { trang: String(target) } : {}) }).toString()}`.replace(/\?$/, "");
  const first = story.chapters[0];
  const latest = story.chapters.at(-1);
  const audioUrl = story.audio_url && validTextUrl(story.audio_url) ? story.audio_url : `${defaultAudioSiteUrl}/truyen/${story.slug}`;
  const coverUrl = story.cover_url && validTextUrl(story.cover_url) ? story.cover_url : null;

  return <div className="min-h-screen bg-background text-foreground"><ViewTracker storySlug={story.slug} />{!story.ads_disabled && <AdSenseScript />}
    <SiteHeader genres={await getGenreCatalog()} />
    <main className="mx-auto max-w-[1300px] space-y-10 px-4 py-7 sm:px-6 lg:px-8"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-primary"><Link href="/" className="hover:underline">Trang chủ</Link><span aria-hidden="true">›</span><span className="min-w-0 truncate text-foreground">{story.title}</span></nav>
      <section className="grid gap-8 lg:grid-cols-[290px_1fr]">
        <div className={`relative ${COVER_ASPECT_CLASS} w-full max-w-[290px] overflow-hidden rounded-xl bg-gradient-to-br from-[#102D54] via-[#154B95] to-[#2D74A8] shadow-md`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- covers come from arbitrary admin-provided hosts */}
          {coverUrl ? <img {...coverImageProps(coverUrl, "290px")} alt={`Ảnh bìa ${story.title}`} className="size-full object-cover" fetchPriority="high" /> : <span className="absolute inset-x-4 bottom-4 text-lg font-semibold text-white drop-shadow-md">{story.title}</span>}
        </div>
        <div className="min-w-0 space-y-5">
          {hot && <div className="mb-2"><StoryTag tag="HOT" /></div>}<h1 className="line-clamp-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl" title={story.title}>{story.title}</h1>
          <div className="grid min-w-0 gap-x-10 gap-y-3 text-base leading-7 sm:grid-cols-2 [&>div]:min-w-0">
            <div><p className="truncate"><span className="text-primary">Tác giả:</span> {story.author}</p><p className="truncate" title={story.genres.join(", ")}><span className="text-primary">Thể loại:</span> {story.genres.join(", ") || "Chưa phân loại"}</p></div>
            <div><p><span className="text-primary">Trạng thái:</span> <strong className="rounded bg-highlight px-2 py-1 text-sm text-highlight-foreground">{story.status}</strong></p><p><span className="text-primary">Lượt xem:</span> <strong title={`${views.toLocaleString("vi-VN")} lượt xem`}>{formatViews(views)}</strong></p><p><span className="text-primary">Tổng chương:</span> <strong>{story.chapters.length.toLocaleString("vi-VN")} chương</strong></p><p><span className="text-primary">Cập nhật:</span> {dateFormat.format(new Date(story.updated_at))}</p>{story.lock_from_chapter !== null && <p><span className="text-primary">Chương trả phí:</span> {story.lock_from_chapter > 1 ? `từ chương ${story.lock_from_chapter}` : "tất cả"}, {formatCoins(story.lock_price_coins)}/chương</p>}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            {first && <Button className="bg-primary hover:bg-primary/90" nativeButton={false} render={<Link href={`/truyen/${story.slug}/chuong/${first.chapter_number}`} />}><BookOpen className="mr-2 size-4" />Đọc từ đầu</Button>}
            {latest && latest !== first && <Button className="bg-highlight text-highlight-foreground hover:bg-highlight/90" nativeButton={false} render={<Link href={`/truyen/${story.slug}/chuong/${latest.chapter_number}`} />}>Đọc mới nhất</Button>}
            <Button variant="outline" nativeButton={false} render={<a href={audioUrl} target="_blank" rel="noreferrer" />}><ExternalLink className="mr-2 size-4" />Mê Nghe Truyện</Button>
            <Button variant="outline" disabled title="Sắp có"><Bookmark className="mr-2 size-4" />Thêm vào tủ sách</Button>
          </div>
        </div>
      </section>
      {story.description && <Card className="border-0 bg-card p-7 text-base leading-8 text-primary shadow-sm sm:p-8">{story.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="mb-6 whitespace-pre-line last:mb-0">{paragraph}</p>)}</Card>}
      <AdSlot placement="story-detail" disabled={story.ads_disabled} />
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">Danh sách chương <span className="font-normal">({story.chapters.length})</span></h2>
          <div className="flex gap-2">
            <Button variant={newestFirst ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href={`/truyen/${story.slug}?thu_tu=moi`} scroll={false} />}>Mới → Cũ</Button>
            <Button variant={newestFirst ? "outline" : "default"} size="sm" nativeButton={false} render={<Link href={`/truyen/${story.slug}`} scroll={false} />}>Cũ → Mới</Button>
          </div>
        </div>
        <Card className="overflow-hidden border-0 bg-card py-0 shadow-sm">{chapters.length
          ? <div className="grid sm:grid-cols-2 sm:divide-x">{columns.map((column, columnIndex) => <ul key={columnIndex} className="min-w-0 divide-y">{column.map((chapter) => <li key={chapter.id} className="min-w-0">
              <Link href={`/truyen/${story.slug}/chuong/${chapter.chapter_number}`} className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                <span className="min-w-0 truncate" title={`Chương ${chapter.chapter_number}: ${chapter.title}`}>Chương {chapter.chapter_number}: {chapter.title}</span>
                {chapterPrice(story, chapter.chapter_number) > 0 ? <span className="flex shrink-0 items-center gap-1 text-xs text-highlight"><Lock className="size-3" aria-hidden="true" />{formatCoins(story.lock_price_coins)}</span> : <span className="shrink-0 text-xs text-primary">Miễn phí</span>}
              </Link>
            </li>)}</ul>)}</div>
          : <p className="px-4 py-8 text-center text-sm text-muted-foreground">Truyện chưa có chương nào.</p>}</Card>
        {pageCount > 1 && <nav aria-label="Trang danh sách chương" className="mt-4 flex flex-wrap items-center justify-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={page === 1} nativeButton={false} render={<Link href={pageHref(page - 1)} scroll={false} aria-disabled={page === 1} />}><ChevronLeft /></Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 2).map((number, index, list) => <span key={number} className="flex items-center gap-1">
            {index > 0 && number - list[index - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
            <Button variant={number === page ? "default" : "outline"} size="sm" className="min-w-8" aria-label={`Trang ${number}`} aria-current={number === page ? "page" : undefined} nativeButton={false} render={<Link href={pageHref(number)} scroll={false} />}>{number}</Button>
          </span>)}
          <Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={page === pageCount} nativeButton={false} render={<Link href={pageHref(page + 1)} scroll={false} aria-disabled={page === pageCount} />}><ChevronRight /></Button>
        </nav>}
      </section>
    </main>
    <SiteFooter />
  </div>;
}
