"use client";

import { COVER_HINT } from "@/lib/cover";
import { CoverUploader } from "@/components/cover-uploader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookUp, CloudDownload, Download, ExternalLink, FileUp, ListPlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PageHeading, StatusBadge, TableCard } from "@/components/admin-ui";
import { useConfirm } from "@/components/confirm-dialog";
import { GenreCombobox } from "@/components/genre-combobox";
import { HitsBadge, MatureBadge, ModerationStatusBadge, type ModerationHitSummary } from "@/components/moderation-badges";
import { Switch } from "@/components/ui/switch";
import { R2ImportDialog } from "@/components/r2-import-dialog";
import { ManuscriptDialog } from "@/components/manuscript-dialog";
import { StoryTag } from "@/components/home-page";
import { HotPinSwitch } from "@/components/hot-pin-switch";
import { HOT_MIN_VIEWS_7D, HOT_TOP, NEW_DAYS } from "@/lib/views";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { chapterPrice, DEFAULT_LOCK_PRICE, formatCoins } from "@/lib/coins";
import { parseStoryImportCsv, storyImportTemplate } from "@/lib/story-import";
import type { StoryStatus } from "@/lib/story-data";

export type AdminStory = { id: string; slug: string; title: string; author: string; description: string; cover_url: string | null; audio_url: string | null; status: StoryStatus; lock_from_chapter: number | null; lock_price_coins: number; ads_disabled: boolean; genres: string[]; chapter_count: number; created_at: string; updated_at: string; moderation?: { pending: number; mature: number; ads_off: number } ; hot_pinned?: boolean; hot?: boolean };
export type R2Info = { dashboardBase: string | null; publicBase: string | null };
type ChapterDraft = { chapter_number: string; title: string; text_url: string };
type StoryForm = { id?: string; title: string; author: string; description: string; cover_url: string; audio_url: string; status: StoryStatus; genres: string[]; lock_from_chapter: string; lock_price_coins: string; ads_disabled: boolean; hot_pinned: boolean; chapters: ChapterDraft[] };
type ExistingChapter = { id: string; chapter_number: number; title: string; text_url: string; ads_enabled: boolean; moderation_status: string; moderation_hits: ModerationHitSummary[]; is_mature: boolean };

const statuses: StoryStatus[] = ["Đang ra", "Hoàn thành", "Tạm dừng"];
const statusFilterItems = [{ value: "all", label: "Tất cả trạng thái" }, ...statuses.map((status) => ({ value: status, label: status }))];
const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

const blankChapter = (number: number): ChapterDraft => ({ chapter_number: String(number), title: "", text_url: "" });
const toChapterPayload = (chapters: ChapterDraft[]) => chapters.map((chapter) => ({ chapter_number: Number(chapter.chapter_number), title: chapter.title.trim(), text_url: chapter.text_url.trim() }));

