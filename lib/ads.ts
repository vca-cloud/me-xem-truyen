// AdSense configuration. Ads stay off until NEXT_PUBLIC_ADSENSE_CLIENT is set and NEXT_PUBLIC_ADS_ENABLED=true;
// each placement renders only when its own slot id is configured, so placements can be switched on one at a time.
// NEXT_PUBLIC_* values are inlined at build time: changing them needs a rebuild/redeploy.

export type AdPlacement = "home-top" | "home-feed" | "story-detail" | "chapter-top" | "chapter-mid" | "chapter-end";

type AdFormat = "display" | "in-article" | "multiplex";

export const adPlacements: Record<AdPlacement, { label: string; format: AdFormat; slot: string | undefined; minHeight: number }> = {
  "home-top": { label: "Trang chủ - dưới menu", format: "display", slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_TOP, minHeight: 100 },
  "home-feed": { label: "Trang chủ - giữa danh sách", format: "display", slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_FEED, minHeight: 250 },
  "story-detail": { label: "Trang truyện", format: "display", slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_STORY, minHeight: 250 },
  "chapter-top": { label: "Đầu chương", format: "display", slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CHAPTER_TOP, minHeight: 100 },
  "chapter-mid": { label: "Giữa chương", format: "in-article", slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CHAPTER_MID, minHeight: 250 },
  "chapter-end": { label: "Cuối chương", format: "multiplex", slot: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CHAPTER_END, minHeight: 280 },
};

export const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || undefined;
export const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true" && !!adsenseClient && /^ca-pub-\d{10,20}$/.test(adsenseClient);
// Shows labelled placeholders instead of real ads, to review layout before AdSense is approved.
export const adsPreview = process.env.NEXT_PUBLIC_ADS_PREVIEW === "true";

export function placementActive(placement: AdPlacement) {
  return adsPreview || (adsEnabled && !!adPlacements[placement].slot);
}

const MID_AD_EVERY_WORDS = 900;
const MID_AD_MAX = 3;
const MID_AD_MIN_TAIL_WORDS = 300;

// Splits chapter text into blocks with a mid-chapter ad after roughly every 900 words (max 3),
// cutting only at paragraph breaks and never in the last ~300 words of the chapter.
export function splitChapterForAds(text: string) {
  const paragraphs = text.split(/\n\s*\n/);
  const wordCounts = paragraphs.map((paragraph) => paragraph.split(/\s+/).filter(Boolean).length);
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
  const blocks: string[] = [];
  let current: string[] = [];
  let sinceLastAd = 0;
  let seen = 0;
  paragraphs.forEach((paragraph, index) => {
    current.push(paragraph);
    sinceLastAd += wordCounts[index];
    seen += wordCounts[index];
    if (blocks.length < MID_AD_MAX && sinceLastAd >= MID_AD_EVERY_WORDS && totalWords - seen >= MID_AD_MIN_TAIL_WORDS) {
      blocks.push(current.join("\n\n"));
      current = [];
      sinceLastAd = 0;
    }
  });
  blocks.push(current.join("\n\n"));
  return blocks;
}
