import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Bookmark, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AccountMenu } from "@/components/account-menu";
import { AdSenseScript, AdSlot } from "@/components/ads";
import { SiteFooter } from "@/components/site-footer";
import { ViewTracker } from "@/components/view-tracker";
import { defaultAudioSiteUrl, validTextUrl } from "@/lib/story-data";
import { chapterPrice, formatCoins } from "@/lib/coins";
import { getStory } from "@/lib/stories";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export async function generateMetadata({ params }: PageProps<"/truyen/[slug]">): Promise<Metadata> {
  const story = await getStory((await params).slug);
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
  const story = await getStory(slug);
  if (!story) notFound();
  const newestFirst = (await searchParams).thu_tu === "moi";
  const chapters = newestFirst ? [...story.chapters].reverse() : story.chapters;
  const first = story.chapters[0];
  const latest = story.chapters.at(-1);
  const audioUrl = story.audio_url && validTextUrl(story.audio_url) ? story.audio_url : `${defaultAudioSiteUrl}/truyen/${story.slug}`;
  const coverUrl = story.cover_url && validTextUrl(story.cover_url) ? story.cover_url : null;

  return <div className="min-h-screen bg-[#eaf5f7] text-[#123047]"><ViewTracker storySlug={story.slug} />{!story.ads_disabled && <AdSenseScript />}
    <header className="sticky top-0 z-50 border-b border-white/15 bg-[#08729c] text-white shadow-md"><div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8"><Link href="/" className="shrink-0 text-lg font-bold tracking-tight sm:text-xl"><span className="text-cyan-200">Mê</span> Xem Truyện</Link><div className="ml-auto"><AccountMenu /></div></div></header>
    <main className="mx-auto max-w-[1300px] space-y-10 px-4 py-7 sm:px-6 lg:px-8"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[#08729c]"><Link href="/" className="hover:underline">Trang chủ</Link><span aria-hidden="true">›</span><span className="min-w-0 truncate text-[#123047]">{story.title}</span></nav>
      <section className="grid gap-8 lg:grid-cols-[290px_1fr]">
        <div className="relative aspect-[4/5] w-full max-w-[290px] overflow-hidden rounded-xl bg-gradient-to-br from-slate-950 via-cyan-950 to-sky-700 shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- covers come from arbitrary admin-provided hosts */}
          {coverUrl ? <img src={coverUrl} alt={`Ảnh bìa ${story.title}`} className="size-full object-cover" /> : <span className="absolute inset-x-4 bottom-4 text-lg font-semibold text-white drop-shadow-md">{story.title}</span>}
        </div>
        <div className="min-w-0 space-y-5">
          <h1 className="text-3xl font-bold tracking-tight text-[#08729c] sm:text-4xl">{story.title}</h1>
          <div className="grid gap-x-10 gap-y-3 text-base leading-7 sm:grid-cols-2">
            <div><p><span className="text-[#08729c]">Tác giả:</span> {story.author}</p><p><span className="text-[#08729c]">Thể loại:</span> {story.genres.join(", ") || "Chưa phân loại"}</p></div>
            <div><p><span className="text-[#08729c]">Trạng thái:</span> <strong className="rounded bg-rose-500 px-2 py-1 text-sm text-white">{story.status}</strong></p><p><span className="text-[#08729c]">Tổng chương:</span> <strong>{story.chapters.length.toLocaleString("vi-VN")} chương</strong></p><p><span className="text-[#08729c]">Cập nhật:</span> {dateFormat.format(new Date(story.updated_at))}</p>{story.lock_from_chapter !== null && <p><span className="text-[#08729c]">Chương trả phí:</span> {story.lock_from_chapter > 1 ? `từ chương ${story.lock_from_chapter}` : "tất cả"}, {formatCoins(story.lock_price_coins)}/chương</p>}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            {first && <Button className="bg-[#08729c] hover:bg-[#075f82]" nativeButton={false} render={<Link href={`/truyen/${story.slug}/chuong/${first.chapter_number}`} />}><BookOpen className="mr-2 size-4" />Đọc từ đầu</Button>}
            {latest && latest !== first && <Button className="bg-orange-500 hover:bg-orange-600" nativeButton={false} render={<Link href={`/truyen/${story.slug}/chuong/${latest.chapter_number}`} />}>Đọc mới nhất</Button>}
            <Button variant="outline" nativeButton={false} render={<a href={audioUrl} target="_blank" rel="noreferrer" />}><ExternalLink className="mr-2 size-4" />Mê Nghe Truyện</Button>
            <Button variant="outline" disabled title="Sắp có"><Bookmark className="mr-2 size-4" />Thêm vào tủ sách</Button>
          </div>
        </div>
      </section>
      {story.description && <Card className="border-0 bg-white p-7 text-base leading-8 text-[#08729c] shadow-sm sm:p-8">{story.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="mb-6 whitespace-pre-line last:mb-0">{paragraph}</p>)}</Card>}
      <AdSlot placement="story-detail" disabled={story.ads_disabled} />
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-[#08729c]">Danh sách chương <span className="font-normal">({story.chapters.length})</span></h2><div className="flex gap-2"><Button variant={newestFirst ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href={`/truyen/${story.slug}?thu_tu=moi`} scroll={false} />}>Mới → Cũ</Button><Button variant={newestFirst ? "outline" : "default"} size="sm" nativeButton={false} render={<Link href={`/truyen/${story.slug}`} scroll={false} />}>Cũ → Mới</Button></div></div>
        <Card className="overflow-hidden border-0 bg-white shadow-sm">{chapters.length ? <div className="sm:columns-2 sm:gap-0 sm:[column-rule:1px_solid_var(--color-border)]">{chapters.map((chapter) => <Link key={chapter.id} href={`/truyen/${story.slug}/chuong/${chapter.chapter_number}`} className="flex min-w-0 break-inside-avoid items-center justify-between gap-3 border-b px-4 py-2.5 text-sm hover:bg-muted/50"><span className="min-w-0 truncate">Chương {chapter.chapter_number}: {chapter.title}</span>{chapterPrice(story, chapter.chapter_number) > 0 ? <span className="flex shrink-0 items-center gap-1 text-xs text-amber-600"><Lock className="size-3" aria-hidden="true" />{formatCoins(story.lock_price_coins)}</span> : <span className="shrink-0 text-xs text-[#08729c]">Miễn phí</span>}</Link>)}</div> : <p className="px-4 py-8 text-center text-sm text-slate-500">Truyện chưa có chương nào.</p>}</Card>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