function chapterError(chapters: ChapterDraft[]) {
  const numbers = chapters.map((chapter) => Number(chapter.chapter_number));
  if (numbers.some((number) => !Number.isInteger(number) || number < 1)) return "Số chương phải là số nguyên dương.";
  if (new Set(numbers).size !== numbers.length) return "Có số chương bị trùng.";
  if (chapters.some((chapter) => !chapter.title.trim())) return "Mỗi chương cần có tên chương.";
  if (chapters.some((chapter) => !/^(https?|r2):\/\//i.test(chapter.text_url.trim()))) return "Link nội dung (.txt) phải bắt đầu bằng https:// (file public) hoặc r2:// (file riêng tư).";
  return null;
}

async function requestJson(url: string, init?: RequestInit): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  try {
    const response = await fetch(url, init);
    return { ok: response.ok, body: await response.json().catch(() => ({})) };
  } catch {
    return { ok: false, body: { error: "Lỗi kết nối đến server." } };
  }
}

const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function fetchChapters(storyId: string): Promise<{ chapters: ExistingChapter[] } | { error: string }> {
  const { ok, body } = await requestJson(`/api/admin/stories/${storyId}/chapters`);
  return ok ? { chapters: (body.chapters as ExistingChapter[]) ?? [] } : { error: String(body.error ?? "Không tải được danh sách chương.") };
}

function ChapterRows({ chapters, onChange }: { chapters: ChapterDraft[]; onChange: (chapters: ChapterDraft[]) => void }) {
  const update = (index: number, patch: Partial<ChapterDraft>) => onChange(chapters.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)));
  return <div className="space-y-3">
    {chapters.map((chapter, index) => <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[96px_1fr_auto]">
      <Field><FieldLabel htmlFor={`chapter-number-${index}`}>Số chương</FieldLabel><Input id={`chapter-number-${index}`} required inputMode="numeric" value={chapter.chapter_number} onChange={(event) => update(index, { chapter_number: event.target.value })} /></Field>
      <Field><FieldLabel htmlFor={`chapter-title-${index}`}>Tên chương</FieldLabel><Input id={`chapter-title-${index}`} required value={chapter.title} onChange={(event) => update(index, { title: event.target.value })} placeholder="Ví dụ: Thư viện bí ẩn" /></Field>
      <Button type="button" variant="ghost" size="icon-sm" className="self-end text-destructive" aria-label="Bỏ chương này" disabled={chapters.length === 1} onClick={() => onChange(chapters.filter((_, i) => i !== index))}><X /></Button>
      <Field className="sm:col-span-3"><FieldLabel htmlFor={`chapter-url-${index}`}>Link nội dung (.txt trên R2)</FieldLabel><Input id={`chapter-url-${index}`} required value={chapter.text_url} onChange={(event) => update(index, { text_url: event.target.value })} placeholder="https://pub-….r2.dev/ten-truyen/chuong-1.txt hoặc r2://ten-truyen/chuong-1.txt" /><FieldDescription>Dùng r2:// cho chương trả phí (bucket riêng tư).</FieldDescription></Field>
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => { const last = Number(chapters.at(-1)?.chapter_number); onChange([...chapters, blankChapter(Number.isInteger(last) ? last + 1 : chapters.length + 1)]); }}><Plus />Thêm một chương</Button>
  </div>;
}

// Folder ("prefix") shared by all chapter files of a story, e.g. "Giả làm thái giám, …/".
function chapterFolder(urls: string[], publicBase: string | null) {
  const keys = urls.map((url) => {
    if (url.startsWith("r2://")) return { bucket: "private", key: url.slice(5) };
    if (publicBase && url.startsWith(publicBase + "/")) return { bucket: "public", key: decodeURIComponent(url.slice(publicBase.length + 1)) };
    return null;
  });
  if (!keys.length || keys.some((key) => !key) || new Set(keys.map((key) => key!.bucket)).size > 1) return null;
  const folders = keys.map((key) => key!.key.slice(0, key!.key.lastIndexOf("/") + 1));
  return new Set(folders).size === 1 ? { bucket: keys[0]!.bucket, folder: folders[0] } : null;
}

// Where the story's chapter files live on Cloudflare R2, with a link to that folder in the dashboard.
function R2FolderInfo({ storyId, r2 }: { storyId: string; r2: R2Info }) {
  const [state, setState] = useState<{ folder: { bucket: string; folder: string } | null; count: number; first: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    fetchChapters(storyId).then((result) => {
      if (!active || "error" in result) return;
      const urls = result.chapters.map((chapter) => chapter.text_url);
      setState({ folder: chapterFolder(urls, r2.publicBase), count: urls.length, first: urls[0] ?? null });
    });
    return () => { active = false; };
  }, [storyId, r2.publicBase]);
  if (!state) return <p className="text-xs text-muted-foreground">Đang tải thông tin Cloudflare R2...</p>;
  const dashboardUrl = state.folder?.bucket === "public" && r2.dashboardBase ? `${r2.dashboardBase}?prefix=${encodeURIComponent(state.folder.folder)}` : null;
  return <Alert>
    <AlertTitle>Nội dung trên Cloudflare R2</AlertTitle>
    <AlertDescription>
      {state.folder ? <p className="break-all">{state.folder.bucket === "private" ? "Bucket riêng tư" : "Bucket public"} · thư mục <code className="rounded bg-muted px-1">{state.folder.folder || "/"}</code> · {state.count} file</p>
        : <p>{state.count ? `${state.count} chương, link nằm ở nhiều thư mục khác nhau — xem từng link trong "Quản lý chương".` : "Truyện chưa có chương."}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {dashboardUrl && <Button variant="outline" size="xs" nativeButton={false} render={<a href={dashboardUrl} target="_blank" rel="noreferrer" />}><ExternalLink />Mở thư mục trong Cloudflare</Button>}
        {state.first?.startsWith("http") && <Button variant="outline" size="xs" nativeButton={false} render={<a href={state.first} target="_blank" rel="noreferrer" />}><ExternalLink />Mở file chương đầu</Button>}
      </div>
      {!r2.dashboardBase && <p className="mt-2 text-xs">Thêm R2_ACCOUNT_ID và R2_PUBLIC_BUCKET vào biến môi trường để có nút mở thẳng Cloudflare.</p>}
    </AlertDescription>
  </Alert>;
}

