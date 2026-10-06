export type StoryStatus = "Đang ra" | "Hoàn thành" | "Tạm dừng";

export type Chapter = {
  id?: string;
  chapter_number: number;
  title: string;
  text_url: string;
  created_at?: string;
};

export type Story = {
  id?: string;
  slug: string;
  title: string;
  author: string;
  genres: string[];
  description: string;
  cover_url?: string | null;
  status: StoryStatus;
  audio_url?: string | null;
  chapters: Chapter[];
  updated_at?: string;
};

export const defaultAudioSiteUrl = "https://me-nghe-truyen.vercel.app";

export function storySlug(title: string) {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function validTextUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}
