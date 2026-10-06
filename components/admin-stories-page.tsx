"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileUp, ListPlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, StatusBadge, TableCard } from "@/components/admin-ui";
import { parseStoryImportCsv, storyImportTemplate } from "@/lib/story-import";
import type { StoryStatus } from "@/lib/story-data";
import { chapterPrice, DEFAULT_LOCK_PRICE, formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";

export type AdminStory = { id: string; slug: string; title: string; author: string; description: string; cover_url: string | null; audio_url: string | null; status: StoryStatus; lock_from_chapter: number | null; lock_price_coins: number; ads_disabled: boolean; genres: string[]; chapter_count: number; updated_at: string };
type ChapterDraft = { chapter_number: string; title: string; text_url: string };
type StoryForm = { id?: string; title: string; author: string; description: string; cover_url: string; audio_url: string; status: StoryStatus; genres: string; lock_from_chapter: string; lock_price_coins: string; ads_disabled: boolean; chapters: ChapterDraft[] };
type Message = { tone: "ok" | "error"; text: string };

const statuses: StoryStatus[] = ["Đang ra", "Hoàn thành", "Tạm dừng"];
const textareaClass = "mt-1 min-h-24 w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const selectClass = "mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm";
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

function ChapterRows({ chapters, onChange }: { chapters: ChapterDraft[]; onChange: (chapters: ChapterDraft[]) => void }) {
  const update = (index: number, patch: Partial<ChapterDraft>) => onChange(chapters.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)));
  return <div className="space-y-3">
    {chapters.map((chapter, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[90px_1fr_auto]">
      <label className="text-xs font-medium text-slate-600">Số chương<Input required inputMode="numeric" value={chapter.chapter_number} onChange={(event) => update(index, { chapter_number: event.target.value })} /></label>
      <label className="text-xs font-medium text-slate-600">Tên chương<Input required value={chapter.title} onChange={(event) => update(index, { title: event.target.value })} placeholder="Ví dụ: Thư viện bí ẩn" /></label>
      <Button type="button" variant="ghost" size="icon-sm" className="self-end text-rose-600" aria-label="Bỏ chương này" disabled={chapters.length === 1} onClick={() => onChange(chapters.filter((_, i) => i !== index))}><X className="size-4" /></Button>
      <label className="text-xs font-medium text-slate-600 sm:col-span-3">Link nội dung chương (.txt trên R2 — dùng r2:// cho chương trả phí)<Input required value={chapter.text_url} onChange={(event) => update(index, { text_url: event.target.value })} placeholder="https://pub-….r2.dev/ten-truyen/chuong-1.txt hoặc r2://ten-truyen/chuong-1.txt" /></label>
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => { const last = Number(chapters.at(-1)?.chapter_number); onChange([...chapters, blankChapter(Number.isInteger(last) ? last + 1 : chapters.length + 1)]); }}><Plus className="size-4" />Thêm một chương</Button>
  </div>;
}

function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="mx-auto my-8 max-w-3xl space-y-5 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-cyan-800">{title}</h2>{description && <p className="text-sm text-slate-500">{description}</p>}</div><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={onClose}><X /></Button></div>
      {children}
    </div>
  </div>;
}

type ExistingChapter = { id: string; chapter_number: number; title: string; text_url: string };

async function fetchChapters(storyId: string): Promise<{ chapters: ExistingChapter[] } | { error: string }> {
  try {
    const response = await fetch(`/api/admin/stories/${storyId}/chapters`);
    const body = await response.json().catch(() => ({}));
    return response.ok ? { chapters: body.chapters ?? [] } : { error: body.error ?? "Không tải được danh sách chương." };
  } catch {
    return { error: "Lỗi kết nối đến server." };
  }
}

// Lists a story's chapters with inline edit/delete, plus a form to add new chapters.
function ChapterManager({ story, onChanged }: { story: AdminStory; onChanged: (text: string) => void }) {
  const [chapters, setChapters] = useState<ExistingChapter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExistingChapter | null>(null);
  const [drafts, setDrafts] = useState<ChapterDraft[]>([blankChapter(story.chapter_count + 1)]);
  const [error, setError] = useState<string | null>(null);
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

  async function request(url: string, init: RequestInit, success: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? "Không thể lưu."); return false; }
      onChanged(success);
      await load();
      return true;
    } catch {
      setError("Lỗi kết nối đến server.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (await request(`/api/admin/chapters/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editing.title, text_url: editing.text_url }) }, `Đã sửa chương ${editing.chapter_number}.`)) setEditing(null);
  }

  async function remove(chapter: ExistingChapter) {
    if (!window.confirm(`Xóa chương ${chapter.chapter_number}: ${chapter.title}?`)) return;
    await request(`/api/admin/chapters/${chapter.id}`, { method: "DELETE" }, `Đã xóa chương ${chapter.chapter_number}.`);
  }

  async function addChapters(event: React.FormEvent) {
    event.preventDefault();
    const problem = chapterError(drafts);
    if (problem) return setError(problem);
    await request(`/api/admin/stories/${story.id}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapters: toChapterPayload(drafts) }) }, `Đã thêm ${drafts.length} chương vào "${story.title}".`);
  }

  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    <section>
      <h3 className="mb-2 font-semibold">Chương hiện có {chapters && `(${chapters.length})`}</h3>
      {loadError ? <p className="text-sm text-rose-700">{loadError}</p> : !chapters ? <p className="text-sm text-slate-500">Đang tải...</p> : chapters.length === 0 ? <p className="text-sm text-slate-500">Chưa có chương nào.</p> :
        <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">{chapters.map((chapter) => editing?.id === chapter.id
          ? <form key={chapter.id} onSubmit={saveEdit} className="space-y-2 bg-cyan-50/50 p-3">
              <p className="text-xs font-semibold text-slate-600">Sửa chương {chapter.chapter_number}</p>
              <Input required aria-label="Tên chương" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              <Input required aria-label="Link nội dung" value={editing.text_url} onChange={(event) => setEditing({ ...editing, text_url: event.target.value })} />
              <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" size="sm" disabled={pending}>Lưu</Button></div>
            </form>
          : <div key={chapter.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 tabular-nums text-slate-500">#{chapter.chapter_number}</span>
              <div className="min-w-0 flex-1"><p className="truncate">{chapter.title}</p><p className="truncate text-xs text-slate-400">{chapter.text_url}</p></div>
              {chapterPrice(story, chapter.chapter_number) > 0 && <span className="shrink-0 text-xs text-amber-600">{formatCoins(story.lock_price_coins)}</span>}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Sửa chương ${chapter.chapter_number}`} onClick={() => { setError(null); setEditing(chapter); }}><Pencil className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-rose-600" aria-label={`Xóa chương ${chapter.chapter_number}`} disabled={pending} onClick={() => remove(chapter)}><Trash2 className="size-4" /></Button>
            </div>)}
        </div>}
    </section>
    <form onSubmit={addChapters} className="space-y-3">
      <h3 className="font-semibold">Thêm chương mới</h3>
      <ChapterRows chapters={drafts} onChange={setDrafts} />
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu chương mới"}</Button></div>
    </form>
  </div>;
}

