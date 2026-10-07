import Link from "next/link";
import { siteInfo } from "@/lib/site";

export function SiteFooter() {
  return <footer className="mt-12 border-t border-header-foreground/10 bg-header px-4 py-8 text-sm text-header-foreground/75">
    <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-between gap-4">
      <p>© {new Date().getFullYear()} {siteInfo.name}{siteInfo.company ? ` · ${siteInfo.company}` : ""}</p>
      <nav aria-label="Thông tin" className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/tac-gia" className="hover:text-highlight">Viết truyện</Link>
        <Link href="/gioi-thieu" className="hover:text-highlight">Giới thiệu</Link>
        <Link href="/dieu-khoan" className="hover:text-highlight">Điều khoản sử dụng</Link>
        <Link href="/chinh-sach-bao-mat" className="hover:text-highlight">Chính sách bảo mật</Link>
        <Link href="/lien-he" className="hover:text-highlight">Liên hệ</Link>
      </nav>
    </div>
  </footer>;
}
