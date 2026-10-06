import type { AdminGenre } from "@/lib/admin-data";

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

export const fallbackGenres: AdminGenre[] = [
  { name: "Tiên Hiệp", slug: "tien-hiep", stories: 284, views: "1.2M", color: "bg-violet-100 text-violet-700" },
  { name: "Huyền Huyễn", slug: "huyen-huyen", stories: 241, views: "980K", color: "bg-blue-100 text-blue-700" },
  { name: "Ngôn Tình", slug: "ngon-tinh", stories: 198, views: "864K", color: "bg-pink-100 text-pink-700" },
  { name: "Kiếm Hiệp", slug: "kiem-hiep", stories: 156, views: "532K", color: "bg-amber-100 text-amber-700" },
  { name: "Đô Thị", slug: "do-thi", stories: 143, views: "498K", color: "bg-emerald-100 text-emerald-700" },
];

export const fallbackStory: Story = {
  slug: "thien-dao-do-thu-quan",
  title: "Thiên Đạo Đồ Thư Quán",
  author: "Nhậm Tử Vân",
  genres: ["Tiên Hiệp", "Tu Tiên"],
  description: "Thiên Đạo Đồ Thư Quán — câu chuyện về Lâm Phong, một thanh niên bình thường tình cờ trở thành thủ thư của thư viện huyền bí nằm ngoài vũ trụ. Nơi đây chứa đựng mọi bí mật của thiên địa, mọi công pháp tu luyện từ ngàn xưa đến nay.\n\nTừ một kẻ không có thiên phú, Lâm Phong dần khám phá sức mạnh tiềm ẩn trong bản thân và bí mật của Thiên Đạo.",
  status: "Đang ra",
  audio_url: null,
  chapters: Array.from({ length: 12 }, (_, index) => {
    const number = 3421 - index;
    return { chapter_number: number, title: ["Thiên Đạo Hiển Linh", "Thần Ý Giáng Lâm", "Vô Cực Chi Đạo", "Hỗn Độn Chi Lực", "Kiếm Phá Hư Không", "Nguyên Thủy Công Pháp", "Lôi Phong Hội Tụ", "Đại Đạo Tranh Phong", "Cổ Thần Giác Tỉnh", "Tiên Cổ Bí Tích", "Bí Ẩn Thư Viện", "Đạo Tâm Kiên Cường"][index], text_url: `https://pub-538f59c74bd24ae1b59dae832ad0c09b.r2.dev/thien-dao-do-thu-quan/chuong-${number}.txt` };
  }),
};

export function storySlug(title: string) {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function validTextUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}