export function AdminStoriesPage({ stories, loadError }: { stories: AdminStory[]; loadError: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả");
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<StoryForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [chapterTarget, setChapterTarget] = useState<AdminStory | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => stories.filter((story) => `${story.title} ${story.author} ${story.genres.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (status === "Tất cả" || story.status === status)), [stories, query, status]);

  async function send(url: string, init: RequestInit) {
    setPending(true);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, body };
    } catch {
      return { ok: false, body: { error: "Lỗi kết nối đến server." } };
    } finally {
      setPending(false);
    }
  }

  function done(text: string) {
    setMessage({ tone: "ok", text });
    router.refresh();
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
    if (!ok) return setImportErrors(body.errors ?? [body.error ?? "Không thể import file."]);
    setImportFile(null);
    done(`Đã import ${body.stories} truyện và ${body.chapters} chương.`);
  }

  async function saveStory(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.id) { const error = chapterError(form.chapters); if (error) return setFormError(error); }
    setFormError(null);
    const payload = { author: form.author, description: form.description, cover_url: form.cover_url, audio_url: form.audio_url, status: form.status, genres: form.genres, lock_from_chapter: form.lock_from_chapter, lock_price_coins: form.lock_price_coins, ads_disabled: form.ads_disabled };
    const { ok, body } = form.id
      ? await send(`/api/admin/stories/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await send("/api/admin/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, title: form.title, chapters: toChapterPayload(form.chapters) }) });
    if (!ok) return setFormError(body.error ?? "Không thể lưu truyện.");
    setForm(null);
    done(form.id ? `Đã cập nhật "${form.title}".` : `Đã đăng truyện "${form.title}".`);
  }

  async function removeStory(story: AdminStory) {
    if (!window.confirm(`Xóa truyện "${story.title}" và toàn bộ ${story.chapter_count} chương? Không thể hoàn tác.`)) return;
    const { ok, body } = await send(`/api/admin/stories/${story.id}`, { method: "DELETE" });
    if (!ok) return setMessage({ tone: "error", text: body.error ?? "Không thể xóa truyện." });
    done(`Đã xóa "${story.title}".`);
  }

  const openCreate = () => { setFormError(null); setMessage(null); setForm({ title: "", author: "", description: "", cover_url: "", audio_url: "", status: "Đang ra", genres: "", lock_from_chapter: "", lock_price_coins: String(DEFAULT_LOCK_PRICE), ads_disabled: false, chapters: [blankChapter(1)] }); };
  const openEdit = (story: AdminStory) => { setFormError(null); setMessage(null); setForm({ id: story.id, title: story.title, author: story.author, description: story.description, cover_url: story.cover_url ?? "", audio_url: story.audio_url ?? "", status: story.status, genres: story.genres.join(" | "), lock_from_chapter: story.lock_from_chapter === null ? "" : String(story.lock_from_chapter), lock_price_coins: String(story.lock_price_coins), ads_disabled: story.ads_disabled, chapters: [] }); };
  const openChapters = (story: AdminStory) => { setMessage(null); setChapterTarget(story); };

  return <>
    <PageHeading title="Quản lý truyện" description="Đăng truyện mới, thêm chương, sửa thông tin và import hàng loạt từ file CSV." action={<div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="size-4" />Tải file mẫu</Button>
      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="size-4" />Import hàng loạt</Button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { setImportErrors([]); setMessage(null); setImportFile(file); } }} />
      <Button onClick={openCreate}><Plus className="size-4" />Đăng truyện mới</Button>
    </div>} />

    {loadError && <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Không tải được danh sách truyện: {loadError}</p>}
    {message && <p role="status" className={cn("mb-4 rounded-md px-3 py-2 text-sm", message.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{message.text}</p>}

    <TableCard title={`Danh sách truyện (${stories.length})`}>
      <div className="flex flex-wrap gap-3 border-b p-4">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên truyện, tác giả, thể loại..." className="pl-9" aria-label="Tìm truyện" /></div>
        <select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><option>Tất cả</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Truyện</th><th className="px-5 py-3">Thể loại</th><th className="px-5 py-3 text-right">Số chương</th><th className="px-5 py-3">Khóa chương</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Cập nhật</th><th className="px-5 py-3"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>{filtered.map((story) => <tr key={story.id} className="border-t">
          <td className="max-w-72 px-5 py-3"><p className="truncate font-medium">{story.title}</p><p className="truncate text-xs text-slate-400">{story.author}</p></td>
          <td className="max-w-56 truncate px-5 py-3 text-slate-500">{story.genres.join(", ") || "—"}</td>
          <td className="px-5 py-3 text-right tabular-nums">{story.chapter_count}</td>
          <td className="whitespace-nowrap px-5 py-3 text-slate-500">{story.lock_from_chapter === null ? "Miễn phí" : `Từ ch.${story.lock_from_chapter} · ${formatCoins(story.lock_price_coins)}`}{story.ads_disabled && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">Không QC</span>}</td>
          <td className="px-5 py-3"><StatusBadge>{story.status}</StatusBadge></td>
          <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dateFormat.format(new Date(story.updated_at))}</td>
          <td className="px-5 py-3"><div className="flex justify-end gap-1">
            <Link href={`/truyen/${story.slug}`} target="_blank" aria-label="Xem trang truyện" className="inline-flex size-7 items-center justify-center rounded-md hover:bg-slate-100"><ExternalLink className="size-4" /></Link>
            <Button variant="ghost" size="icon-sm" aria-label="Quản lý chương" onClick={() => openChapters(story)}><ListPlus className="size-4" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Sửa thông tin truyện" onClick={() => openEdit(story)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label="Xóa truyện" disabled={pending} onClick={() => removeStory(story)}><Trash2 className="size-4" /></Button>
          </div></td>
        </tr>)}</tbody>
      </table></div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{stories.length ? "Không có truyện phù hợp." : "Chưa có truyện nào. Bấm \"Đăng truyện mới\" hoặc \"Import hàng loạt\" để bắt đầu."}</p>}
    </TableCard>

    {form && <Modal title={form.id ? `Sửa: ${form.title}` : "Đăng truyện mới"} description={form.id ? "Tên truyện giữ nguyên để không làm hỏng đường link và số liệu thống kê." : "Nhập thông tin truyện và ít nhất một chương."} onClose={() => setForm(null)}>
      <form onSubmit={saveStory} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Tên truyện<Input required disabled={!!form.id} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label className="text-sm font-medium">Tác giả<Input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></label>
        </div>
        <label className="block text-sm font-medium">Thể loại<Input value={form.genres} onChange={(event) => setForm({ ...form, genres: event.target.value })} placeholder="Tiên Hiệp | Huyền Huyễn" /><span className="text-xs font-normal text-slate-500">Nhiều thể loại cách nhau bằng dấu | hoặc dấu phẩy.</span></label>
        <label className="block text-sm font-medium">Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={textareaClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Link ảnh bìa (tùy chọn)<Input type="url" value={form.cover_url} onChange={(event) => setForm({ ...form, cover_url: event.target.value })} /></label>
          <label className="text-sm font-medium">Link Mê Nghe Truyện (tùy chọn)<Input type="url" value={form.audio_url} onChange={(event) => setForm({ ...form, audio_url: event.target.value })} /></label>
        </div>
        <label className="block text-sm font-medium">Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as StoryStatus })} className={selectClass}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <fieldset className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <legend className="px-1 text-sm font-semibold text-amber-800">Khóa chương bằng Xu</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Khóa từ chương số<Input inputMode="numeric" value={form.lock_from_chapter} onChange={(event) => setForm({ ...form, lock_from_chapter: event.target.value })} placeholder="Để trống = miễn phí toàn bộ" /></label>
            <label className="text-sm font-medium">Giá mỗi chương (Xu)<Input inputMode="numeric" value={form.lock_price_coins} onChange={(event) => setForm({ ...form, lock_price_coins: event.target.value })} /></label>
          </div>
          <p className="mt-2 text-xs text-slate-600">{/^\d+$/.test(form.lock_from_chapter) && Number(form.lock_from_chapter) > 0 ? `Chương 1–${Number(form.lock_from_chapter) - 1} miễn phí; từ chương ${form.lock_from_chapter} trở đi mỗi chương ${form.lock_price_coins || DEFAULT_LOCK_PRICE} Xu (1 Xu = 100đ). Chương thêm sau cũng tự khóa.` : "Toàn bộ truyện đang miễn phí."}</p>
        </fieldset>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-0.5 size-4" checked={form.ads_disabled} onChange={(event) => setForm({ ...form, ads_disabled: event.target.checked })} /><span><b className="block">Tắt quảng cáo cho truyện này</b><span className="text-slate-500">Bật với truyện có nội dung người lớn/nhạy cảm — Google không cho đặt quảng cáo cạnh nội dung đó.</span></span></label>
        {!form.id && <div><h3 className="mb-2 font-semibold">Danh sách chương</h3><ChapterRows chapters={form.chapters} onChange={(chapters) => setForm({ ...form, chapters })} /></div>}
        {formError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setForm(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Đăng truyện"}</Button></div>
      </form>
    </Modal>}

    {chapterTarget && <Modal title={`Chương: ${chapterTarget.title}`} description="Sửa tên/link từng chương, xóa chương chưa có ai mua, hoặc thêm chương mới." onClose={() => { setChapterTarget(null); router.refresh(); }}>
      <ChapterManager story={chapterTarget} onChanged={(text) => setMessage({ tone: "ok", text })} />
    </Modal>}

    {importFile && <Modal title="Import truyện hàng loạt" onClose={() => { setImportFile(null); setImportErrors([]); }}>
      <p className="text-sm text-slate-600">File: <strong>{importFile.name}</strong> ({Math.ceil(importFile.size / 1024)} KB)</p>
      {importErrors.length > 0 && <div className="max-h-48 overflow-y-auto rounded-md bg-rose-50 p-3 text-sm text-rose-700"><p className="mb-1 font-semibold">Không thể import:</p><ul className="list-inside list-disc">{importErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <p className="text-xs text-slate-500">Mỗi dòng là một chương. Các dòng có cùng <strong>title</strong> được gộp vào một truyện. Truyện đã có trên hệ thống sẽ bị từ chối — dùng nút &quot;Thêm chương&quot; để bổ sung chương.</p>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setImportFile(null)}>Hủy</Button><Button type="button" onClick={runImport} disabled={pending}>{pending ? "Đang import..." : "Bắt đầu import"}</Button></div>
    </Modal>}
  </>;
}
