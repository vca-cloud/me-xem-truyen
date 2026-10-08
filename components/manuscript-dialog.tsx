"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Link2, Upload } from "lucide-react";
import { GenreCombobox } from "@/components/genre-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chapterFileText, markdownBlocks, splitManuscript, textBlocks, type ManuscriptBlock, type ManuscriptResult } from "@/lib/manuscript";

export type ManuscriptTarget = { id: string; title: string; lock_from_chapter: number | null };
type Row = { number: number; title: string; paragraphs: string[]; words: number; include: boolean };
type Result = { number: number; status: "added" | "skipped" | "error"; message?: string; flagged?: boolean; publish_status?: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const BATCH_CHAPTERS = 50;
const BATCH_CHARS = 1_200_000;
const statuses = ["Đang ra", "Hoàn thành", "Tạm dừng"];

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

async function send(url: string, body: unknown) {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: response.ok, body: await response.json().catch(() => ({})) as Record<string, unknown> };
  } catch {
    return { ok: false, body: { error: "Lỗi kết nối đến server." } as Record<string, unknown> };
  }
}

// Upload a whole manuscript (.docx / Google Docs / .md / .txt): split into chapters in the browser, review,
// then store each chapter as "<Tên truyện>/Chương N.txt" on Cloudflare R2 in batches.
// Admin: new story or an existing one. Author: always the given story (author publishing rules apply on the server).
export function ManuscriptDialog({ open, onOpenChange, mode, stories = [], story, existingNumbers, catalog = [], onDone }: {
  open: boolean; onOpenChange: (open: boolean) => void; mode: "admin" | "author";
  stories?: ManuscriptTarget[]; story?: ManuscriptTarget; existingNumbers?: number[]; catalog?: string[]; onDone: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<"file" | "link">("file");
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ManuscriptResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState<"new" | "existing">(story ? "existing" : "new");
  const [storyId, setStoryId] = useState(story?.id ?? "");
  const [existing, setExisting] = useState<Set<number>>(new Set(existingNumbers ?? []));
  const [newStory, setNewStory] = useState({ title: "", author: "", status: "Đang ra", genres: [] as string[] });
  const [free, setFree] = useState(story ? story.lock_from_chapter === null : true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  const selected = story ?? stories.find((item) => item.id === storyId);
  const toUpload = useMemo(() => rows.filter((row) => row.include && !existing.has(row.number)), [rows, existing]);

  function reset() {
    setParsed(null); setRows([]); setFileName(""); setLink(""); setResults(null); setProgress(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function load(blocks: ManuscriptBlock[], name: string) {
    const result = splitManuscript(blocks);
    setParsed(result);
    setFileName(name);
    setRows(result.chapters.map((chapter) => ({ ...chapter, include: true })));
    if (!newStory.title && name) setNewStory((current) => ({ ...current, title: name.replace(/\.(docx|md|markdown|txt)$/i, "").normalize("NFC").trim() }));
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast.error("File tối đa 20 MB.");
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["docx", "md", "markdown", "txt"].includes(extension ?? "")) return toast.error(extension === "doc" ? "File Word cũ (.doc): mở bằng Word rồi lưu thành .docx." : extension === "pages" ? "File Pages: chọn File → Export To → Word rồi tải file .docx lên." : "Chỉ nhận file .docx, .md hoặc .txt.");
    setReading(true);
    try {
      const buffer = await file.arrayBuffer();
      const blocks = extension === "docx" ? await docxBlocks(buffer) : extension === "txt" ? textBlocks(decodeText(buffer)) : markdownBlocks(decodeText(buffer));
      load(blocks, file.name);
    } catch {
      toast.error("Không đọc được file. Nếu là .docx, hãy mở bằng Word/Google Docs và lưu lại.");
    } finally {
      setReading(false);
    }
  }

  async function readLink() {
    if (!link.trim()) return;
    setReading(true);
    try {
      const response = await fetch(`/api/manuscript/google-doc?url=${encodeURIComponent(link.trim())}`);
      if (!response.ok) throw new Error(String((await response.json().catch(() => ({}))).error ?? "Không lấy được tài liệu."));
      load(await docxBlocks(await response.arrayBuffer()), "Google Docs");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lấy được tài liệu.");
    } finally {
      setReading(false);
    }
  }

  async function chooseStory(id: string) {
    setStoryId(id);
    const chosen = stories.find((item) => item.id === id);
    setFree(chosen ? chosen.lock_from_chapter === null : true);
    try {
      const response = await fetch(`/api/admin/stories/${id}/chapters`);
      const body = await response.json();
      setExisting(new Set((body.chapters ?? []).map((chapter: { chapter_number: number }) => chapter.chapter_number)));
    } catch {
      setExisting(new Set());
    }
  }

  async function upload() {
    if (!toUpload.length) return;
    let id = selected?.id ?? "";
    if (mode === "admin" && target === "new") {
      if (!newStory.title.trim() || !newStory.author.trim()) return toast.error("Nhập tên truyện và tác giả.");
      const created = await send("/api/admin/stories", { title: newStory.title, author: newStory.author, status: newStory.status, genres: newStory.genres, description: "", chapters: [] });
      if (!created.ok) return toast.error(String(created.body.error ?? "Không tạo được truyện."));
      id = String((created.body.story as { id: string }).id);
    }
    if (!id) return toast.error("Chọn truyện để thêm chương.");
    const endpoint = mode === "admin" ? `/api/admin/stories/${id}/manuscript` : `/api/author/stories/${id}/manuscript`;
    const batches: Row[][] = [];
    let batch: Row[] = [];
    let chars = 0;
    for (const row of toUpload) {
      const size = row.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
      if (batch.length && (batch.length >= BATCH_CHAPTERS || chars + size > BATCH_CHARS)) { batches.push(batch); batch = []; chars = 0; }
      batch.push(row); chars += size;
    }
    if (batch.length) batches.push(batch);

    const collected: Result[] = [];
    setProgress({ done: 0, total: toUpload.length });
    for (const [index, items] of batches.entries()) {
      const { ok, body } = await send(endpoint, { free: index === 0 && free, chapters: items.map((row) => ({ number: row.number, title: row.title.trim(), content: chapterFileText({ ...row, title: row.title.trim() || `Chương ${row.number}` }) })) });
      if (ok) collected.push(...(body.results as Result[]));
      else collected.push(...items.map((row) => ({ number: row.number, status: "error" as const, message: String(body.error ?? "Lỗi máy chủ.") })));
      setProgress({ done: collected.length, total: toUpload.length });
    }
    setResults(collected);
    setProgress(null);
    onDone();
    const added = collected.filter((item) => item.status === "added").length;
    if (added) toast.success(`Đã tải ${added} chương lên.`);
  }

  const added = results?.filter((item) => item.status === "added") ?? [];
  const problems = results?.filter((item) => item.status !== "added") ?? [];
  const busy = reading || !!progress;

  return <Dialog open={open} onOpenChange={(value) => { if (busy) return; if (!value) reset(); onOpenChange(value); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Tải bản thảo{story ? `: ${story.title}` : ""}</DialogTitle>
        <DialogDescription>Một file chứa nhiều chương (.docx, Google Docs, .md, .txt). Hệ thống tự tìm dòng “Chương N: Tên chương”, tách từng chương thành file .txt và lưu lên Cloudflare theo thư mục tên truyện.</DialogDescription>
      </DialogHeader>

      {results ? <div className="space-y-3">
        <Alert><AlertTitle>Đã tải {added.length}/{results.length} chương</AlertTitle><AlertDescription>
          {mode === "author" && added.some((item) => item.publish_status === "submitted") ? `${added.filter((item) => item.publish_status === "submitted").length} chương chờ admin duyệt trước khi đăng. ` : ""}
          {added.some((item) => item.flagged) ? `${added.filter((item) => item.flagged).length} chương có từ cần kiểm duyệt (quảng cáo tạm tắt).` : ""}
        </AlertDescription></Alert>
        {problems.length > 0 && <div className="max-h-48 overflow-y-auto rounded-md border text-sm">{problems.map((item) => <p key={item.number} className="border-b px-3 py-1.5 last:border-0"><span className="font-medium">Chương {item.number}:</span> <span className={item.status === "error" ? "text-destructive" : "text-muted-foreground"}>{item.message}</span></p>)}</div>}
        <DialogFooter><Button type="button" onClick={() => { reset(); onOpenChange(false); }}>Xong</Button></DialogFooter>
      </div> : !parsed ? <div className="space-y-4">
        <Tabs value={source} onValueChange={(value) => setSource(value as "file" | "link")}><TabsList className="w-full"><TabsTrigger value="file"><FileText />Tải file lên</TabsTrigger><TabsTrigger value="link"><Link2 />Link Google Docs</TabsTrigger></TabsList></Tabs>
        {source === "file" ? <div className="rounded-lg border border-dashed p-6 text-center">
          <input ref={fileInput} type="file" accept=".docx,.md,.markdown,.txt" className="hidden" onChange={(event) => readFile(event.target.files?.[0])} />
          <Button type="button" disabled={reading} onClick={() => fileInput.current?.click()}><Upload />{reading ? "Đang đọc file..." : "Chọn file"}</Button>
          <p className="mt-2 text-xs text-muted-foreground">.docx (Word, Google Docs tải về), .md, .txt — tối đa 20 MB. Google Docs: Tệp → Tải xuống → Microsoft Word (.docx).</p>
        </div> : <Field>
          <FieldLabel htmlFor="gdoc-link">Link Google Docs</FieldLabel>
          <div className="flex gap-2"><Input id="gdoc-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://docs.google.com/document/d/…" /><Button type="button" disabled={reading || !link.trim()} onClick={readLink}>{reading ? "Đang lấy..." : "Lấy nội dung"}</Button></div>
          <FieldDescription>Tài liệu phải bật chia sẻ “Bất kỳ ai có đường liên kết đều xem được”. Tài liệu rất dài (trên 4 MB) thì tải file .docx về rồi tải lên.</FieldDescription>
        </Field>}
      </div> : <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{fileName} · tìm thấy <strong className="text-foreground">{rows.length}</strong> chương · sẽ tải <strong className="text-foreground">{toUpload.length}</strong> chương</p>
        {parsed.warnings.length > 0 && <Alert><AlertTriangle /><AlertTitle>Kiểm tra trước khi tải</AlertTitle><AlertDescription><ul className="list-disc pl-4">{parsed.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}

        {rows.length > 0 && <div className="max-h-80 overflow-y-auto rounded-md border">
          {rows.map((row, index) => {
            const already = existing.has(row.number);
            return <div key={`${row.number}-${index}`} className="flex items-center gap-2 border-b px-3 py-1.5 last:border-0">
              <Checkbox checked={row.include && !already} disabled={already} onCheckedChange={(checked) => setRows((current) => current.map((item, i) => i === index ? { ...item, include: checked === true } : item))} aria-label={`Tải chương ${row.number}`} />
              <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">Chương {row.number}</span>
              <Input value={row.title} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} className="h-8 min-w-0 flex-1" aria-label={`Tên chương ${row.number}`} />
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.words.toLocaleString("vi-VN")} chữ</span>
              {already && <Badge variant="secondary" className="shrink-0">Đã có</Badge>}
            </div>;
          })}
        </div>}

        <FieldGroup>
          {mode === "admin" && !story && <>
            <Tabs value={target} onValueChange={(value) => setTarget(value as "new" | "existing")}><TabsList className="w-full"><TabsTrigger value="new">Truyện mới</TabsTrigger><TabsTrigger value="existing">Thêm vào truyện có sẵn</TabsTrigger></TabsList></Tabs>
            {target === "new" ? <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="ms-title">Tên truyện</FieldLabel><Input id="ms-title" value={newStory.title} onChange={(event) => setNewStory({ ...newStory, title: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="ms-author">Tác giả</FieldLabel><Input id="ms-author" value={newStory.author} onChange={(event) => setNewStory({ ...newStory, author: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="ms-genres">Thể loại</FieldLabel><GenreCombobox id="ms-genres" catalog={catalog} value={newStory.genres} onChange={(genres) => setNewStory((current) => ({ ...current, genres }))} /></Field>
              <Field><FieldLabel>Trạng thái</FieldLabel><Select items={statuses.map((value) => ({ value, label: value }))} value={newStory.status} onValueChange={(value) => setNewStory({ ...newStory, status: String(value) })}><SelectTrigger className="w-full" aria-label="Trạng thái"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
            </div> : <Field><FieldLabel>Truyện</FieldLabel><Select items={stories.map((item) => ({ value: item.id, label: item.title }))} value={storyId || null} onValueChange={(value) => chooseStory(String(value))}><SelectTrigger className="w-full" aria-label="Chọn truyện"><SelectValue placeholder="Chọn truyện…" /></SelectTrigger><SelectContent>{stories.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select><FieldDescription>Chỉ thêm chương chưa có; chương đã có được giữ nguyên.</FieldDescription></Field>}
          </>}
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={free} onCheckedChange={(checked) => setFree(checked === true)} className="mt-0.5" /><span><span className="font-medium">Miễn phí cả truyện</span><span className="block text-xs text-muted-foreground">Bỏ khóa Xu cho toàn bộ chương. Bỏ chọn để giữ cài đặt khóa chương hiện tại (chỉnh trong “Sửa thông tin”).</span></span></label>
        </FieldGroup>

        {progress && <div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-highlight transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">Đang tải {progress.done}/{progress.total} chương — đừng đóng cửa sổ.</p></div>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={reset}>Chọn file khác</Button>
          <Button type="button" disabled={busy || !toUpload.length || (mode === "admin" && target === "existing" && !story && !storyId)} onClick={upload} className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><Upload />{progress ? "Đang tải..." : `Tải ${toUpload.length} chương lên`}</Button>
        </DialogFooter>
      </div>}
    </DialogContent>
  </Dialog>;
}
