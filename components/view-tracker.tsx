"use client";

import { useEffect } from "react";

// Sends one page-view event per story/chapter render. Duplicate views are filtered server-side.
export function ViewTracker({ storySlug, chapterNumber }: { storySlug: string; chapterNumber?: number }) {
  useEffect(() => {
    fetch("/api/track/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story_slug: storySlug, chapter_number: chapterNumber ?? null, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => undefined);
  }, [storySlug, chapterNumber]);
  return null;
}
