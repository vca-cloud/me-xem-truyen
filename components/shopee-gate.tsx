"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { BrandName } from "@/components/logo";

// Shopee affiliate pop-up on free chapters of stories with “Bật Affiliate” (stories.affiliate_enabled).
// The chapter text is rendered behind it (blurred); the reader opens the Shopee link (through /go/<id> so the
// click is counted) and the chapter unlocks at once.
// gate 0 = every visit: nothing is remembered, so leaving the chapter and coming back (link, reload, Back button)
// shows the pop-up again. Otherwise the click is remembered in this browser for the whole story for `gateMinutes`.

const EVENT = "mxt-shopee-gate";
const keyFor = (storyId: string, chapter: number, gateMinutes: number) => gateMinutes ? `mxt_shopee:${storyId}` : `mxt_shopee:${storyId}:${chapter}`; // chapter key unused in every-visit mode

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
  const everyVisit = popup.gateMinutes === 0;
  // The server renders the pop-up (no flash of the text); the browser then checks whether it was already unlocked.
  const remembered = useSyncExternalStore(subscribe, () => !everyVisit && isUnlocked(key, popup.gateMinutes), () => false);
  const [clicked, setClicked] = useState(false);
  const unlocked = remembered || clicked;

  // Every-visit mode: a page restored by the Back button (bfcache) keeps its old state, so lock it again.
  useEffect(() => {
    if (!everyVisit) return;
    const relock = (event: PageTransitionEvent) => { if (event.persisted) setClicked(false); };
    window.addEventListener("pageshow", relock);
    return () => window.removeEventListener("pageshow", relock);
  }, [everyVisit]);

  // Keep the page from scrolling behind the pop-up.
  useEffect(() => {
    if (unlocked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [unlocked]);

  if (unlocked) return null;

  function unlock() {
    // Let the new tab open first, then reveal the chapter in this one.
    if (everyVisit) { setTimeout(() => setClicked(true), 300); return; }
    try { localStorage.setItem(key, String(Date.now())); } catch {}
    setTimeout(() => window.dispatchEvent(new Event(EVENT)), 300);
  }

  const href = `/go/${popup.linkId}?s=${encodeURIComponent(storySlug)}&c=${chapterNumber}`;
  return <div role="dialog" aria-modal="true" aria-labelledby="shopee-gate-title" className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-6">
    <div className="max-h-full w-full max-w-[864px] overflow-y-auto rounded-[2rem] border border-highlight/40 bg-card text-card-foreground shadow-2xl">
      <div className="flex items-center justify-between bg-highlight px-7 py-5 text-highlight-foreground sm:px-9 sm:py-6">
        <span className="flex items-center gap-3 text-[32px] font-bold sm:text-4xl"><ShoppingBag className="size-9 sm:size-10" aria-hidden="true" />Shopee</span>
        <span className="rounded-full bg-white/20 px-4 py-1.5 text-xl font-semibold sm:text-2xl">Miễn phí</span>
      </div>
      <div className="space-y-7 p-7 sm:space-y-8 sm:p-10">
        <div>
          <p id="shopee-gate-title" className="text-[36px] leading-tight font-bold sm:text-[45px]">Mở khóa chương miễn phí</p>
          <p className="mt-3 line-clamp-2 text-[23px] text-muted-foreground sm:text-[27px]">Chương {chapterNumber}: {chapterTitle}</p>
        </div>
        {(popup.imageUrl || popup.headline) && <a href={href} target="_blank" rel="noopener sponsored" onClick={unlock} className="flex items-center gap-5 rounded-3xl border p-4 transition-colors hover:border-highlight sm:gap-6 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- product picture from Shopee */}
          {popup.imageUrl && <img src={popup.imageUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover sm:size-40" />}
          <span className="min-w-0"><span className="line-clamp-2 text-2xl leading-snug font-semibold sm:text-3xl">{popup.name}</span>{popup.headline && <span className="mt-2 line-clamp-2 block text-xl text-highlight sm:text-[27px]">{popup.headline}</span>}</span>
        </a>}
        <a href={href} target="_blank" rel="noopener sponsored" onClick={unlock} className="flex h-20 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-3xl bg-highlight px-4 text-[22px] font-bold text-highlight-foreground shadow-md transition-colors hover:bg-highlight/90 sm:h-24 sm:text-4xl">
          <ExternalLink className="size-7 shrink-0 sm:size-9" aria-hidden="true" />Mở Shopee &amp; đọc tiếp
        </a>
        <p className="text-[23px] leading-relaxed text-muted-foreground sm:text-[27px]">Ghé Shopee là bạn đã ủng hộ <BrandName />. Chương sẽ mở khi bạn quay lại trang này. Hoàn toàn miễn phí.</p>
        <p className="text-center text-lg leading-snug text-muted-foreground sm:text-xl"><BrandName /> cần kinh phí để duy trì kênh miễn phí. Mong bạn thông cảm.</p>
      </div>
    </div>
  </div>;
}
