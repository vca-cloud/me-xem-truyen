// Story search shared by the header and /tim-kiem (pure, client + server).
// Matching ignores case and Vietnamese diacritics: "co dai" finds "Cổ Đại", "nguyet" finds "Nguyệt".

export type SearchableStory = { slug: string; title: string; author: string; genres: string[]; status: string; chapter_count: number; created_at: string; updated_at: string; views?: number };
export type SearchSort = "cap-nhat" | "moi-dang" | "luot-xem" | "nhieu-chuong" | "ten";
export type GenreMode = "tat-ca" | "mot-trong";
// Filter state of /tim-kiem; genres are genre slugs.
export type SearchState = { q: string; genres: string[]; mode: GenreMode; status: string; sort: SearchSort; length: string };

// Story length filter (number of chapters): "duoi-N" = fewer than N, "tu-500" = 500 or more.
export const lengthOptions = [
  { value: "", label: "Mọi độ dài" },
  { value: "duoi-10", label: "Dưới 10 chương" },
  { value: "duoi-50", label: "Dưới 50 chương" },
  { value: "duoi-100", label: "Dưới 100 chương" },
  { value: "duoi-500", label: "Dưới 500 chương" },
  { value: "tu-500", label: "Từ 500 chương trở lên" },
] as const;

export function matchesLength(chapters: number, length: string) {
  const under = length.match(/^duoi-(\d+)$/);
  if (under) return chapters < Number(under[1]);
  const from = length.match(/^tu-(\d+)$/);
  if (from) return chapters >= Number(from[1]);
  return true;
}

export const sortOptions: { value: SearchSort; label: string }[] = [
  { value: "cap-nhat", label: "Mới cập nhật" },
  { value: "moi-dang", label: "Mới đăng" },
  { value: "luot-xem", label: "Nhiều lượt xem" },
  { value: "nhieu-chuong", label: "Nhiều chương" },
  { value: "ten", label: "Tên A → Z" },
];

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
}

// Every word of the query must appear in the title, author or genre names.
export function matchesQuery(story: SearchableStory, query: string) {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeSearch(`${story.title} ${story.author} ${story.genres.join(" ")}`);
  return words.every((word) => haystack.includes(word));
}

export function searchStories<T extends SearchableStory>(stories: T[], options: { q?: string; genres?: string[]; mode?: GenreMode; status?: string; sort?: SearchSort; length?: string }) {
  const wanted = (options.genres ?? []).map(normalizeSearch);
  const result = stories.filter((story) => {
    if (options.q && !matchesQuery(story, options.q)) return false;
    if (options.status && story.status !== options.status) return false;
    if (options.length && !matchesLength(story.chapter_count, options.length)) return false;
    if (wanted.length) {
      const has = new Set(story.genres.map(normalizeSearch));
      if (options.mode === "mot-trong" ? !wanted.some((genre) => has.has(genre)) : !wanted.every((genre) => has.has(genre))) return false;
    }
    return true;
  });
  const sort = options.sort ?? "cap-nhat";
  return result.sort((a, b) =>
    sort === "moi-dang" ? b.created_at.localeCompare(a.created_at)
      : sort === "luot-xem" ? (b.views ?? 0) - (a.views ?? 0)
      : sort === "nhieu-chuong" ? b.chapter_count - a.chapter_count
        : sort === "ten" ? a.title.localeCompare(b.title, "vi")
          : b.updated_at.localeCompare(a.updated_at));
}

export function searchHref(state: SearchState, page = 1) {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.genres.length) params.set("the_loai", state.genres.join(","));
  if (state.genres.length > 1 && state.mode !== "tat-ca") params.set("che_do", state.mode);
  if (state.status) params.set("trang_thai", state.status);
  if (state.length) params.set("so_chuong", state.length);
  if (state.sort !== "cap-nhat") params.set("sap_xep", state.sort);
  if (page > 1) params.set("trang", String(page));
  const query = params.toString();
  return query ? `/tim-kiem?${query}` : "/tim-kiem";
}
