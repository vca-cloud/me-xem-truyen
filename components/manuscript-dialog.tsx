"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, FolderOpen, ImagePlus, Link2, ListOrdered, Upload, X } from "lucide-react";
import { CoverUploader } from "@/components/cover-uploader";
import { GenreCombobox } from "@/components/genre-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chapterFileText, chapterNumberFromName, chapterWarnings, fileStoryInfo, markdownBlocks, splitManuscript, textBlocks, type ManuscriptBlock, type ManuscriptChapter } from "@/lib/manuscript";
import { COVER_HINT } from "@/lib/cover";
import { storySlug } from "@/lib/story-data";

export type ManuscriptTarget = { id: string; title: string; lock_from_chapter: number | null; cover_url?: string | null };
type SourceFile = { id: string; name: string; path: string; chapters: ManuscriptChapter[]; preamble: number; order: number };
type GroupMeta = { title: string; target: string; author: string; status: string; genres: string[]; free: boolean; include: boolean; cover: string };
type Edit = { title?: string; include?: boolean; number?: number };
type Row = { key: string; number: number; title: string; paragraphs: string[]; words: number; include: boolean; file: string };
type Result = { number: number; status: "added" | "skipped" | "error"; message?: string; flagged?: boolean; publish_status?: string };
type GroupResult = { title: string; results: Result[]; error?: string };

const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const BATCH_CHAPTERS = 50;
const BATCH_CHARS = 1_200_000;
const NEW = "new";
const SPLIT = "__split__";
const statuses = ["Đang ra", "Hoàn thành", "Tạm dừng"];
const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const accepted = new Set(["docx", "pages", "md", "markdown", "txt"]);
const ACCEPT = ".docx,.pages,.md,.markdown,.txt";

// .txt may be UTF-8 (with or without BOM), UTF-16, or an old Windows Vietnamese code page.
function decodeText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""); } catch { return new TextDecoder("windows-1258").decode(bytes); }
}

// Word (.docx, also what Google Docs exports): converted to HTML by mammoth, keeping Heading 1–6 as h1–h6.
async function docxBlocks(buffer: ArrayBuffer): Promise<ManuscriptBlock[]> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const doc = new DOMParser().parseFromString(value, "text/html");
  return [...doc.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li")]
    .filter((element) => !(element.tagName === "P" && element.closest("li")))
    .map((element) => /^H\d$/.test(element.tagName) ? { text: element.textContent ?? "", heading: Number(element.tagName[1]) } : { text: element.textContent ?? "" });
}

// Apple Pages (.pages): unzip and read the body text from Index/Document.iwa (lib/pages.ts).
async function pagesBlocks(buffer: ArrayBuffer): Promise<ManuscriptBlock[]> {
  const [{ default: JSZip }, { pagesParagraphs }] = await Promise.all([import("jszip"), import("@/lib/pages")]);
  const zip = await JSZip.loadAsync(buffer).catch(() => null);
  const document = zip?.file("Index/Document.iwa");
  if (!document) throw new Error("pages-format");
  return pagesParagraphs(await document.async("uint8array")).map((text) => ({ text }));
}

// Files and folders dropped on the dialog (folders are walked recursively, keeping "Folder/sub/file" paths).
async function droppedFiles(items: DataTransferItemList) {
  const out: { file: File; path: string }[] = [];
  const walk = async (entry: FileSystemEntry | null, prefix: string): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push({ file, path: `${prefix}${file.name}` });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  await Promise.all([...items].map((item) => walk(item.webkitGetAsEntry?.() ?? null, "")));
  return out;
}

async function send(url: string, body: unknown) {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: response.ok, body: await response.json().catch(() => ({})) as Record<string, unknown> };
  } catch {
    return { ok: false, body: { error: "Lỗi kết nối đến server." } as Record<string, unknown> };
  }
}

