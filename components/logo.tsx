import Link from "next/link";
import { cn } from "@/lib/utils";

// Brand logo: lowercase "mê xem truyện", 36px bold (30px on phones), "mê" in Shopee orange; the rest inherits the text color.
export function Logo({ className }: { className?: string }) {
  return <Link href="/" aria-label="Mê Xem Truyện – Trang chủ" className={cn("shrink-0 whitespace-nowrap text-3xl leading-none sm:text-4xl font-bold tracking-tight", className)}>
    <span className="text-highlight">mê</span> xem truyện
  </Link>;
}
