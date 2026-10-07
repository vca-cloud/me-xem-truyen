"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, RefreshCw } from "lucide-react";
import { GenreCombobox } from "@/components/genre-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_LOCK_PRICE } from "@/lib/coins";
import { storySlug, type StoryStatus } from "@/lib/story-data";

type Source = "public" | "private";
type PreviewChapter = { chapter_number: number; title: string; text_url: string; file: string; size: number };
type Preview = { source: Source; prefix: string; folderName: string; chapters: PreviewChapter[]; skipped: string[]; duplicates: string[]; truncated: boolean };
type ExistingStory = { id: string; slug: string; title: string; chapter_count: number };

const sourceLabels: Record<Source, string> = { public: "Bucket public (chương miễn phí)", private: "Bucket riêng tư (chương trả phí)" };
const statuses: StoryStatus[] = ["Đang ra", "Hoàn thành", "Tạm dừng"];
const BATCH = 500;

async function getJson(url: string) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, body: { error: "Lỗi kết nối đến server." } as Record<string, unknown> };
  }
}

async function postJson(url: string, body: unknown) {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: response.ok, body: await response.json().catch(() => ({})) as Record<string, unknown> };
  } catch {
    return { ok: false, body: { error: "Lỗi kết nối đến server." } as Record<string, unknown> };
  }
}

