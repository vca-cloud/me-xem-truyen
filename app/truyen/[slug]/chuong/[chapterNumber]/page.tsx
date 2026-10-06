import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AccountMenu } from "@/components/account-menu";
import { AdSenseScript, AdSlot } from "@/components/ads";
import { UnlockBox } from "@/components/unlock-box";
import { ViewTracker } from "@/components/view-tracker";
import { splitChapterForAds } from "@/lib/ads";
import { fetchChapterText } from "@/lib/chapter-content";
import { chapterPrice } from "@/lib/coins";
import { getChapterAccess, getChapterTextUrl, getStory } from "@/lib/stories";

export async function generateMetadata({ params }: PageProps<"/truyen/[slug]/chuong/[chapterNumber]">): Promise<Metadata> {
  const { slug, chapterNumber } = await params;
  const story = await getStory(slug);
  const chapter = story?.chapters.find((item) => item.chapter_number === Number(chapterNumber));
  if (!story || !chapter) return { title: "Không tìm thấy chương" };
  const paid = chapterPrice(story, chapter.chapter_number) > 0;
  return {
    title: `${story.title} – Chương ${chapter.chapter_number}: ${chapter.title}`,
    description: `Đọc chương ${chapter.chapter_number} truyện ${story.title} của tác giả ${story.author}.`,
    alternates: { canonical: `/truyen/${story.slug}/chuong/${chapter.chapter_number}` },
    // Paid chapters show no text to anyone (Google included), so keep them out of the index instead of serving a thin page.
    robots: paid ? { index: false, follow: true } : undefined,
  };
}

export default async function ChapterPage({ params }: PageProps<"/truyen/[slug]/chuong/[chapterNumber]">) {
  const { slug, chapterNumber } = await params;
  const story = await getStory(slug);
  const index = story ? story.chapters.findIndex((item) => item.chapter_number === Number(chapterNumber)) : -1;
  if (!story || index < 0) notFound();
  const chapter = story.chapters[index];
  const previous = story.chapters[index - 1];
  const next = story.chapters[index + 1];

  const access = await getChapterAccess(chapter.id, chapterPrice(story, chapter.chapter_number));
  const returnPath = `/truyen/${story.slug}/chuong/${chapter.chapter_number}`;

  // The content link is released by the database only for free or unlocked chapters.
  const textUrl = access.unlocked ? await getChapterTextUrl(chapter.id) : null;
  const locked = !access.unlocked;

  let content = "";
  let error: string | null = null;
  if (locked) {
    // Nothing to fetch: the unlock box is shown instead of the text.
  } else if (textUrl) {
    try {
      content = await fetchChapterText(textUrl);
      if (!content.trim()) error = "Chương này chưa có nội dung.";
    } catch {
      error = "Không thể tải nội dung chương. Vui lòng thử lại sau.";
    }
  } else {
    error = "Link nội dung chương không hợp lệ.";
  }

  // Ads only on chapters whose content actually loaded; never on locked, empty or error pages.
  const showAds = !error && !locked && !story.ads_disabled;
  const blocks = showAds ? splitChapterForAds(content) : [];
  const navigation = <nav aria-label="Chuyển chương" className="flex justify-between gap-3">{previous ? <Link href={`/truyen/${story.slug}/chuong/${previous.chapter_number}`}><Button variant="outline"><ArrowLeft className="mr-2 size-4" />Chương trước</Button></Link> : <span />}{next ? <Link href={`/truyen/${story.slug}/chuong/${next.chapter_number}`}><Button variant="outline">Chương sau<ArrowRight className="ml-2 size-4" /></Button></Link> : <Link href={`/truyen/${story.slug}`}><Button variant="outline">Về trang truyện</Button></Link>}</nav>;

  return <main className="min-h-screen bg-[#eaf5f7] px-4 py-8 text-[#123047]"><ViewTracker storySlug={story.slug} chapterNumber={chapter.chapter_number} />{showAds && <AdSenseScript />}<div className="mx-auto max-w-4xl">
    <header className="mb-6 flex items-center justify-between gap-3"><Link href="/" className="flex items-center gap-2 font-semibold text-[#08729c]"><BookOpen className="size-5" />Mê Xem Truyện</Link><div className="flex min-w-0 items-center gap-3"><Link href={`/truyen/${story.slug}`} className="hidden min-w-0 truncate text-sm text-[#08729c] hover:underline sm:block">{story.title}</Link><div className="rounded-lg bg-[#08729c] p-1"><AccountMenu /></div></div></header>
    <div className="mb-6">{navigation}</div>
    <Card className="border-0 bg-white p-6 shadow-sm sm:p-10">
      <p className="mb-2 text-sm text-[#08729c]">{story.title}</p>
      <h1 className="mb-8 text-2xl font-bold text-[#08729c]">Chương {chapter.chapter_number}: {chapter.title}</h1>
      {locked ? <UnlockBox chapterId={chapter.id} price={access.price} balance={access.balance} loggedIn={!!access.userId} returnPath={returnPath} />
        : error ? <p role="alert" className="rounded-md bg-rose-50 p-4 text-rose-700">{error}</p> : <>
        <AdSlot placement="chapter-top" className="mb-8" />
        <article className="whitespace-pre-wrap text-base leading-8 text-slate-700">{blocks.map((block, blockIndex) => <div key={blockIndex}>{blockIndex > 0 && <AdSlot placement="chapter-mid" className="my-8" />}{block}</div>)}</article>
      </>}
    </Card>
    {showAds && <AdSlot placement="chapter-end" className="mb-24 mt-10" />}
    <div className={showAds ? "" : "mt-6"}>{navigation}</div>
  </div></main>;
}
