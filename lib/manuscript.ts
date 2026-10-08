// Splits a whole manuscript (Word / Google Docs / Markdown / text) into chapters. Pure: runs in the browser
// before upload and in tests. Input is a list of paragraphs; Word/Markdown headings are passed as `heading`.

export type ManuscriptBlock = { text: string; heading?: number };
export type ManuscriptChapter = { number: number; title: string; paragraphs: string[]; words: number };
export type ManuscriptResult = { chapters: ManuscriptChapter[]; preamble: string[]; warnings: string[] };

export const MIN_CHAPTER_WORDS = 300;
const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

function romanToNumber(value: string) {
  const letters = value.toLowerCase().split("").map((letter) => ROMAN[letter]);
  if (letters.some((digit) => !digit)) return null;
  return letters.reduce((sum, digit, index) => sum + (digit < (letters[index + 1] ?? 0) ? -digit : digit), 0);
}

// Sentence case, the site convention for chapter titles ("BÁN VÀO ĐÔNG CUNG" → "Bán vào đông cung").
export function sentenceCase(value: string) {
  const lower = value.normalize("NFC").toLocaleLowerCase("vi");
  return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("vi"));
}

// "Chương 12: Tên", "CHƯƠNG XII - Tên", "Chapter 3. Tên", "Chương 5" → { number, title }.
// "Hồi N" only counts on a real heading line (Word heading / Markdown #): in prose "Hồi 5 tuổi…" means "back when".
// A normal paragraph only counts when it looks like a title: short, and not several sentences.
const HEADING = /^(chương|chuong|chapter|hồi|hoi)\s+(\d{1,5}|[ivxlcdm]{1,8})(?=$|[\s:：.\-–—)])\s*[:：.\-–—)]?\s*(.*)$/iu;