// "Nhập từ Cloudflare": pick an R2 folder, preview its chapter files, then create the story or add only new chapters.
export function R2ImportDialog({ open, onOpenChange, stories, catalog, onGenreCreated, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; stories: ExistingStory[]; catalog: string[]; onGenreCreated: (name: string) => void; onDone: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [folders, setFolders] = useState<string[] | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [existingNumbers, setExistingNumbers] = useState<Set<number> | null>(null);
  const [form, setForm] = useState({ title: "", author: "", genres: [] as string[], status: "Đang ra" as StoryStatus, lock_from_chapter: "", lock_price_coins: String(DEFAULT_LOCK_PRICE) });
  const [pending, setPending] = useState(false);

  // Load folder list whenever the dialog opens or the bucket changes.
  useEffect(() => {
    if (!open) return;
    let active = true;
    getJson(`/api/admin/r2/folders${source ? `?source=${source}` : ""}`).then(({ ok, body }) => {
      if (!active) return;
      setSources((body.sources as Source[]) ?? []);
      if (!ok) { setSetupError(String(body.error ?? "Không đọc được Cloudflare R2.")); setFolders([]); return; }
      setSetupError(null);
      setSource(body.source as Source);
      setFolders(body.folders as string[]);
    });
    return () => { active = false; };
  }, [open, source]);

  const target = useMemo(() => {
    if (!preview) return null;
    const slug = storySlug(form.title || preview.folderName);
    return stories.find((story) => story.slug === slug || story.slug === storySlug(preview.folderName)) ?? null;
  }, [preview, stories, form.title]);

  // For an existing story, find which chapter numbers are already published.
  useEffect(() => {
    if (!target) return;
    let active = true;
    getJson(`/api/admin/stories/${target.id}/chapters`).then(({ ok, body }) => {
      if (active) setExistingNumbers(new Set(ok ? (body.chapters as { chapter_number: number }[]).map((chapter) => chapter.chapter_number) : []));
    });
    return () => { active = false; };
  }, [target]);

  async function choose(next: string | null) {
    setFolder(next);
    setPreview(null);
    setPreviewError(null);
    setExistingNumbers(null);
    if (!next || !source) return;
    setLoadingPreview(true);
    const { ok, body } = await getJson(`/api/admin/r2/preview?source=${source}&prefix=${encodeURIComponent(next)}`);
    setLoadingPreview(false);
    if (!ok) return setPreviewError(String(body.error ?? "Không đọc được thư mục."));
    const result = body as unknown as Preview;
    setPreview(result);
    setForm((current) => ({ ...current, title: result.folderName, lock_from_chapter: source === "private" ? "1" : current.lock_from_chapter }));
  }

  const newChapters = preview ? (target && existingNumbers ? preview.chapters.filter((chapter) => !existingNumbers.has(chapter.chapter_number)) : preview.chapters) : [];

  function updateTitle(number: number, title: string) {
    setPreview((current) => current && { ...current, chapters: current.chapters.map((chapter) => chapter.chapter_number === number ? { ...chapter, title } : chapter) });
  }

  async function submit() {
    if (!preview || !newChapters.length) return;
    const chapters = newChapters.map(({ chapter_number, title, text_url }) => ({ chapter_number, title: title.trim() || `Chương ${chapter_number}`, text_url }));
    setPending(true);
    try {
      if (target) {
        for (let index = 0; index < chapters.length; index += BATCH) {
          const { ok, body } = await postJson(`/api/admin/stories/${target.id}/chapters`, { chapters: chapters.slice(index, index + BATCH) });
          if (!ok) return toast.error(String(body.error ?? "Không thể thêm chương."));
        }
        toast.success(`Đã thêm ${chapters.length} chương mới vào "${target.title}".`);
      } else {
        if (!form.title.trim() || !form.author.trim()) return toast.error("Vui lòng nhập tên truyện và tác giả.");
        const [first, ...rest] = [chapters.slice(0, BATCH), ...Array.from({ length: Math.ceil(chapters.length / BATCH) - 1 }, (_, i) => chapters.slice((i + 1) * BATCH, (i + 2) * BATCH))];
        const { ok, body } = await postJson("/api/admin/stories", { ...form, description: "", chapters: first });
        if (!ok) return toast.error(String(body.error ?? "Không thể đăng truyện."));
        const storyId = (body.story as { id: string }).id;
        for (const batch of rest) {
          const result = await postJson(`/api/admin/stories/${storyId}/chapters`, { chapters: batch });
          if (!result.ok) return toast.error(String(result.body.error ?? "Không thể thêm chương."));
        }
        toast.success(`Đã đăng "${form.title}" với ${chapters.length} chương.`);
      }
      onDone();
      onOpenChange(false);
      setFolder(null);
      setPreview(null);
    } finally {
      setPending(false);
    }
  }

  const folderItems = (folders ?? []).map((value) => ({ value, label: value.replace(/\/$/, "").normalize("NFC") }));

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Nhập truyện từ Cloudflare R2</DialogTitle>
        <DialogDescription>Chọn thư mục truyện trên R2. Các file .txt được sắp theo số trong tên file (Chương 1.txt, Chương 2.txt…) và tên chương lấy từ dòng đầu mỗi file.</DialogDescription>
      </DialogHeader>

      {setupError ? <Alert variant="destructive"><AlertTitle>Chưa kết nối được Cloudflare R2</AlertTitle><AlertDescription><p>{setupError}</p><p className="mt-1">Cách tạo: Cloudflare → R2 → Manage API tokens → Create API token, quyền <b>Object Read only</b> cho bucket truyện. Điền Access Key ID và Secret Access Key vào R2_ACCESS_KEY_ID và R2_SECRET_ACCESS_KEY (file .env.local hoặc Vercel), rồi khởi động lại web.</p></AlertDescription></Alert> : <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
          {sources.length > 1 && <Field><FieldLabel>Bucket</FieldLabel>
            <Select items={sources.map((value) => ({ value, label: sourceLabels[value] }))} value={source} onValueChange={(value) => { setSource(value as Source); setFolders(null); void choose(null); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{sources.map((value) => <SelectItem key={value} value={value}>{sourceLabels[value]}</SelectItem>)}</SelectContent></Select>
          </Field>}
          <Field className={sources.length > 1 ? "" : "sm:col-span-2"}><FieldLabel htmlFor="r2-folder">Thư mục truyện</FieldLabel>
            {folders === null ? <Skeleton className="h-8 w-full" /> : <Combobox items={folderItems} value={folderItems.find((item) => item.value === folder) ?? null} onValueChange={(item) => void choose(item?.value ?? null)} itemToStringLabel={(item) => item.label} isItemEqualToValue={(a, b) => a.value === b.value} autoHighlight>
              <ComboboxInput id="r2-folder" placeholder={folders.length ? "Gõ để tìm thư mục..." : "Bucket chưa có thư mục nào"} className="w-full" />
              <ComboboxContent><ComboboxEmpty>Không có thư mục phù hợp.</ComboboxEmpty><ComboboxList>{(item: { value: string; label: string }) => <ComboboxItem key={item.value} value={item}><FolderOpen className="text-muted-foreground" />{item.label}</ComboboxItem>}</ComboboxList></ComboboxContent>
            </Combobox>}
          </Field>
        </div>

        {loadingPreview && <div className="space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-40 w-full" /></div>}
        {previewError && <Alert variant="destructive"><AlertDescription>{previewError}</AlertDescription></Alert>}

        {preview && <>
          <Alert>
            <AlertTitle>{preview.chapters.length} chương trong thư mục “{preview.folderName}”</AlertTitle>
            <AlertDescription>
              {target ? (existingNumbers ? <p>Truyện <b>{target.title}</b> đã có {existingNumbers.size} chương — sẽ thêm <b>{newChapters.length}</b> chương mới{newChapters.length ? ` (số ${newChapters[0].chapter_number}${newChapters.length > 1 ? `–${newChapters.at(-1)!.chapter_number}` : ""})` : ""}.</p> : <p>Đang so với truyện đã đăng...</p>) : <p>Truyện mới — điền tác giả và thể loại rồi bấm Đăng truyện.</p>}
              {preview.skipped.length > 0 && <p className="mt-1">Bỏ qua {preview.skipped.length} file không có số chương: {preview.skipped.slice(0, 5).join(", ")}{preview.skipped.length > 5 ? "…" : ""}</p>}
              {preview.duplicates.length > 0 && <p className="mt-1 text-destructive">Trùng số chương, chỉ lấy file đầu: {preview.duplicates.slice(0, 3).join("; ")}</p>}
            </AlertDescription>
          </Alert>

          {!target && <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="r2-title">Tên truyện</FieldLabel><Input id="r2-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
            <Field><FieldLabel htmlFor="r2-author">Tác giả</FieldLabel><Input id="r2-author" required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></Field>
            <Field className="sm:col-span-2"><FieldLabel htmlFor="r2-genres">Thể loại</FieldLabel><GenreCombobox id="r2-genres" catalog={catalog} value={form.genres} onChange={(genres) => setForm((current) => ({ ...current, genres }))} onCreated={onGenreCreated} /></Field>
            <Field><FieldLabel>Trạng thái</FieldLabel><Select items={statuses.map((value) => ({ value, label: value }))} value={form.status} onValueChange={(value) => setForm({ ...form, status: value as StoryStatus })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
            <Field><FieldLabel htmlFor="r2-lock">Khóa từ chương số</FieldLabel><Input id="r2-lock" inputMode="numeric" value={form.lock_from_chapter} onChange={(event) => setForm({ ...form, lock_from_chapter: event.target.value })} placeholder="Để trống = miễn phí" /><FieldDescription>Giá mỗi chương: {form.lock_price_coins} Xu (sửa sau trong form truyện).</FieldDescription></Field>
          </div>}

          {newChapters.length > 0 && <div className="max-h-72 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead className="w-16 pl-3">Số</TableHead><TableHead>Tên chương (sửa được)</TableHead><TableHead className="hidden pr-3 sm:table-cell">File</TableHead></TableRow></TableHeader>
              <TableBody>{newChapters.map((chapter) => <TableRow key={chapter.chapter_number}>
                <TableCell className="pl-3 tabular-nums">{chapter.chapter_number}</TableCell>
                <TableCell><Input aria-label={`Tên chương ${chapter.chapter_number}`} value={chapter.title} onChange={(event) => updateTitle(chapter.chapter_number, event.target.value)} className="h-7" /></TableCell>
                <TableCell className="hidden max-w-48 truncate pr-3 text-xs text-muted-foreground sm:table-cell">{chapter.file}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>}
          {target && existingNumbers && newChapters.length === 0 && <p className="text-sm text-muted-foreground">Không có chương mới — truyện đã có đủ các chương trong thư mục.</p>}
        </>}
      </FieldGroup>}

      <DialogFooter>
        {preview && <Button type="button" variant="ghost" onClick={() => folder && choose(folder)} disabled={loadingPreview}><RefreshCw />Đọc lại thư mục</Button>}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        <Button type="button" onClick={submit} disabled={pending || !preview || !newChapters.length || (!!target && !existingNumbers)}>
          {pending ? "Đang lưu..." : target ? `Thêm ${newChapters.length} chương mới` : `Đăng truyện (${newChapters.length} chương)`}
        </Button>
        {preview && target && <Badge variant="secondary" className="self-center">Truyện đã có</Badge>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
