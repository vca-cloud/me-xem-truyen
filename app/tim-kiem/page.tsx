import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GenreBadges } from "@/components/home-page";
import { SearchFilters } from "@/components/search-filters";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { maskForReaders } from "@/lib/moderation";
import { searchHref, searchStories, sortOptions, type SearchSort, type SearchState } from "@/lib/search";
import { getGenreCatalog, listStories } from "@/lib/stories";

const PAGE_SIZE = 20;
const statuses = ["Đang ra", "Hoàn thành", "Tạm dừng"];

export const metadata: Metadata = { title: "Tìm truyện", robots: { index: false, follow: true } };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function SearchPage({ searchParams }: PageProps<"/tim-kiem">) {
  const params = await searchParams;
  const [catalog, rows] = await Promise.all([getGenreCatalog(), listStories().catch(() => null)]);
  const slugs = new Set(catalog.map((genre) => genre.slug));
  const sort = one(params.sap_xep) as SearchSort;
  const state: SearchState = {
    q: one(params.q).slice(0, 100),
    genres: one(params.the_loai).split(",").filter((slug) => slugs.has(slug)),
    mode: one(params.che_do) === "mot-trong" ? "mot-trong" : "tat-ca",
    status: statuses.includes(one(params.trang_thai)) ? one(params.trang_thai) : "",
    sort: sortOptions.some((option) => option.value === sort) ? sort : "cap-nhat",
  };
  const genreNames = state.genres.map((slug) => catalog.find((genre) => genre.slug === slug)!.name);
  const stories = await Promise.all((rows ?? []).map(async (story) => ({ ...story, title: await maskForReaders(story.title) })));
  const results = searchStories(stories, { q: state.q, genres: genreNames, mode: state.mode, status: state.status, sort: state.sort });
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number(one(params.trang)) || 1, 1), pageCount);
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const heading = genreNames.length === 1 && !state.q ? `Truyện ${genreNames[0]}` : state.q ? `Kết quả cho “${state.q}”` : "Tìm truyện";

  return <div className="min-h-screen bg-background text-foreground">
    <SiteHeader genres={catalog} initialQuery={state.q} />
    <main className="mx-auto max-w-[1300px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-primary"><Link href="/" className="hover:underline">Trang chủ</Link><span aria-hidden="true">›</span><span className="min-w-0 truncate text-foreground">Tìm truyện</span></nav>
      <div className="min-w-0"><h1 className="truncate text-2xl font-bold tracking-tight">{heading}</h1><p className="text-sm text-muted-foreground">{rows ? `${results.length} truyện phù hợp` : "Không tải được danh sách truyện. Vui lòng thử lại sau."}</p></div>
      <SearchFilters key={searchHref(state)} catalog={catalog} initial={state} />
      <Card className="overflow-hidden border-border/70 py-0">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)_4.5rem] border-b bg-muted/50 px-4 py-3 text-xs font-semibold sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_minmax(0,16rem)_6rem] sm:px-5"><span>Tên truyện</span><span className="hidden truncate sm:block">Tác giả</span><span className="truncate">Thể loại</span><span className="text-right">Chương</span></div>
        {pageResults.map((story) => <div key={story.slug} className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)_4.5rem] items-center border-b px-4 py-3 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_minmax(0,16rem)_6rem] sm:px-5">
          <div className="min-w-0 pr-3"><Link href={`/truyen/${story.slug}`} className="block truncate font-medium hover:text-primary">{story.title}</Link><p className="truncate text-xs text-muted-foreground sm:hidden">{story.author}</p></div>
          <span className="hidden truncate pr-3 text-muted-foreground sm:block">{story.author}</span>
          <div className="min-w-0 pr-3"><GenreBadges genres={story.genres} /></div>
          <span className="truncate text-right font-semibold tabular-nums text-primary">{story.chapter_count}</span>
        </div>)}
        {pageResults.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Không tìm thấy truyện phù hợp. Thử bỏ bớt thể loại hoặc chọn “Có ít nhất một thể loại”.</p>}
      </Card>
      {pageCount > 1 && <div className="flex items-center justify-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={page === 1} nativeButton={false} render={<Link href={searchHref(state, page - 1)} aria-disabled={page === 1} />}><ChevronLeft /></Button>
        <span className="px-3 text-sm tabular-nums text-muted-foreground">Trang {page}/{pageCount}</span>
        <Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={page === pageCount} nativeButton={false} render={<Link href={searchHref(state, page + 1)} aria-disabled={page === pageCount} />}><ChevronRight /></Button>
      </div>}
    </main>
    <SiteFooter />
  </div>;
}