export function parseChapterHeading(line: string, isHeading = false) {
  const text = line.normalize("NFC").replace(/^[#*_\s]+|[*_\s]+$/g, "").trim();
  if (!text || text.length > 200) return null;
  const match = text.match(HEADING);
  if (!match) return null;
  if (!isHeading && (/^h/i.test(match[1]) || match[3].length > 120 || /[.!?…]["”’)]?\s+\p{Lu}/u.test(match[3]))) return null;
  match.splice(1, 1);
  const number = /^\d+$/.test(match[1]) ? Number(match[1]) : romanToNumber(match[1]);
  if (!number || number < 1) return null;
  const title = match[2].replace(/^[:：.\-–—\s]+/, "").trim();
  return { number, title: title ? sentenceCase(title).slice(0, 200) : "" };
}

const countWords = (paragraphs: string[]) => paragraphs.reduce((sum, paragraph) => sum + paragraph.split(/\s+/).filter(Boolean).length, 0);

export function splitManuscript(blocks: ManuscriptBlock[]): ManuscriptResult {
  const cleaned = blocks.map((block) => ({ ...block, text: block.text.normalize("NFC").replace(/ /g, " ").replace(/[ \t]+/g, " ").trim() })).filter((block) => block.text);
  const chapters: ManuscriptChapter[] = [];
  const preamble: string[] = [];
  const warnings: string[] = [];

  // Chapter lines ("Chương N …") are the boundaries. A document without them but with level-1 headings
  // (Word "Heading 1" / Markdown "#") is split on those headings, numbered in order.
  const byPattern = cleaned.some((block) => parseChapterHeading(block.text, !!block.heading));
  const topHeading = byPattern ? 0 : Math.min(...cleaned.filter((block) => block.heading).map((block) => block.heading!), Infinity);
  let current: ManuscriptChapter | null = null;
  for (const block of cleaned) {
    const parsed = byPattern ? parseChapterHeading(block.text, !!block.heading) : block.heading === topHeading ? { number: chapters.length + 1, title: sentenceCase(block.text).slice(0, 200) } : null;
    if (parsed) {
      current = { number: parsed.number, title: parsed.title, paragraphs: [], words: 0 };
      chapters.push(current);
    } else if (current) current.paragraphs.push(block.text);
    else preamble.push(block.text);
  }

  for (const chapter of chapters) {
    chapter.words = countWords(chapter.paragraphs);
    if (!chapter.title) chapter.title = `Chương ${chapter.number}`;
  }

  warnings.push(...chapterWarnings(chapters, preamble.length));
  return { chapters, preamble, warnings };
}

// Problems worth checking before upload: none found, duplicates, gaps, very short chapters, text before chapter 1.
export function chapterWarnings(chapters: { number: number; words: number }[], preambleCount: number) {
  const warnings: string[] = [];
  if (!chapters.length) warnings.push("Không tìm thấy tiêu đề chương nào. Mỗi chương cần bắt đầu bằng một dòng như “Chương 1: Tên chương”.");
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const chapter of chapters) (seen.has(chapter.number) ? duplicates : seen).add(chapter.number);
  if (duplicates.size) warnings.push(`Trùng số chương: ${[...duplicates].join(", ")}.`);
  const numbers = [...seen].sort((a, b) => a - b);
  const missing: number[] = [];
  for (let index = 1; index < numbers.length; index += 1) for (let n = numbers[index - 1] + 1; n < numbers[index] && missing.length < 20; n += 1) missing.push(n);
  if (missing.length) warnings.push(`Thiếu chương: ${missing.join(", ")}${missing.length >= 20 ? "…" : ""}.`);
  const short = chapters.filter((chapter) => chapter.words < MIN_CHAPTER_WORDS).map((chapter) => chapter.number);
  if (short.length) warnings.push(`Chương ngắn (dưới ${MIN_CHAPTER_WORDS} chữ, có thể tách nhầm): ${short.slice(0, 20).join(", ")}${short.length > 20 ? "…" : ""}.`);
  if (preambleCount) warnings.push(`Có ${preambleCount} đoạn trước chương đầu tiên (lời giới thiệu?) — phần này không được tải lên.`);
  return warnings;
}

// Text stored on R2, same layout as the existing files: "Chương N: Tên" on the first line, a blank line,
// then paragraphs separated by blank lines.
export function chapterFileText(chapter: { number: number; title: string; paragraphs: string[] }) {
  const heading = chapter.title && chapter.title !== `Chương ${chapter.number}` ? `Chương ${chapter.number}: ${chapter.title}` : `Chương ${chapter.number}`;
  return `${heading}\n\n${chapter.paragraphs.join("\n\n")}\n`;
}

// Markdown → blocks: "#" headings keep their level, inline formatting and links are reduced to plain text.
// Every non-empty line is its own paragraph (manuscripts often have one paragraph per line, dialogue included).
export function markdownBlocks(markdown: string): ManuscriptBlock[] {
  // Escaped characters (\*, \_ …) are parked in private-use code points while formatting marks are stripped.
  const plain = (line: string) => line
    .replace(/\\([\\`*_{}[\]()#+\-.!~>])/g, (_, char: string) => String.fromCharCode(0xe000 + char.charCodeAt(0)))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|~~|`)/g, "").replace(/(^|\s)_(\S[^_]*\S|\S)_(?=\s|$|[.,!?])/g, "$1$2").replace(/^>\s?/, "")
    .replace(/[\ue000-\ue0ff]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xe000)).trim();
  const blocks: ManuscriptBlock[] = [];
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) blocks.push({ text: plain(heading[2]), heading: heading[1].length });
    else if (raw.trim() && !/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) blocks.push({ text: plain(raw) });
  }
  return blocks;
}

// Plain text → blocks: every non-empty line is a paragraph (novels usually put one paragraph per line).
export function textBlocks(text: string): ManuscriptBlock[] {
  return text.replace(/\r\n?/g, "\n").split("\n").map((line) => ({ text: line }));
}

// "Chương 12.docx", "chuong-012.md", "12 - Tên.txt" → 12 (used when a file holds one chapter without a heading line).
export function chapterNumberFromName(name: string) {
  const base = name.normalize("NFC").replace(/\.[^.]+$/, "");
  const match = base.match(/(?:chương|chuong|chapter|ch)\s*[-_.]?\s*0*(\d{1,5})/iu) ?? base.match(/^\s*0*(\d{1,5})(?!\d)/);
  return match ? Number(match[1]) : null;
}

// Which story a file belongs to when many files are uploaded together:
// - inside a folder → the folder name ("Thủ khoa xuyên sách/Chương 1.md");
// - "Tên truyện - Quyển 2.docx" / "… Tập 3" / "… Phần 1" / "… Chương 5" → "Tên truyện", ordered by that number;
// - otherwise the file name itself is the story title.
export function fileStoryInfo(name: string, path = "") {
  const parts = path.normalize("NFC").split("/").filter(Boolean);
  const base = name.normalize("NFC").replace(/\.[^.]+$/, "").trim();
  const suffix = base.match(/^(.*?)\s*[-–—_:,]?\s*(?<![\p{L}\p{N}])(?:quyển|quyen|tập|tap|phần|phan|chương|chuong|volume|vol|part)\s*\.?\s*0*(\d{1,5}|[ivxlcdm]{1,8})\s*$/iu);
  const order = suffix ? (/^\d+$/.test(suffix[2]) ? Number(suffix[2]) : romanToNumber(suffix[2]) ?? 0) : chapterNumberFromName(name) ?? 0;
  if (parts.length >= 2) return { title: parts[parts.length - 2].trim(), order };
  if (suffix && suffix[1].trim()) return { title: suffix[1].replace(/[-–—_:,\s]+$/, "").trim(), order };
  return { title: chapterNumberFromName(name) !== null && /^(chương|chuong|chapter|\d)/iu.test(base) ? "" : base, order };
}