// Upload manuscripts (.docx / Google Docs / .md / .txt), one or many files at once. Files are split into chapters in
// the browser and grouped into stories (folder name, "Tên truyện - Quyển N", or one story per file); each group can be
// a new story or added to an existing one. Chapters are stored as "<Tên truyện>/Chương N.txt" on R2 in batches.
// Author mode: every file goes into the given story (author publishing rules apply on the server).
export function ManuscriptDialog({ open, onOpenChange, mode, stories = [], story, existingNumbers, catalog = [], onDone }: {
  open: boolean; onOpenChange: (open: boolean) => void; mode: "admin" | "author";
  stories?: ManuscriptTarget[]; story?: ManuscriptTarget; existingNumbers?: number[]; catalog?: string[]; onDone: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<"file" | "link">("file");
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [groupOf, setGroupOf] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, GroupMeta>>({});
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [existingByStory, setExistingByStory] = useState<Record<string, number[]>>(story ? { [story.id]: existingNumbers ?? [] } : {});
  const [common, setCommon] = useState({ author: "", genres: [] as string[], free: story ? story.lock_from_chapter === null : true });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; group: string } | null>(null);
  const [results, setResults] = useState<GroupResult[] | null>(null);
  const totalBytes = useRef(0);

  const storyBySlug = useMemo(() => new Map(stories.map((item) => [storySlug(item.title), item])), [stories]);

  // Stories as currently grouped: files ordered by volume/chapter number, chapters concatenated, edits applied.
  const groups = useMemo(() => {
    // Stories ordered by the title they were detected with (stable while a title is being edited);
    // files without a recognisable story title ("Truyện mới") last.
    const keys = [...new Set(files.map((file) => groupOf[file.id]))].filter((key) => meta[key])
      .sort((a, b) => Number(a === "t:khong-ten") - Number(b === "t:khong-ten") || a.localeCompare(b, "vi", { numeric: true }));
    return keys.map((key) => {
      const members = files.filter((file) => groupOf[file.id] === key).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "vi", { numeric: true }));
      const settings = meta[key];
      const targetId = mode === "author" ? story!.id : settings.target === NEW ? null : settings.target;
      const existing = new Set(targetId ? existingByStory[targetId] ?? [] : []);
      const rows: Row[] = members.flatMap((file) => file.chapters.map((chapter, index) => {
        const rowKey = `${file.id}#${index}`;
        const edit = edits[rowKey] ?? {};
        return { key: rowKey, number: edit.number ?? chapter.number, title: edit.title ?? chapter.title, paragraphs: chapter.paragraphs, words: chapter.words, include: edit.include ?? true, file: file.name };
      }));
      const warnings = chapterWarnings(rows, members.reduce((sum, file) => sum + file.preamble, 0));
      if (!targetId && settings.include && storyBySlug.has(storySlug(settings.title))) warnings.unshift("Đã có truyện trùng tên trên web — chọn “Thêm vào truyện có sẵn” hoặc đổi tên.");
      const upload = rows.filter((row) => row.include && !existing.has(row.number));
      const duplicated = new Set(rows.map((row) => row.number)).size !== rows.length;
      return { key, members, settings, targetId, existing, rows, upload, warnings, duplicated };
    });
  }, [files, groupOf, meta, edits, existingByStory, mode, story, storyBySlug]);

  const toUpload = groups.filter((group) => group.settings.include).reduce((sum, group) => sum + group.upload.length, 0);

  function reset() {
    setFiles([]); setGroupOf({}); setMeta({}); setEdits({}); setResults(null); setProgress(null); setLink(""); setExpanded(null);
    totalBytes.current = 0;
    if (fileInput.current) fileInput.current.value = "";
    if (folderInput.current) folderInput.current.value = "";
  }

  async function loadExisting(storyId: string) {
    if (existingByStory[storyId]) return;
    try {
      const body = await (await fetch(`/api/admin/stories/${storyId}/chapters`)).json();
      setExistingByStory((current) => ({ ...current, [storyId]: (body.chapters ?? []).map((chapter: { chapter_number: number }) => chapter.chapter_number) }));
    } catch {
      setExistingByStory((current) => ({ ...current, [storyId]: [] }));
    }
  }

  // Adds parsed files and puts each into its story group (creating the group with defaults the first time).
  function addParsed(parsed: { name: string; path: string; blocks: ManuscriptBlock[] }[]) {
    const nextFiles: SourceFile[] = [];
    const nextGroupOf: Record<string, string> = {};
    const nextMeta: Record<string, GroupMeta> = {};
    for (const item of parsed) {
      let result = splitManuscript(item.blocks);
      // A file holding a single chapter without a "Chương N" line: number it from the file name.
      const fromName = chapterNumberFromName(item.name);
      if (!result.chapters.length && fromName) result = splitManuscript([{ text: `Chương ${fromName}`, heading: 1 }, ...item.blocks]);
      const info = fileStoryInfo(item.name, item.path);
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      nextFiles.push({ id, name: item.name, path: item.path, chapters: result.chapters, preamble: result.preamble.length, order: info.order });
      const key = mode === "author" ? "story" : `t:${storySlug(info.title) || "khong-ten"}`;
      nextGroupOf[id] = key;
      if (!meta[key] && !nextMeta[key]) {
        const match = storyBySlug.get(storySlug(info.title));
        if (match) void loadExisting(match.id);
        nextMeta[key] = { title: info.title || "Truyện mới", target: mode === "author" ? story!.id : match?.id ?? NEW, author: "", status: "Đang ra", genres: [], free: match ? match.lock_from_chapter === null : common.free, include: true, cover: match?.cover_url ?? "" };
      }
    }
    setFiles((current) => [...current, ...nextFiles]);
    setGroupOf((current) => ({ ...current, ...nextGroupOf }));
    setMeta((current) => ({ ...nextMeta, ...current }));
  }

  async function readFiles(list: { file: File; path: string }[]) {
    const usable = list.filter(({ file }) => accepted.has(extensionOf(file.name)) && !file.name.startsWith("."));
    const skipped = list.length - usable.length;
    if (!usable.length) return toast.error("Không có file .docx, .pages, .md hoặc .txt nào. File Word cũ (.doc): lưu lại thành .docx trước.");
    if (files.length + usable.length > MAX_FILES) return toast.error(`Tối đa ${MAX_FILES} file mỗi lần.`);
    const bytes = usable.reduce((sum, { file }) => sum + file.size, 0);
    if (totalBytes.current + bytes > MAX_TOTAL_BYTES) return toast.error("Tổng dung lượng tối đa 100 MB mỗi lần.");
    setReading(true);
    const parsed: { name: string; path: string; blocks: ManuscriptBlock[] }[] = [];
    const failed: string[] = [];
    for (const { file, path } of usable) {
      try {
        const buffer = await file.arrayBuffer();
        const extension = extensionOf(file.name);
        parsed.push({ name: file.name, path, blocks: extension === "docx" ? await docxBlocks(buffer) : extension === "pages" ? await pagesBlocks(buffer) : extension === "txt" ? textBlocks(decodeText(buffer)) : markdownBlocks(decodeText(buffer)) });
      } catch (error) {
        failed.push(error instanceof Error && error.message === "pages-format" ? `${file.name} (bản Pages cũ: mở bằng Pages rồi lưu lại)` : file.name);
      }
    }
    totalBytes.current += bytes;
    addParsed(parsed);
    setReading(false);
    if (failed.length) toast.error(`Không đọc được: ${failed.join(", ")}`);
    if (skipped) toast.message(`Bỏ qua ${skipped} file không phải .docx/.pages/.md/.txt.`);
  }

  async function readLink() {
    if (!link.trim()) return;
    setReading(true);
    try {
      const response = await fetch(`/api/manuscript/google-doc?url=${encodeURIComponent(link.trim())}`);
      if (!response.ok) throw new Error(String((await response.json().catch(() => ({}))).error ?? "Không lấy được tài liệu."));
      addParsed([{ name: "Google Docs.docx", path: "", blocks: await docxBlocks(await response.arrayBuffer()) }]);
      setLink("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lấy được tài liệu.");
    } finally {
      setReading(false);
    }
  }

  // Moves a file to another story (or into a story of its own), then opens that story so the move is visible.
  function moveFile(fileId: string, key: string) {
    const file = files.find((item) => item.id === fileId);
    if (!file || key === groupOf[fileId]) return;
    let title = meta[key]?.title;
    if (key === SPLIT) {
      const own = `f:${fileId}`;
      title = file.name.replace(/\.[^.]+$/, "");
      setMeta((current) => ({ ...current, [own]: { title: title!, target: NEW, author: "", status: "Đang ra", genres: [], free: common.free, include: true, cover: "" } }));
      key = own;
    }
    setGroupOf((current) => ({ ...current, [fileId]: key }));
    setExpanded(key);
    toast.success(`Đã chuyển “${file.name}” sang “${title || "truyện mới"}”.`);
  }

  const updateMeta = (key: string, patch: Partial<GroupMeta>) => setMeta((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  const editRow = (rowKey: string, patch: Edit) => setEdits((current) => ({ ...current, [rowKey]: { ...current[rowKey], ...patch } }));

  // Volumes that restart at "Chương 1": number the whole group in order, continuing after the story's last chapter.
  function renumber(group: (typeof groups)[number]) {
    let next = Math.max(0, ...group.existing) + 1;
    setEdits((current) => {
      const updated = { ...current };
      for (const row of group.rows) updated[row.key] = { ...updated[row.key], number: next++ };
      return updated;
    });
  }

  async function upload() {
    const work = groups.filter((group) => group.settings.include && group.upload.length);
    if (!work.length) return;
    for (const group of work) if (!group.targetId && (!group.settings.title.trim() || !(group.settings.author.trim() || common.author.trim()))) return toast.error(`Truyện “${group.settings.title || "chưa đặt tên"}”: cần tên truyện và tác giả.`);
    const all: GroupResult[] = [];
    let done = 0;
    const total = work.reduce((sum, group) => sum + group.upload.length, 0);
    for (const group of work) {
      const title = group.settings.title.trim();
      setProgress({ done, total, group: title });
      let id = group.targetId;
      if (!id) {
        const created = await send("/api/admin/stories", { title, author: group.settings.author.trim() || common.author.trim(), status: group.settings.status, genres: group.settings.genres.length ? group.settings.genres : common.genres, description: "", cover_url: group.settings.cover, chapters: [] });
        if (!created.ok) { all.push({ title, results: [], error: String(created.body.error ?? "Không tạo được truyện.") }); done += group.upload.length; continue; }
        id = String((created.body.story as { id: string }).id);
      }
      // Existing story whose cover was changed here: save the new cover (the old uploaded one is removed on the server).
      const before = stories.find((item) => item.id === group.targetId)?.cover_url ?? "";
      if (mode === "admin" && group.targetId && group.settings.cover !== before) {
        const response = await fetch(`/api/admin/stories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cover_url: group.settings.cover }) }).catch(() => null);
        if (!response?.ok) toast.error(`Không lưu được ảnh bìa cho “${title}”.`);
      }
      const endpoint = mode === "admin" ? `/api/admin/stories/${id}/manuscript` : `/api/author/stories/${id}/manuscript`;
      const batches: Row[][] = [];
      let batch: Row[] = [];
      let chars = 0;
      for (const row of group.upload) {
        const size = row.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
        if (batch.length && (batch.length >= BATCH_CHAPTERS || chars + size > BATCH_CHARS)) { batches.push(batch); batch = []; chars = 0; }
        batch.push(row); chars += size;
      }
      if (batch.length) batches.push(batch);
      const collected: Result[] = [];
      for (const [index, items] of batches.entries()) {
        const { ok, body } = await send(endpoint, { free: index === 0 && group.settings.free, chapters: items.map((row) => ({ number: row.number, title: row.title.trim(), content: chapterFileText({ number: row.number, title: row.title.trim() || `Chương ${row.number}`, paragraphs: row.paragraphs }) })) });
        if (ok) collected.push(...(body.results as Result[]));
        else collected.push(...items.map((row) => ({ number: row.number, status: "error" as const, message: String(body.error ?? "Lỗi máy chủ.") })));
        done += items.length;
        setProgress({ done, total, group: title });
      }
      all.push({ title, results: collected });
    }
    setResults(all);
    setProgress(null);
    onDone();
    const added = all.reduce((sum, group) => sum + group.results.filter((item) => item.status === "added").length, 0);
    if (added) toast.success(`Đã tải ${added} chương lên.`);
  }

  const busy = reading || !!progress;
  const groupOptions = groups.map((group) => ({ value: group.key, label: group.settings.title || "Chưa đặt tên" }));

  return <Dialog open={open} onOpenChange={(value) => { if (busy) return; if (!value) reset(); onOpenChange(value); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
      onDragOver={(event) => { if (!results && !busy) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (event) => { if (results || busy) return; event.preventDefault(); setDragging(false); await readFiles(await droppedFiles(event.dataTransfer.items)); }}>
      <DialogHeader>
        <DialogTitle>Tải bản thảo{story ? `: ${story.title}` : ""}</DialogTitle>
        <DialogDescription>Một hoặc nhiều file (.docx, .pages, Google Docs, .md, .txt), có thể kéo thả cả thư mục. Hệ thống tự tìm dòng “Chương N: Tên chương”, {mode === "admin" ? "gom file theo truyện (thư mục, hoặc tên “Tên truyện - Quyển N”), " : "gộp tất cả vào truyện này, "}tách từng chương thành file .txt và lưu lên Cloudflare theo thư mục tên truyện.</DialogDescription>
      </DialogHeader>

      {results ? <div className="space-y-3">
        {results.map((group) => {
          const added = group.results.filter((item) => item.status === "added");
          const problems = group.results.filter((item) => item.status !== "added");
          return <div key={group.title} className="rounded-md border p-3 text-sm">
            <p className="font-semibold">{group.title}: {group.error ? <span className="text-destructive">{group.error}</span> : `đã tải ${added.length}/${group.results.length} chương`}</p>
            {mode === "author" && added.some((item) => item.publish_status === "submitted") && <p className="text-muted-foreground">{added.filter((item) => item.publish_status === "submitted").length} chương chờ admin duyệt trước khi đăng.</p>}
            {added.some((item) => item.flagged) && <p className="text-muted-foreground">{added.filter((item) => item.flagged).length} chương có từ cần kiểm duyệt (quảng cáo tạm tắt).</p>}
            {problems.length > 0 && <div className="mt-1 max-h-32 overflow-y-auto">{problems.map((item) => <p key={item.number} className={item.status === "error" ? "text-destructive" : "text-muted-foreground"}>Chương {item.number}: {item.message}</p>)}</div>}
          </div>;
        })}
        <DialogFooter><Button type="button" onClick={() => { reset(); onOpenChange(false); }}>Xong</Button></DialogFooter>
      </div> : <div className="space-y-4">
        <Tabs value={source} onValueChange={(value) => setSource(value as "file" | "link")}><TabsList className="w-full"><TabsTrigger value="file"><FileText />Tải file / thư mục</TabsTrigger><TabsTrigger value="link"><Link2 />Link Google Docs</TabsTrigger></TabsList></Tabs>
        {source === "file" ? <div className={`rounded-lg border border-dashed p-5 text-center transition-colors ${dragging ? "border-highlight bg-highlight/5" : ""}`}>
          <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(event) => { void readFiles([...(event.target.files ?? [])].map((file) => ({ file, path: "" }))); event.target.value = ""; }} />
          <input ref={folderInput} type="file" multiple className="hidden" {...{ webkitdirectory: "" }} onChange={(event) => { void readFiles([...(event.target.files ?? [])].map((file) => ({ file, path: file.webkitRelativePath }))); event.target.value = ""; }} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload />{reading ? "Đang đọc file..." : files.length ? "Thêm file" : "Chọn file"}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => folderInput.current?.click()}><FolderOpen />Chọn thư mục</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Hoặc kéo thả file / thư mục vào đây. .docx, .pages, .md, .txt — tối đa {MAX_FILES} file, 100 MB mỗi lần. Google Docs: Tệp → Tải xuống → Microsoft Word (.docx).</p>
        </div> : <Field>
          <FieldLabel htmlFor="gdoc-link">Link Google Docs</FieldLabel>
          <div className="flex gap-2"><Input id="gdoc-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://docs.google.com/document/d/…" /><Button type="button" disabled={busy || !link.trim()} onClick={readLink}>{reading ? "Đang lấy..." : "Lấy nội dung"}</Button></div>
          <FieldDescription>Tài liệu phải bật chia sẻ “Bất kỳ ai có đường liên kết đều xem được”. Tài liệu rất dài (trên 4 MB) thì tải file .docx về rồi tải lên.</FieldDescription>
        </Field>}

        {groups.length > 0 && <>
          {mode === "admin" && <div className="grid gap-3 rounded-md bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field><FieldLabel htmlFor="ms-common-author">Tác giả chung (truyện mới)</FieldLabel><Input id="ms-common-author" value={common.author} onChange={(event) => setCommon({ ...common, author: event.target.value })} placeholder="Áp dụng cho truyện chưa điền tác giả" /></Field>
            <Field><FieldLabel htmlFor="ms-common-genres">Thể loại chung (truyện mới)</FieldLabel><GenreCombobox id="ms-common-genres" catalog={catalog} value={common.genres} onChange={(genres) => setCommon((current) => ({ ...current, genres }))} /></Field>
            <label className="flex items-center gap-2 pb-2 text-sm"><Checkbox checked={groups.every((group) => group.settings.free)} onCheckedChange={(checked) => { setCommon({ ...common, free: checked === true }); setMeta((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, free: checked === true }]))); }} />Miễn phí tất cả</label>
          </div>}

          <p className="text-sm text-muted-foreground">{files.length} file · {groups.length} truyện · sẽ tải <strong className="text-foreground">{toUpload}</strong> chương</p>

          <div className="space-y-2">{groups.map((group) => {
            const open = expanded === group.key || groups.length === 1;
            return <div key={group.key} className={`rounded-md border ${group.settings.include ? "" : "opacity-60"}`}>
              {/* Clicking anywhere on the header that is not a field or button opens / closes the story. */}
              <div className={`flex flex-wrap items-center gap-2 p-3 ${groups.length > 1 ? "cursor-pointer" : ""}`} onClick={(event) => { if (groups.length > 1 && !(event.target as HTMLElement).closest("input, button, [role=combobox], [role=checkbox]")) setExpanded(open ? null : group.key); }}>
                {mode === "admin" && <Checkbox checked={group.settings.include} onCheckedChange={(checked) => updateMeta(group.key, { include: checked === true })} aria-label={`Tải truyện ${group.settings.title}`} />}
                {groups.length > 1 && <Button type="button" variant="ghost" size="icon-sm" onClick={() => setExpanded(open ? null : group.key)} aria-label={open ? "Thu gọn" : "Xem chi tiết"}>{open ? <ChevronDown /> : <ChevronRight />}</Button>}
                {mode === "admin" && <button type="button" onClick={() => setExpanded(group.key)} title={group.settings.cover ? "Ảnh bìa" : "Thêm ảnh bìa"} aria-label={group.settings.cover ? `Ảnh bìa ${group.settings.title}` : `Thêm ảnh bìa cho ${group.settings.title}`} className="flex aspect-[4/5] w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed bg-muted text-muted-foreground hover:border-highlight">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded cover preview */}
                  {group.settings.cover ? <img src={group.settings.cover} alt="" className="size-full object-cover" /> : <ImagePlus className="size-3.5" />}
                </button>}
                {mode === "admin" && !group.targetId
                  ? <Input value={group.settings.title} onChange={(event) => updateMeta(group.key, { title: event.target.value })} className="h-8 min-w-48 flex-1 font-semibold" aria-label="Tên truyện" />
                  : <span className="min-w-0 flex-1 truncate font-semibold">{mode === "author" ? story!.title : stories.find((item) => item.id === group.targetId)?.title}</span>}
                {mode === "admin" && <Select items={[{ value: NEW, label: "Truyện mới" }, ...stories.map((item) => ({ value: item.id, label: `Thêm vào: ${item.title}` }))]} value={group.settings.target} onValueChange={(value) => { const target = String(value); const chosen = stories.find((item) => item.id === target); updateMeta(group.key, { target, ...(chosen ? { free: chosen.lock_from_chapter === null, cover: chosen.cover_url ?? "" } : {}) }); if (target !== NEW) void loadExisting(target); }}>
                  <SelectTrigger size="sm" className="w-56" aria-label="Truyện đích"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NEW}>Truyện mới</SelectItem>{stories.map((item) => <SelectItem key={item.id} value={item.id}>Thêm vào: {item.title}</SelectItem>)}</SelectContent>
                </Select>}
                <span className="text-xs text-muted-foreground">{group.members.length} file · {group.rows.length} chương · tải {group.upload.length}</span>
              </div>
              {group.warnings.length > 0 && <Alert className="mx-3 mb-3 w-auto py-2"><AlertTriangle /><AlertDescription><ul className="list-disc pl-4 text-xs">{group.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>{group.duplicated && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => renumber(group)}><ListOrdered />Đánh số lại liên tục{group.existing.size ? ` (từ chương ${Math.max(...group.existing) + 1})` : ""}</Button>}</AlertDescription></Alert>}
              {open && <div className="space-y-3 border-t p-3">
                {mode === "admin" && !group.targetId && <div className="grid gap-3 sm:grid-cols-3">
                  <Field><FieldLabel htmlFor={`a-${group.key}`}>Tác giả</FieldLabel><Input id={`a-${group.key}`} value={group.settings.author} onChange={(event) => updateMeta(group.key, { author: event.target.value })} placeholder={common.author || "Tên tác giả"} /></Field>
                  <Field><FieldLabel>Trạng thái</FieldLabel><Select items={statuses.map((value) => ({ value, label: value }))} value={group.settings.status} onValueChange={(value) => updateMeta(group.key, { status: String(value) })}><SelectTrigger className="w-full" aria-label="Trạng thái"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
                  <Field><FieldLabel htmlFor={`g-${group.key}`}>Thể loại</FieldLabel><GenreCombobox id={`g-${group.key}`} catalog={catalog} value={group.settings.genres} onChange={(genres) => updateMeta(group.key, { genres })} /></Field>
                </div>}
                {mode === "admin" && <Field><FieldLabel htmlFor={`c-${group.key}`}>Ảnh bìa (tùy chọn)</FieldLabel><CoverUploader id={`c-${group.key}`} value={group.settings.cover} onChange={(cover) => updateMeta(group.key, { cover })} uploadUrl="/api/admin/covers" /><FieldDescription>{COVER_HINT}</FieldDescription></Field>}
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={group.settings.free} onCheckedChange={(checked) => updateMeta(group.key, { free: checked === true })} />Miễn phí cả truyện <span className="text-xs text-muted-foreground">(bỏ chọn để giữ cài đặt khóa chương hiện tại)</span></label>
                {mode === "admin" && group.members.length > 0 && <div className="space-y-1">{group.members.map((file) => <div key={file.id} className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate" title={file.path || file.name}>{file.path || file.name}</span><span className="shrink-0 text-xs text-muted-foreground">{file.chapters.length} chương</span>
                  <Select items={[...groupOptions, { value: SPLIT, label: "Tách thành truyện riêng" }]} value={group.key} onValueChange={(value) => moveFile(file.id, String(value))}><SelectTrigger size="sm" className="w-48" aria-label={`Thuộc truyện (${file.name})`}><SelectValue /></SelectTrigger><SelectContent>{groupOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}<SelectItem value={SPLIT}>Tách thành truyện riêng</SelectItem></SelectContent></Select>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Bỏ file ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}><X /></Button>
                </div>)}</div>}
                {group.rows.length > 0 && <div className="max-h-72 overflow-y-auto rounded-md border">{group.rows.map((row) => {
                  const already = group.existing.has(row.number);
                  return <div key={row.key} className="flex items-center gap-2 border-b px-3 py-1.5 last:border-0">
                    <Checkbox checked={row.include && !already} disabled={already} onCheckedChange={(checked) => editRow(row.key, { include: checked === true })} aria-label={`Tải chương ${row.number}`} />
                    <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">Chương {row.number}</span>
                    <Input value={row.title} onChange={(event) => editRow(row.key, { title: event.target.value })} className="h-8 min-w-0 flex-1" aria-label={`Tên chương ${row.number}`} />
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.words.toLocaleString("vi-VN")} chữ</span>
                    {already && <Badge variant="secondary" className="shrink-0">Đã có</Badge>}
                  </div>;
                })}</div>}
              </div>}
            </div>;
          })}</div>
        </>}

        {progress && <div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-highlight transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{progress.group}: đã tải {progress.done}/{progress.total} chương — đừng đóng cửa sổ.</p></div>}
        {groups.length > 0 && <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={reset}>Làm lại</Button>
          <Button type="button" disabled={busy || !toUpload} onClick={upload} className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><Upload />{progress ? "Đang tải..." : `Tải ${toUpload} chương lên`}</Button>
        </DialogFooter>}
      </div>}
    </DialogContent>
  </Dialog>;
}
