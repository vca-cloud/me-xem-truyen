"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChapterNavItem = { chapter_number: number; title: string; locked: boolean };

const buttonClass = "inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border bg-white px-3 text-sm font-medium text-[#123047] shadow-sm transition-colors hover:bg-slate-50";

// Previous / chapter picker / next, shown above and below the chapter text.
export function ChapterNav({ storySlug, chapters, current, className }: { storySlug: string; chapters: ChapterNavItem[]; current: number; className?: string }) {
  const router = useRouter();
  const index = chapters.findIndex((chapter) => chapter.chapter_number === current);
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  const href = (number: number) => `/truyen/${storySlug}/chuong/${number}`;

  return <nav aria-label="Chuyển chương" className={cn("flex items-center justify-center gap-2", className)}>
    {previous
      ? <Link href={href(previous.chapter_number)} className={buttonClass} aria-label="Chương trước"><ChevronLeft className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Chương trước</span></Link>
      : <span className={cn(buttonClass, "pointer-events-none opacity-40")} aria-hidden="true"><ChevronLeft className="size-4" /><span className="hidden sm:inline">Chương trước</span></span>}
    <select
      aria-label="Chọn chương"
      value={current}
      onChange={(event) => router.push(href(Number(event.target.value)))}
      className="h-10 w-full min-w-0 max-w-xs flex-1 cursor-pointer truncate rounded-lg border bg-white px-3 text-sm text-[#123047] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#08729c]/40"
    >
      {chapters.map((chapter) => <option key={chapter.chapter_number} value={chapter.chapter_number}>
        {chapter.locked ? "🔒 " : ""}Chương {chapter.chapter_number}: {chapter.title}
      </option>)}
    </select>
    {next
      ? <Link href={href(next.chapter_number)} className={buttonClass} aria-label="Chương sau"><span className="hidden sm:inline">Chương sau</span><ChevronRight className="size-4" aria-hidden="true" /></Link>
      : <Link href={`/truyen/${storySlug}`} className={buttonClass} aria-label="Về trang truyện"><span className="hidden sm:inline">Mục lục</span><ChevronRight className="size-4" aria-hidden="true" /></Link>}
  </nav>;
}
