import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteInfo } from "@/lib/site";

// Be Vietnam Pro: designed for Vietnamese diacritics (Geist has no Vietnamese subset).
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteInfo.url),
  title: { default: `${siteInfo.name} – Đọc truyện chữ online`, template: `%s | ${siteInfo.name}` },
  description: siteInfo.description,
  openGraph: { type: "website", siteName: siteInfo.name, locale: "vi_VN" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><TooltipProvider><ConfirmProvider>{children}</ConfirmProvider></TooltipProvider><Toaster richColors position="top-center" /></body>
    </html>
  );
}