// Lists a story's chapters with inline edit/delete, plus a form to add new chapters.
function ChapterManager({ story, onChanged }: { story: AdminStory; onChanged: () => void }) {
  const confirm = useConfirm();
  const [chapters, setChapters] = useState<ExistingChapter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExistingChapter | null>(null);
  const [drafts, setDrafts] = useState<ChapterDraft[]>([blankChapter(story.chapter_count + 1)]);
  const [pending, setPending] = useState(false);

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchChapters>>) => {
    if ("error" in result) return setLoadError(result.error);
    setChapters(result.chapters);
    setDrafts([blankChapter((result.chapters.at(-1)?.chapter_number ?? 0) + 1)]);
  }, []);
  const load = useCallback(async () => apply(await fetchChapters(story.id)), [apply, story.id]);

  useEffect(() => {
    let active = true;
    fetchChapters(story.id).then((result) => { if (active) apply(result); });
    return () => { active = false; };
  }, [apply, story.id]);

  async function run(url: string, init: RequestInit, success: string) {
    setPending(true);
    const { ok, body } = await requestJson(url, init);
    setPending(false);
    if (!ok) { toast.error(String(body.error ?? "Không thể lưu.")); return false; }
    toast.success(success);
    onChanged();
    await load();
    return true;
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (editing && await run(`/api/admin/chapters/${editing.id}`, jsonInit("PATCH", { title: editing.title, text_url: editing.text_url }), `Đã sửa chương ${editing.chapter_number}.`)) setEditing(null);
  }

  async function toggleAds(chapter: ExistingChapter, adsEnabled: boolean) {
    await run(`/api/admin/chapters/${chapter.id}`, jsonInit("PATCH", { ads_enabled: adsEnabled }), `Chương ${chapter.chapter_number}: ${adsEnabled ? "bật" : "tắt"} quảng cáo (đã duyệt).`);
  }

  async function rescan() {
    setPending(true);
    const { ok, body } = await requestJson(`/api/admin/stories/${story.id}/moderation`, { method: "POST" });
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không quét được."));
    toast.success(`Đã quét ${body.scanned} chương${Number(body.pending) ? `, ${body.pending} chương cần duyệt` : ", không có chương cần duyệt"}.`);
    onChanged();
    await load();
  }

  async function remove(chapter: ExistingChapter) {
    if (await confirm({ title: `Xóa chương ${chapter.chapter_number}?`, description: `"${chapter.title}" sẽ bị xóa khỏi truyện. Chương đã có người mua bằng Xu thì không xóa được.`, confirmText: "Xóa chương", destructive: true })) {
      await run(`/api/admin/chapters/${chapter.id}`, { method: "DELETE" }, `Đã xóa chương ${chapter.chapter_number}.`);
    }
  }

  async function addChapters(event: React.FormEvent) {
    event.preventDefault();
    const problem = chapterError(drafts);
    if (problem) return toast.error(problem);
    setPending(true);
    const { ok, body } = await requestJson(`/api/admin/stories/${story.id}/chapters`, jsonInit("POST", { chapters: toChapterPayload(drafts) }));
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không thể thêm chương."));
    toast.success(`Đã thêm ${drafts.length} chương vào "${story.title}".`, Number(body.pending) ? { description: `${body.pending} chương cần duyệt — đã tắt quảng cáo.` } : undefined);
    onChanged();
    await load();
  }

  return <div className="space-y-6">
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Chương hiện có {chapters && `(${chapters.length})`}</h3><Button type="button" variant="outline" size="sm" disabled={pending} onClick={rescan}>Quét kiểm duyệt lại</Button></div>
      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : !chapters ? <p className="text-sm text-muted-foreground">Đang tải...</p> : chapters.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có chương nào.</p> :
        <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">{chapters.map((chapter) => editing?.id === chapter.id
          ? <form key={chapter.id} onSubmit={saveEdit} className="space-y-2 bg-muted/50 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Sửa chương {chapter.chapter_number}</p>
              <Input required aria-label="Tên chương" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              <Input required aria-label="Link nội dung" value={editing.text_url} onChange={(event) => setEditing({ ...editing, text_url: event.target.value })} />
              <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" size="sm" disabled={pending}>Lưu</Button></div>
            </form>
          : <div key={chapter.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">#{chapter.chapter_number}</span>
              <div className="min-w-0 flex-1"><p className="truncate">{chapter.title}</p>{chapter.text_url.startsWith("http") ? <a href={chapter.text_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">{decodeURI(chapter.text_url)}</a> : <p className="truncate text-xs text-muted-foreground">{chapter.text_url}</p>}</div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {chapter.is_mature && <MatureBadge />}
                <ModerationStatusBadge status={chapter.moderation_status} />
                <HitsBadge hits={chapter.moderation_hits} />
                {chapterPrice(story, chapter.chapter_number) > 0 && <Badge variant="outline">{formatCoins(story.lock_price_coins)}</Badge>}
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={chapter.ads_enabled} disabled={pending} onCheckedChange={(checked) => toggleAds(chapter, checked)} aria-label={`Quảng cáo chương ${chapter.chapter_number}`} />QC</label>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Sửa chương ${chapter.chapter_number}`} onClick={() => setEditing(chapter)}><Pencil /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Xóa chương ${chapter.chapter_number}`} disabled={pending} onClick={() => remove(chapter)}><Trash2 /></Button>
            </div>)}
        </div>}
    </section>
    <form onSubmit={addChapters} className="space-y-3">
      <h3 className="text-sm font-semibold">Thêm chương mới</h3>
      <ChapterRows chapters={drafts} onChange={setDrafts} />
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu chương mới"}</Button></div>
    </form>
  </div>;
}

