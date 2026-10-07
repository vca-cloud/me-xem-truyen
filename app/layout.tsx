import type { Metadata } from "next";
import { Geist_Mono, Raleway } from "next/font/google";
import "./globals.css";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteInfo } from "@/lib/site";

// Raleway: brand font, includes the Vietnamese subset.
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
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

// Applies the saved light/dark choice before first paint (reader pages only; admin stays light).
const themeScript = `try{var t=localStorage.getItem("theme");if(!location.pathname.startsWith("/admin")&&(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches)))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${raleway.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-full flex flex-col"><TooltipProvider><ConfirmProvider>{children}</ConfirmProvider></TooltipProvider><Toaster richColors position="top-center" /></body>
    </html>
  );
}
