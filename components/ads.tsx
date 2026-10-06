"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { adPlacements, adsEnabled, adsenseClient, adsPreview, placementActive, type AdPlacement } from "@/lib/ads";
import { cn } from "@/lib/utils";

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

const formatAttributes = {
  display: { "data-ad-format": "auto", "data-full-width-responsive": "true" },
  "in-article": { "data-ad-format": "fluid", "data-ad-layout": "in-article" },
  multiplex: { "data-ad-format": "autorelaxed" },
} as const;

// Loads the AdSense library. Render only on pages allowed to show ads (home, story, chapter) —
// never on login, admin or error pages. Auto ads (anchor) configured in AdSense also rely on this script.
export function AdSenseScript() {
  if (!adsEnabled) return null;
  return <Script async strategy="afterInteractive" crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`} />;
}

// One ad placement. Reserves its height to avoid layout shift, carries a visible "Quảng cáo" label,
// and requests the ad only when it scrolls near the viewport. `disabled` hides it (e.g. sensitive stories).
export function AdSlot({ placement, disabled = false, className }: { placement: AdPlacement; disabled?: boolean; className?: string }) {
  const config = adPlacements[placement];
  const ref = useRef<HTMLModElement>(null);
  const active = !disabled && placementActive(placement);
  const live = active && !adsPreview;

  useEffect(() => {
    const element = ref.current;
    if (!live || !element) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (element.dataset.adsbygoogleStatus) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Ad blockers or a not-yet-approved account: leave the reserved space empty.
      }
    }, { rootMargin: "600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [live]);

  if (!active) return null;
  return <aside aria-label="Quảng cáo" className={cn("mx-auto w-full max-w-3xl", className)}>
    <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-slate-400">Quảng cáo</p>
    {adsPreview
      ? <div className="flex items-center justify-center rounded-md border-2 border-dashed border-amber-300 bg-amber-50 text-xs text-amber-700" style={{ minHeight: config.minHeight }}>{config.label} · {config.format}</div>
      : <ins ref={ref} className="adsbygoogle block" style={{ display: "block", minHeight: config.minHeight }} data-ad-client={adsenseClient} data-ad-slot={config.slot} data-adtest={process.env.NODE_ENV === "production" ? undefined : "on"} {...formatAttributes[config.format]} />}
  </aside>;
}
