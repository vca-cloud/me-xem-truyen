import Link from "next/link";
import { cn } from "@/lib/utils";

// Brand name wherever it appears in text: lowercase "mê xem truyện", bold, "mê" in Shopee orange.
// Font size and the color of "xem truyện" follow the surrounding text.
export function BrandName({ className }: { className?: string }) {
  return <span className={cn("whitespace-nowrap font-bold", className)}><span className="text-highlight">mê</span> xem truyện</span>;
}

// Header logo: the brand name at 54px (36px on phones), linking home.
export function Logo({ className }: { className?: string }) {
  return <Link href="/" aria-label="mê xem truyện – Trang chủ" className={cn("shrink-0 text-4xl leading-none tracking-tight sm:text-[54px]", className)}><BrandName /></Link>;
}