// NEW tag rule shared with the home page (created in the last NEW_DAYS days).
const isNewStory = (story: AdminStory) => Date.now() - new Date(story.created_at).getTime() < NEW_DAYS * 86_400_000;

export function AdminStoriesPage({ stories, genres: genreCatalog, r2, loadError }: { stories: AdminStory[]; genres: string[]; r2: R2Info; loadError: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [catalog, setCatalog] = useState(genreCatalog);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<StoryForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [chapterTarget, setChapterTarget] = useState<AdminStory | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [r2Open, setR2Open] = useState(false);
  const [manuscriptOpen, setManuscriptOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => stories.filter((story) => `${story.title} ${story.author} ${story.genres.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (status === "all" || story.status === status)), [stories, query, status]);

  async function send(url: string, init: RequestInit) {
    setPending(true);
    const result = await requestJson(url, init);
    setPending(false);
    return result;
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["﻿" + storyImportTemplate()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-import-truyen-nhieu-chuong.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!importFile) return;
    const parsed = parseStoryImportCsv(await importFile.text());
    if (parsed.errors.length) return setImportErrors(parsed.errors);
    const formData = new FormData();
    formData.append("file", importFile);
    const { ok, body } = await send("/api/admin/stories/import", { method: "POST", body: formData });
    if (!ok) return setImportErrors((body.errors as string[]) ?? [String(body.error ?? "Không thể import file.")]);
    setImportFile(null);
    toast.success(`Đã import ${body.stories} truyện và ${body.chapters} chương.`, Number(body.pending) ? { description: `${body.pending} chương cần duyệt — đã tắt quảng cáo.` } : undefined);
    router.refresh();
  }

  async function saveStory(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.id) { const error = chapterError(form.chapters); if (error) return setFormError(error); }
    setFormError(null);
    const payload = { title: form.title, author: form.author, description: form.description, cover_url: form.cover_url, audio_url: form.audio_url, status: form.status, genres: form.genres, lock_from_chapter: form.lock_from_chapter, lock_price_coins: form.lock_price_coins, ads_disabled: form.ads_disabled, hot_pinned: form.hot_pinned };
    const { ok, body } = form.id
      ? await send(`/api/admin/stories/${form.id}`, jsonInit("PATCH", payload))
      : await send("/api/admin/stories", jsonInit("POST", { ...payload, chapters: toChapterPayload(form.chapters) }));
    if (!ok) return setFormError(String(body.error ?? "Không thể lưu truyện."));
    toast.success(form.id ? `Đã cập nhật "${form.title}".` : `Đã đăng truyện "${form.title}".`, Number(body.pending) ? { description: `${body.pending} chương có nội dung cần duyệt — đã tắt quảng cáo, xem ở Kiểm duyệt.` } : undefined);
    setForm(null);
    router.refresh();
  }

  async function removeStory(story: AdminStory) {
    if (!await confirm({ title: `Xóa truyện "${story.title}"?`, description: `Toàn bộ ${story.chapter_count} chương sẽ bị xóa. Không thể hoàn tác.`, confirmText: "Xóa truyện", destructive: true })) return;
    const { ok, body } = await send(`/api/admin/stories/${story.id}`, { method: "DELETE" });
    if (!ok) return toast.error(String(body.error ?? "Không thể xóa truyện."));
    toast.success(`Đã xóa "${story.title}".`);
    router.refresh();
  }

  const openCreate = () => { setFormError(null); setForm({ title: "", author: "", description: "", cover_url: "", audio_url: "", status: "Đang ra", genres: [], lock_from_chapter: "", lock_price_coins: String(DEFAULT_LOCK_PRICE), ads_disabled: false, hot_pinned: false, chapters: [blankChapter(1)] }); };
  const openEdit = (story: AdminStory) => { setFormError(null); setForm({ id: story.id, title: story.title, author: story.author, description: story.description, cover_url: story.cover_url ?? "", audio_url: story.audio_url ?? "", status: story.status, genres: story.genres, lock_from_chapter: story.lock_from_chapter === null ? "" : String(story.lock_from_chapter), lock_price_coins: String(story.lock_price_coins), ads_disabled: story.ads_disabled, hot_pinned: story.hot_pinned ?? false, chapters: [] }); };
  const editingSlug = form?.id ? stories.find((story) => story.id === form.id)?.slug : null;
  const lockFrom = form && /^\d+$/.test(form.lock_from_chapter) && Number(form.lock_from_chapter) > 0 ? Number(form.lock_from_chapter) : null;

  return <>
    <PageHeading title="Quản lý truyện" description="Đăng truyện mới, thêm chương, sửa thông tin và import hàng loạt từ file CSV." action={<div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={downloadTemplate}><Download />Tải file mẫu</Button>
      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp />Import hàng loạt</Button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { setImportErrors([]); setImportFile(file); } }} />
      <Button type="button" variant="outline" onClick={() => setR2Open(true)}><CloudDownload />Nhập từ Cloudflare</Button>
      <Button type="button" variant="outline" onClick={() => setManuscriptOpen(true)}><BookUp />Tải bản thảo</Button>
      <Button onClick={openCreate}><Plus />Đăng truyện mới</Button>
    </div>} />

    {loadError && <Alert variant="destructive" className="mb-4"><AlertTitle>Không tải được danh sách truyện</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}

    <TableCard title={`Danh sách truyện (${stories.length})`}>
      <div className="flex flex-wrap gap-3 border-b p-4">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên truyện, tác giả, thể loại..." className="pl-8" aria-label="Tìm truyện" /></div>
        <Select items={statusFilterItems} value={status} onValueChange={(value) => setStatus(String(value))}>
          <SelectTrigger className="w-48" aria-label="Lọc trạng thái"><SelectValue /></SelectTrigger>
          <SelectContent>{statusFilterItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {filtered.length ? <Table className="min-w-[1080px]">
        <TableHeader><TableRow><TableHead className="pl-5">Truyện</TableHead><TableHead>Tag</TableHead><TableHead>Thể loại</TableHead><TableHead className="text-right">Số chương</TableHead><TableHead>Khóa chương</TableHead><TableHead>Trạng thái</TableHead><TableHead>Cập nhật</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
        <TableBody>{filtered.map((story) => <TableRow key={story.id}>
          <TableCell className="max-w-72 pl-5"><p className="flex items-center gap-1.5 truncate font-medium">{story.moderation?.mature ? <MatureBadge /> : null}<span className="truncate">{story.title}</span></p><p className="truncate text-xs text-muted-foreground">{story.author}</p>{story.moderation?.pending ? <button type="button" onClick={() => setChapterTarget(story)} className="mt-1"><Badge variant="destructive">{story.moderation.pending} chương chờ duyệt</Badge></button> : null}</TableCell>
          <TableCell><div className="flex min-w-36 flex-col gap-1.5">
            <div className="flex flex-wrap gap-1">{story.hot && <span title={story.hot_pinned ? "HOT do admin ghim" : "HOT tự động (top lượt xem 7 ngày)"}><StoryTag tag="HOT" small /></span>}{isNewStory(story) && <StoryTag tag="NEW" small />}{story.status === "Hoàn thành" && <StoryTag tag="FULL" small />}{!story.hot && !isNewStory(story) && story.status !== "Hoàn thành" && <span className="text-xs text-muted-foreground">—</span>}</div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><HotPinSwitch storyId={story.id} title={story.title} pinned={story.hot_pinned ?? false} />Ghim HOT</label>
          </div></TableCell>
          <TableCell className="max-w-56"><div className="flex flex-wrap gap-1">{story.genres.length ? story.genres.map((genre) => <Badge key={genre} variant="secondary">{genre}</Badge>) : <span className="text-muted-foreground">—</span>}</div></TableCell>
          <TableCell className="text-right tabular-nums">{story.chapter_count}</TableCell>
          <TableCell className="whitespace-nowrap text-muted-foreground">{story.lock_from_chapter === null ? "Miễn phí" : `Từ ch.${story.lock_from_chapter} · ${formatCoins(story.lock_price_coins)}`}{story.ads_disabled && <Badge variant="outline" className="ml-2">Không QC</Badge>}</TableCell>
          <TableCell><StatusBadge>{story.status}</StatusBadge></TableCell>
          <TableCell className="whitespace-nowrap text-muted-foreground">{dateFormat.format(new Date(story.updated_at))}</TableCell>
          <TableCell className="pr-5"><div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Xem trang truyện" nativeButton={false} render={<Link href={`/truyen/${story.slug}`} target="_blank" />}><ExternalLink /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Quản lý chương" onClick={() => setChapterTarget(story)}><ListPlus /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Sửa thông tin truyện" onClick={() => openEdit(story)}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Xóa truyện" disabled={pending} onClick={() => removeStory(story)}><Trash2 /></Button>
          </div></TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">{stories.length ? "Không có truyện phù hợp." : "Chưa có truyện nào. Bấm \"Đăng truyện mới\" hoặc \"Import hàng loạt\" để bắt đầu."}</p>}
    </TableCard>

    <Dialog open={!!form} onOpenChange={(open) => { if (!open) setForm(null); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        {form && <form onSubmit={saveStory} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{form.id ? `Sửa: ${form.title}` : "Đăng truyện mới"}</DialogTitle>
            <DialogDescription>{form.id ? `Đổi tên truyện không đổi đường link: /truyen/${editingSlug ?? ""}` : "Nhập thông tin truyện và ít nhất một chương."}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="story-title">Tên truyện</FieldLabel><Input id="story-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="story-author">Tác giả</FieldLabel><Input id="story-author" required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></Field>
            </div>
            <Field><FieldLabel htmlFor="story-genres">Thể loại</FieldLabel><GenreCombobox id="story-genres" catalog={catalog} value={form.genres} onChange={(genres) => setForm((current) => current && { ...current, genres })} onCreated={(name) => setCatalog((items) => [...items, name])} /><FieldDescription>Chọn từ danh mục, hoặc gõ tên mới rồi chọn “Thêm thể loại”.</FieldDescription></Field>
            <Field><FieldLabel htmlFor="story-description">Mô tả</FieldLabel><Textarea id="story-description" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="story-cover">Ảnh bìa (tùy chọn)</FieldLabel><CoverUploader id="story-cover" value={form.cover_url} onChange={(cover_url) => setForm((current) => current && { ...current, cover_url })} uploadUrl="/api/admin/covers" /><FieldDescription>{COVER_HINT}</FieldDescription></Field>
              <Field><FieldLabel htmlFor="story-audio">Link Mê Nghe Truyện (tùy chọn)</FieldLabel><Input id="story-audio" type="url" value={form.audio_url} onChange={(event) => setForm({ ...form, audio_url: event.target.value })} placeholder="https://..." /></Field>
            </div>
            <Field><FieldLabel>Trạng thái</FieldLabel>
              <Select items={statuses.map((item) => ({ value: item, label: item }))} value={form.status} onValueChange={(value) => setForm({ ...form, status: value as StoryStatus })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {form.id && <R2FolderInfo storyId={form.id} r2={r2} />}
            <FieldSet className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <FieldLegend variant="label">Khóa chương bằng Xu</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="lock-from">Khóa từ chương số</FieldLabel><Input id="lock-from" inputMode="numeric" value={form.lock_from_chapter} onChange={(event) => setForm({ ...form, lock_from_chapter: event.target.value })} placeholder="Để trống = miễn phí toàn bộ" /></Field>
                <Field><FieldLabel htmlFor="lock-price">Giá mỗi chương (Xu)</FieldLabel><Input id="lock-price" inputMode="numeric" value={form.lock_price_coins} onChange={(event) => setForm({ ...form, lock_price_coins: event.target.value })} /></Field>
              </div>
              <FieldDescription>{lockFrom ? `Chương 1–${lockFrom - 1} miễn phí; từ chương ${lockFrom} trở đi mỗi chương ${form.lock_price_coins || DEFAULT_LOCK_PRICE} Xu (1 Xu = 100đ). Chương thêm sau cũng tự khóa.` : "Toàn bộ truyện đang miễn phí."}</FieldDescription>
            </FieldSet>
            <Field orientation="horizontal" className="rounded-lg border p-3">
              <Checkbox id="hot-pinned" checked={form.hot_pinned} onCheckedChange={(checked) => setForm({ ...form, hot_pinned: checked === true })} />
              <div className="grid gap-1"><FieldLabel htmlFor="hot-pinned" className="flex items-center gap-2">Gắn tag <StoryTag tag="HOT" small /></FieldLabel><FieldDescription>Luôn hiện HOT cho truyện này. Không chọn thì HOT tự động khi truyện thuộc top {HOT_TOP} lượt xem 7 ngày (từ {HOT_MIN_VIEWS_7D} lượt). NEW (đăng trong {NEW_DAYS} ngày) và FULL (trạng thái Hoàn thành) luôn tự động.</FieldDescription></div>
            </Field>
            <Field orientation="horizontal" className="rounded-lg border p-3">
              <Checkbox id="ads-disabled" checked={form.ads_disabled} onCheckedChange={(checked) => setForm({ ...form, ads_disabled: checked === true })} />
              <div className="grid gap-1"><FieldLabel htmlFor="ads-disabled">Tắt quảng cáo cho truyện này</FieldLabel><FieldDescription>Bật với truyện có nội dung người lớn/nhạy cảm — Google không cho đặt quảng cáo cạnh nội dung đó.</FieldDescription></div>
            </Field>
            {!form.id && <div><h3 className="mb-2 text-sm font-semibold">Danh sách chương</h3><ChapterRows chapters={form.chapters} onChange={(chapters) => setForm({ ...form, chapters })} /></div>}
          </FieldGroup>
          {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setForm(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Đăng truyện"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!chapterTarget} onOpenChange={(open) => { if (!open) { setChapterTarget(null); router.refresh(); } }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Chương: {chapterTarget?.title}</DialogTitle><DialogDescription>Sửa tên/link từng chương, xóa chương chưa có ai mua, hoặc thêm chương mới.</DialogDescription></DialogHeader>
        {chapterTarget && <ChapterManager story={chapterTarget} onChanged={() => router.refresh()} />}
      </DialogContent>
    </Dialog>

    <ManuscriptDialog open={manuscriptOpen} onOpenChange={setManuscriptOpen} mode="admin" stories={stories} catalog={catalog} onDone={() => router.refresh()} />
    <R2ImportDialog open={r2Open} onOpenChange={setR2Open} stories={stories} catalog={catalog} onGenreCreated={(name) => setCatalog((items) => [...items, name])} onDone={() => router.refresh()} />

    <Dialog open={!!importFile} onOpenChange={(open) => { if (!open) { setImportFile(null); setImportErrors([]); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Import truyện hàng loạt</DialogTitle><DialogDescription>Mỗi dòng là một chương; các dòng cùng <strong>title</strong> gộp vào một truyện. Truyện đã có sẽ bị từ chối — dùng “Quản lý chương” để bổ sung.</DialogDescription></DialogHeader>
        {importFile && <p className="text-sm">File: <strong>{importFile.name}</strong> ({Math.ceil(importFile.size / 1024)} KB)</p>}
        {importErrors.length > 0 && <Alert variant="destructive"><AlertTitle>Không thể import</AlertTitle><AlertDescription><ul className="max-h-48 list-inside list-disc overflow-y-auto">{importErrors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setImportFile(null)}>Hủy</Button><Button type="button" onClick={runImport} disabled={pending}>{pending ? "Đang import..." : "Bắt đầu import"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
