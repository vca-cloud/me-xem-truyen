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
import { getChapterAccess, getChapterTextUrl, getReaderStory } from "@/lib/stories";

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
  // Ads need readable content, a story without the ads-off flag and a chapter whose ads are on (moderation).
  const showAds = showContent && !story.ads_disabled && chapter.ads_enabled === true;
  // The text is always shown when readable; mid-chapter ad slots are only inserted when ads are allowed.
  const blocks = showContent ? (showAds ? splitChapterForAds(content) : [content]) : [];
  const navItems = story.chapters.map((item) => ({ chapter_number: item.chapter_number, title: item.title, locked: chapterPrice(story, item.chapter_number) > 0 }));
  const navigation = <ChapterNav storySlug={story.slug} chapters={navItems} current={chapter.chapter_number} />;

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><ViewTracker storySlug={story.slug} chapterNumber={chapter.chapter_number} />{showAds && <AdSenseScript />}<div className="mx-auto max-w-4xl">
    <header className="mb-6 flex items-center justify-between gap-3"><Logo /><div className="flex min-w-0 items-center gap-3"><Link href={`/truyen/${story.slug}`} className="hidden min-w-0 truncate text-sm text-primary hover:underline sm:block">{story.title}</Link><AccountMenu tone="light" /><ThemeToggle className="bg-background" /></div></header>
    <div className="mb-6">{navigation}</div>
    <Card className="border-0 bg-card p-6 shadow-sm sm:p-10">
      <p className="mb-2 truncate text-sm text-primary">{story.title}</p>
      <h1 className="mb-8 line-clamp-2 text-2xl font-bold text-primary" title={`Chương ${chapter.chapter_number}: ${chapter.title}`}>Chương {chapter.chapter_number}: {chapter.title}</h1>
      {locked ? <UnlockBox chapterId={chapter.id} price={access.price} balance={access.balance} loggedIn={!!access.userId} returnPath={returnPath} />
        : error ? <p role="alert" className="rounded-md bg-rose-50 p-4 text-rose-700">{error}</p> : <>
        <AdSlot placement="chapter-top" className="mb-8" />
        <article className="whitespace-pre-wrap text-base leading-8 text-foreground/85">{blocks.map((block, blockIndex) => <div key={blockIndex}>{blockIndex > 0 && <AdSlot placement="chapter-mid" className="my-8" />}{block}</div>)}</article>
      </>}
    </Card>
    {showAds && <AdSlot placement="chapter-end" className="mb-24 mt-10" />}
    <div className="mb-10 mt-6">{navigation}</div>
  </div></main>;
}
