// Story cover format, shared by every place that shows a cover (phone and desktop alike).
// One image per story, cropped to 4:5 at upload and stored in two sizes; it is scaled to fit and never stretched.
export const COVER_ASPECT_CLASS = "aspect-[4/5]";
export const COVER_HINT = "Bấm “Tải ảnh lên” rồi cắt khung 4:5: ảnh tự thu nhỏ còn 600 × 750 và 300 × 375 (WebP) và lưu trên Cloudflare. Dán link thì nên dùng ảnh 4:5, 600 × 750 px, dưới 150 KB.";

export const COVER_SIZES = { large: { width: 600, height: 750, maxBytes: 400_000 }, small: { width: 300, height: 375, maxBytes: 200_000 } } as const;

// Uploaded covers live at covers/<uuid>.<ext> with a small copy at covers/<uuid>-sm.<ext>.
const MANAGED = /\/covers\/([0-9a-f]{32})\.(webp|jpg)$/;

export function isManagedCover(url: string | null | undefined) {
  return !!url && MANAGED.test(url);
}

// <img> attributes for a cover: uploaded covers get a srcset so phones download the 300 px copy.
export function coverImageProps(url: string, sizes: string) {
  const match = url.match(MANAGED);
  if (!match) return { src: url, width: 600, height: 750 };
  const small = url.replace(MANAGED, `/covers/${match[1]}-sm.${match[2]}`);
  return { src: url, srcSet: `${small} 300w, ${url} 600w`, sizes, width: 600, height: 750 };
}
