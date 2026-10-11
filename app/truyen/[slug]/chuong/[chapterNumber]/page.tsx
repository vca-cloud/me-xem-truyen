import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { ChapterNav } from "@/components/chapter-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdSenseScript, AdSlot } from "@/components/ads";
import { UnlockBox } from "@/components/unlock-box";
import { ViewTracker } from "@/components/view-tracker";
import { splitChapterForAds } from "@/lib/ads";
import { fetchChapterText, stripChapterHeading } from "@/lib/chapter-content";
import { maskForReaders } from "@/lib/moderation";
import { chapterPrice } from "@/lib/coins";
import { getChapterAccess, getChapterTextUrl, getReaderStory, getStoryPopup } from "@/lib/stories";
import { ShopeeGate } from "@/components/shopee-gate";

export async function generateMetadata({ params }: PageProps<"/truyen/[slug]/chuong/[chapterNumber]">): Promise<Metadata> {
  const { slug, chapterNumber } = await params;
  const story = await getReaderStory(slug);
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
  const story = await getReaderStory(slug);
  const index = story ? story.chapters.findIndex((item) => item.chapter_number === Number(chapterNumber)) : -1;
  if (!story || index < 0) notFound();
  const chapter = story.chapters[index];

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
      content = await maskForReaders(stripChapterHeading(await fetchChapterText(textUrl), chapter.chapter_number));
      if (!content.trim()) error = "Chương này chưa có nội dung.";
    } catch {
      error = "Không thể tải nội dung chương. Vui lòng thử lại sau.";
    }
  } else {
    error = "Link nội dung chương không hợp lệ.";
  }

  const showContent = !error && !locked;
  // Shopee pop-up: only on readable free chapters of stories with “Bật Affiliate”.
  const popup = showContent && access.price === 0 ? await getStoryPopup(story.id) : null;
  // Ads need readable content, a story without the ads-off flag and a chapter whose ads are on (moderation).
  const showAds = showContent && !story.ads_disabled && chapter.ads_enabled === true;
  // The text is always shown when readable; mid-chapter ad slots are only inserted when ads are allowed.
  const blocks = showContent ? (showAds ? splitChapterForAds(content) : [content]) : [];
  const navItems = story.chapters.map((item) => ({ chapter_number: item.chapter_number, title: item.title, locked: chapterPrice(story, item.chapter_number) > 0 }));
  const navigation = <ChapterNav storySlug={story.slug} chapters={navItems} current={chapter.chapter_number} />;

  return <main className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8"><ViewTracker storySlug={story.slug} chapterNumber={chapter.chapter_number} />{popup && <ShopeeGate popup={popup} storyId={story.id} storySlug={story.slug} chapterNumber={chapter.chapter_number} chapterTitle={chapter.title} />}{showAds && <AdSenseScript />}<div className="mx-auto max-w-4xl">
    <header className="mb-6 flex items-center justify-between gap-2 sm:gap-3"><Logo className="text-3xl" /><div className="flex min-w-0 items-center gap-3"><Link href={`/truyen/${story.slug}`} className="hidden min-w-0 truncate text-sm text-primary hover:underline sm:block">{story.title}</Link><AccountMenu tone="light" /><ThemeToggle className="bg-background" /></div></header>
    <div className="mb-6">{navigation}</div>
    <Card className="border-0 bg-card px-4 py-6 shadow-sm sm:p-10">
      <p className="mb-2 truncate text-sm text-primary">{story.title}</p>
      <h1 className="mb-8 line-clamp-2 text-[28px] leading-tight font-bold text-primary sm:text-4xl" title={`Chương ${chapter.chapter_number}: ${chapter.title}`}>Chương {chapter.chapter_number}: {chapter.title}</h1>
      {locked ? <UnlockBox chapterId={chapter.id} price={access.price} balance={access.balance} loggedIn={!!access.userId} returnPath={returnPath} />
        : error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</p> : <>
        <AdSlot placement="chapter-top" className="mb-8" />
        <article className="whitespace-pre-wrap text-2xl leading-[1.8] text-foreground/90">{blocks.map((block, blockIndex) => <div key={blockIndex}>{blockIndex > 0 && <AdSlot placement="chapter-mid" className="my-8" />}{block}</div>)}</article>
      </>}
    </Card>
    {showAds && <AdSlot placement="chapter-end" className="mb-24 mt-10" />}
    <div className="mb-10 mt-6">{navigation}</div>
  </div></main>;
}
