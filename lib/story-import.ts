export const storyImportHeaders = [
  "title",
  "author",
  "description",
  "cover_url",
  "audio_url",
  "status",
  "genres",
  "chapter_number",
  "chapter_title",
  "text_url",
  "lock_from_chapter",
  "lock_price_coins",
] as const;

const requiredHeaders = ["title", "author", "chapter_number", "chapter_title", "text_url"] as const;
const statuses = new Set(["Đang ra", "Hoàn thành", "Tạm dừng"]);

type ImportRow = {
  line: number;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  audio_url: string;
  status: "Đang ra" | "Hoàn thành" | "Tạm dừng";
  genres: string[];
  chapter_number: number;
  chapter_title: string;
  text_url: string;
  lock_from_chapter: string;
  lock_price_coins: string;
};

export type StoryImportResult = {
  rows: ImportRow[];
  errors: string[];
};

export function parseCsvRecords(value: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === '"') {
      if (quoted && next === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((item) => item.trim())) records.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error("File CSV có dấu ngoặc kép chưa đóng.");
  if (cell || row.length) { row.push(cell); if (row.some((item) => item.trim())) records.push(row); }
  return records;
}

function validUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}

export function parseStoryImportCsv(input: string): StoryImportResult {
  const errors: string[] = [];
  const records = parseCsvRecords(input.replace(/^﻿/, ""));
  if (!records.length) return { rows: [], errors: ["File CSV không có dữ liệu."] };
  const headers = records[0].map((header) => header.trim().toLowerCase());
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) return { rows: [], errors: [`Thiếu cột bắt buộc: ${missing.join(", ")}.`] };
  const positions = new Map(headers.map((header, index) => [header, index]));
  const rows: ImportRow[] = [];
  const chapterKeys = new Set<string>();
  records.slice(1).forEach((record, offset) => {
    const line = offset + 2;
    const get = (name: string) => (record[positions.get(name) ?? -1] ?? "").trim();
    const title = get("title");
    const author = get("author");
    const chapterTitle = get("chapter_title");
    const numberValue = get("chapter_number");
    const number = Number(numberValue);
    const textUrl = get("text_url");
    const statusValue = get("status") || "Đang ra";
    const rowErrors: string[] = [];
    if (!title) rowErrors.push("thiếu title");
    if (!author) rowErrors.push("thiếu author");
    if (!chapterTitle) rowErrors.push("thiếu chapter_title");
    if (!Number.isInteger(number) || number < 1) rowErrors.push("chapter_number phải là số nguyên dương");
    if (!validUrl(textUrl)) rowErrors.push("text_url phải là URL http(s)");
    if (get("cover_url") && !validUrl(get("cover_url"))) rowErrors.push("cover_url phải là URL http(s)");
    if (get("audio_url") && !validUrl(get("audio_url"))) rowErrors.push("audio_url phải là URL http(s)");
    if (!statuses.has(statusValue)) rowErrors.push("status không hợp lệ");
    const key = `${title.toLocaleLowerCase()}::${number}`;
    if (chapterKeys.has(key)) rowErrors.push("trùng chapter_number trong cùng truyện");
    if (rowErrors.length) { errors.push(`Dòng ${line}: ${rowErrors.join(", ")}.`); return; }
    chapterKeys.add(key);
    const genres = get("genres").split(/[|;]/).map((genre) => genre.trim()).filter(Boolean);
    rows.push({ line, title, author, description: get("description"), cover_url: get("cover_url"), audio_url: get("audio_url"), status: statusValue as ImportRow["status"], genres, chapter_number: number, chapter_title: chapterTitle, text_url: textUrl, lock_from_chapter: get("lock_from_chapter"), lock_price_coins: get("lock_price_coins") });
  });
  return { rows, errors };
}

const sampleBase = "https://pub-538f59c74bd24ae1b59dae832ad0c09b.r2.dev";

// Sample with several multi-chapter stories: one row per chapter, rows sharing a title form one story.
// Story details (description, cover, audio, status, genres, lock settings) are read from the story's first row.
// The first sample story locks from chapter 4 at 3 Xu per chapter.
const storyImportSample: string[][] = [
  ["Thiên Đạo Đồ Thư Quán", "Nhậm Tử Vân", "Lâm Phong tình cờ trở thành thủ thư của thư viện huyền bí, nơi chứa mọi bí mật của thiên địa.", `${sampleBase}/thien-dao-do-thu-quan/cover.jpg`, "", "Đang ra", "Tiên Hiệp|Tu Tiên", "1", "Thư Viện Bí Ẩn", `${sampleBase}/thien-dao-do-thu-quan/chuong-1.txt`, "4", "3"],
  ["Thiên Đạo Đồ Thư Quán", "Nhậm Tử Vân", "", "", "", "", "", "2", "Thiên Đạo Hiển Linh", `${sampleBase}/thien-dao-do-thu-quan/chuong-2.txt`, "", ""],
  ["Thiên Đạo Đồ Thư Quán", "Nhậm Tử Vân", "", "", "", "", "", "3", "Thần Ý Giáng Lâm", `${sampleBase}/thien-dao-do-thu-quan/chuong-3.txt`, "", ""],
  ["Thiên Đạo Đồ Thư Quán", "Nhậm Tử Vân", "", "", "", "", "", "4", "Vô Cực Chi Đạo", `${sampleBase}/thien-dao-do-thu-quan/chuong-4.txt`, "", ""],
  ["Thiên Đạo Đồ Thư Quán", "Nhậm Tử Vân", "", "", "", "", "", "5", "Hỗn Độn Chi Lực", `${sampleBase}/thien-dao-do-thu-quan/chuong-5.txt`, "", ""],
  ["Kiếm Lai Phong Vân", "Mạc Mặc", "Thiếu niên gánh kiếm rời trấn nhỏ, bước vào giang hồ đầy sóng gió.", `${sampleBase}/kiem-lai-phong-van/cover.jpg`, "https://me-nghe-truyen.vercel.app/truyen/kiem-lai-phong-van", "Hoàn thành", "Kiếm Hiệp|Huyền Huyễn", "1", "Rời Trấn Nhỏ", `${sampleBase}/kiem-lai-phong-van/chuong-1.txt`, "", ""],
  ["Kiếm Lai Phong Vân", "Mạc Mặc", "", "", "", "", "", "2", "Gặp Gỡ Kiếm Khách", `${sampleBase}/kiem-lai-phong-van/chuong-2.txt`, "", ""],
  ["Kiếm Lai Phong Vân", "Mạc Mặc", "", "", "", "", "", "3", "Đại Chiến Lạc Nhật Cốc", `${sampleBase}/kiem-lai-phong-van/chuong-3.txt`, "", ""],
  ["Tổng Tài, Xin Đừng Đi", "Dạ Hành Nguyệt", "Một hợp đồng hôn nhân, hai con người, và những bí mật chưa từng nói ra.", `${sampleBase}/tong-tai-xin-dung-di/cover.jpg`, "", "Tạm dừng", "Ngôn Tình|Đô Thị", "1", "Hợp Đồng Hôn Nhân", `${sampleBase}/tong-tai-xin-dung-di/chuong-1.txt`, "", ""],
  ["Tổng Tài, Xin Đừng Đi", "Dạ Hành Nguyệt", "", "", "", "", "", "2", "Bữa Tiệc Định Mệnh", `${sampleBase}/tong-tai-xin-dung-di/chuong-2.txt`, "", ""],
];

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function storyImportTemplate() {
  return [storyImportHeaders as readonly string[], ...storyImportSample].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export type { ImportRow };
