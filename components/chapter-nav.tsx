"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type ChapterNavItem = { chapter_number: number; title: string; locked: boolean };
type Option = { value: number; label: string; locked: boolean };

// Previous / searchable chapter picker / next, shown above and below the chapter text.
export function ChapterNav({ storySlug, chapters, current, className }: { storySlug: string; chapters: ChapterNavItem[]; current: number; className?: string }) {
  const router = useRouter();
  const options: Option[] = chapters.map((chapter) => ({ value: chapter.chapter_number, label: `Chương ${chapter.chapter_number}: ${chapter.title}`, locked: chapter.locked }));
  const index = options.findIndex((option) => option.value === current);
  const previous = options[index - 1];
  const next = options[index + 1];
  const href = (number: number) => `/truyen/${storySlug}/chuong/${number}`;

  return <nav aria-label="Chuyển chương" className={cn("flex items-center justify-center gap-2", className)}>
    {previous
      ? <Button variant="outline" size="lg" className="bg-background" aria-label="Chương trước" nativeButton={false} render={<Link href={href(previous.value)} />}><ChevronLeft /><span className="hidden sm:inline">Chương trước</span></Button>
      : <Button variant="outline" size="lg" className="bg-background" disabled aria-label="Chương trước"><ChevronLeft /><span className="hidden sm:inline">Chương trước</span></Button>}
    <Combobox
      autoHighlight
      items={options}
      value={options[index] ?? null}
      onValueChange={(option) => { if (option && option.value !== current) router.push(href(option.value)); }}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <ComboboxInput aria-label="Chọn chương" placeholder="Tìm chương..." className="h-9 w-full max-w-xs flex-1 bg-background" />
      <ComboboxContent>
        <ComboboxEmpty>Không có chương phù hợp.</ComboboxEmpty>
        <ComboboxList>
          {(option: Option) => <ComboboxItem key={option.value} value={option}><span className="truncate">{option.locked && "🔒 "}{option.label}</span></ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
    {next
      ? <Button variant="outline" size="lg" className="bg-background" aria-label="Chương sau" nativeButton={false} render={<Link href={href(next.value)} />}><span className="hidden sm:inline">Chương sau</span><ChevronRight /></Button>
      : <Button variant="outline" size="lg" className="bg-background" aria-label="Về trang truyện" nativeButton={false} render={<Link href={`/truyen/${storySlug}`} />}><span className="hidden sm:inline">Mục lục</span><ChevronRight /></Button>}
  </nav>;
}
