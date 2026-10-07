import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { missingCompanyInfo } from "@/lib/site";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4" />Về trang chủ</Link>
      <article className="space-y-4 rounded-xl bg-card p-6 leading-7 shadow-sm sm:p-10 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        <p className="text-sm text-muted-foreground">Cập nhật: {updated}</p>
        {missingCompanyInfo && <p role="note" className="rounded-md border border-highlight/40 bg-highlight/10 px-3 py-2 text-sm text-foreground">Bản nháp — thông tin doanh nghiệp chưa được điền đầy đủ.</p>}
        {children}
      </article>
    </main>
    <SiteFooter />
  </div>;
}
