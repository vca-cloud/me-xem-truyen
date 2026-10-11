"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { BrandName } from "@/components/logo";

// Shopee affiliate pop-up on free chapters of stories with “Bật Affiliate” (stories.affiliate_enabled).
// The chapter text is rendered behind it (blurred); the reader opens the Shopee link (through /go/<id> so the
// click is counted) and the chapter unlocks at once. Unlocked state is kept in this browser:
// gate 0 = per chapter, otherwise the whole story for `gateMinutes` after the click.

const EVENT = "mxt-shopee-gate";
const keyFor = (storyId: string, chapter: number, gateMinutes: number) => gateMinutes ? `mxt_shopee:${storyId}` : `mxt_shopee:${storyId}:${chapter}`;

function isUnlocked(key: string, gateMinutes: number) {
  try {
    const value = Number(localStorage.getItem(key));
    if (!value) return false;
    return gateMinutes ? Date.now() - value < gateMinutes * 60_000 : true;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

export type ShopeePopup = { linkId: string; name: string; imageUrl: string | null; headline: string | null; gateMinutes: number };

export function ShopeeGate({ popup, storyId, storySlug, chapterNumber, chapterTitle }: { popup: ShopeePopup; storyId: string; storySlug: string; chapterNumber: number; chapterTitle: string }) {
  const key = keyFor(storyId, chapterNumber, popup.gateMinutes);
  // The server renders the pop-up (no flash of the text); the browser then checks whether it was already unlocked.
  const unlocked = useSyncExternalStore(subscribe, () => isUnlocked(key, popup.gateMinutes), () => false);

  // Keep the page from scrolling behind the pop-up.
  useEffect(() => {
    if (unlocked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [unlocked]);

  if (unlocked) return null;

  function unlock() {
    try { localStorage.setItem(key, String(Date.now())); } catch {}
    // Let the new tab open first, then reveal the chapter in this one.
    setTimeout(() => window.dispatchEvent(new Event(EVENT)), 300);
  }

  const href = `/go/${popup.linkId}?s=${encodeURIComponent(storySlug)}&c=${chapterNumber}`;
  return <div role="dialog" aria-modal="true" aria-labelledby="shopee-gate-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-6">
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-highlight/40 bg-card text-card-foreground shadow-2xl">
      <div className="flex items-center justify-between bg-highlight px-5 py-3 text-highlight-foreground">
        <span className="flex items-center gap-2 text-lg font-bold"><ShoppingBag className="size-5" aria-hidden="true" />Shopee</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Miễn phí</span>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p id="shopee-gate-title" className="text-xl font-bold">Mở khóa chương miễn phí</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">Chương {chapterNumber}: {chapterTitle}</p>
        </div>
        {(popup.imageUrl || popup.headline) && <a href={href} target="_blank" rel="noopener sponsored" onClick={unlock} className="flex items-center gap-3 rounded-xl border p-2 transition-colors hover:border-highlight">
          {/* eslint-disable-next-line @next/next/no-img-element -- product picture from Shopee */}
          {popup.imageUrl && <img src={popup.imageUrl} alt="" className="size-20 shrink-0 rounded-lg object-cover" />}
          <span className="min-w-0"><span className="line-clamp-2 font-semibold">{popup.name}</span>{popup.headline && <span className="mt-0.5 line-clamp-2 block text-sm text-highlight">{popup.headline}</span>}</span>
        </a>}
        <p className="text-sm text-muted-foreground">Bấm nút bên dưới để ghé Shopee ủng hộ <BrandName />. Chương sẽ mở ngay khi bạn quay lại trang này.</p>
        <a href={href} target="_blank" rel="noopener sponsored" onClick={unlock} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-highlight text-base font-bold text-highlight-foreground shadow-md transition-colors hover:bg-highlight/90">
          <ExternalLink className="size-5" aria-hidden="true" />Mở Shopee &amp; đọc tiếp
        </a>
        <p className="text-center text-[11px] leading-snug text-muted-foreground"><BrandName /> có thể nhận hoa hồng khi bạn mua hàng qua liên kết — giá bạn trả không đổi.</p>
      </div>
    </div>
  </div>;
}
