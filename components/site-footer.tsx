import Link from "next/link";
import { siteInfo } from "@/lib/site";

export function SiteFooter() {
  return <footer className="mt-12 border-t bg-white/60 px-4 py-8 text-sm text-slate-500">
    <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-between gap-4">
      <p>© {new Date().getFullYear()} {siteInfo.name}{siteInfo.company ? ` · ${siteInfo.company}` : ""}</p>
      <nav aria-label="Thông tin" className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/tac-gia" className="hover:underline">Viết truyện</Link>
        <Link href="/gioi-thieu" className="hover:underline">Giới thiệu</Link>
        <Link href="/dieu-khoan" className="hover:underline">Điều khoản sử dụng</Link>
        <Link href="/chinh-sach-bao-mat" className="hover:underline">Chính sách bảo mật</Link>
        <Link href="/lien-he" className="hover:underline">Liên hệ</Link>
      </nav>
    </div>
  </footer>;
}
