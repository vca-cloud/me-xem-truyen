"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BookUp, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { AuthorStoryDialog, type AuthorStory } from "@/components/author-area";
import { useConfirm } from "@/components/confirm-dialog";
import { ManuscriptDialog } from "@/components/manuscript-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_CHAPTER_CHARS, publishStatusLabels } from "@/lib/author-rules";
import { chapterPrice, formatCoins } from "@/lib/coins";

export type AuthorChapter = { id: string; chapter_number: number; title: string; publish_status: string; review_note: string | null; ads_enabled: boolean; updated_at: string };
type Editor = { id?: string; chapter_number: string; title: string; content: string; loading?: boolean };

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "outline", submitted: "secondary", published: "default", rejected: "destructive" };

async function send(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: response.ok, body: await response.json().catch(() => ({})) as Record<string, unknown> };
  } catch {
    return { ok: false, body: { error: "Lỗi kết nối đến server." } as Record<string, unknown> };
  }
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function AuthorStoryChapters({ story, chapters, catalog, trusted }: { story: AuthorStory; chapters: AuthorChapter[]; catalog: string[]; trusted: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editingStory, setEditingStory] = useState(false);
  const [pending, setPending] = useState(false);
  const [manuscriptOpen, setManuscriptOpen] = useState(false);
  const nextNumber = (chapters.at(-1)?.chapter_number ?? 0) + 1;

  async function open(chapter?: AuthorChapter) {
    if (!chapter) return setEditor({ chapter_number: String(nextNumber), title: "", content: "" });
    setEditor({ id: chapter.id, chapter_number: String(chapter.chapter_number), title: chapter.title, content: "", loading: true });
    const { ok, body } = await send(`/api/author/chapters/${chapter.id}`, "GET");
    if (!ok) { setEditor(null); return toast.error(String(body.error ?? "Không tải được chương.")); }
    setEditor({ id: chapter.id, chapter_number: String(chapter.chapter_number), title: String(body.title), content: String(body.content ?? "") });
  }

  async function save(submit: boolean) {
    if (!editor) return;
    setPending(true);
    const payload = { chapter_number: Number(editor.chapter_number), title: editor.title, content: editor.content, submit };
    const { ok, body } = editor.id ? await send(`/api/author/chapters/${editor.id}`, "PATCH", payload) : await send(`/api/author/stories/${story.id}/chapters`, "POST", payload);
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không lưu được chương."));
    const status = String(body.publish_status);
    toast.success(status === "published" ? "Chương đã được đăng." : status === "submitted" ? "Đã gửi duyệt. Admin sẽ xem và đăng sớm." : "Đã lưu nháp.", body.flagged ? { description: "Chương có từ cần kiểm duyệt: quảng cáo tạm tắt cho tới khi admin duyệt." } : undefined);
    setEditor(null);
    router.refresh();
  }

  async function remove(chapter: AuthorChapter) {
    if (!await confirm({ title: `Xóa chương ${chapter.chapter_number}?`, description: "Chỉ xóa được chương chưa đăng.", confirmText: "Xóa", destructive: true })) return;
    const { ok, body } = await send(`/api/author/chapters/${chapter.id}`, "DELETE");
    if (!ok) return toast.error(String(body.error ?? "Không xóa được."));
    toast.success("Đã xóa chương.");
    router.refresh();
  }

  const published = editor?.id && chapters.find((chapter) => chapter.id === editor.id)?.publish_status === "published";

  return <>
    <Button variant="ghost" size="sm" className="mb-3" nativeButton={false} render={<Link href="/tac-gia" />}><ArrowLeft />Khu vực tác giả</Button>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="truncate text-2xl font-bold tracking-tight">{story.title}</h1><p className="text-sm text-muted-foreground">{story.lock_from_chapter ? `Khóa từ chương ${story.lock_from_chapter}, ${formatCoins(story.lock_price_coins)}/chương` : "Miễn phí toàn bộ"} · {trusted ? "Tác giả tin cậy: chương sạch được đăng ngay" : "Chương mới cần admin duyệt trước khi đăng"}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditingStory(true)}><Pencil />Sửa thông tin</Button><Button variant="outline" onClick={() => setManuscriptOpen(true)}><BookUp />Tải bản thảo</Button><Button onClick={() => open()}><Plus />Viết chương {nextNumber}</Button></div>
    </div>

    <Card><CardHeader><CardTitle>Danh sách chương ({chapters.length})</CardTitle></CardHeader>
      <CardContent className="px-0">{chapters.length ? <div className="divide-y">{chapters.map((chapter) => <div key={chapter.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
        <span className="w-10 shrink-0 tabular-nums text-muted-foreground">#{chapter.chapter_number}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{chapter.title}</p>{chapter.review_note && <p className="text-xs text-destructive">Lý do từ chối: {chapter.review_note}</p>}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant[chapter.publish_status] ?? "outline"}>{publishStatusLabels[chapter.publish_status] ?? chapter.publish_status}</Badge>
          {chapterPrice(story, chapter.chapter_number) > 0 && <Badge variant="outline">{formatCoins(story.lock_price_coins)}</Badge>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Sửa chương ${chapter.chapter_number}`} onClick={() => open(chapter)}><Pencil /></Button>
          {chapter.publish_status !== "published" && <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Xóa chương ${chapter.chapter_number}`} onClick={() => remove(chapter)}><Trash2 /></Button>}
        </div>
      </div>)}</div> : <p className="px-6 py-10 text-center text-sm text-muted-foreground">Chưa có chương nào.</p>}</CardContent>
    </Card>

    <Dialog open={!!editor} onOpenChange={(value) => { if (!value) setEditor(null); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        {editor && <div className="space-y-4">
          <DialogHeader><DialogTitle>{editor.id ? `Sửa chương ${editor.chapter_number}` : `Chương mới`}</DialogTitle><DialogDescription>Dán hoặc gõ nội dung chương. Không cần ghi lại dòng “Chương N: …” ở đầu nội dung.</DialogDescription></DialogHeader>
          {published && <Alert><AlertDescription>Chương đã đăng: sửa nội dung sẽ gửi lại để duyệt{trusted ? " (tự đăng lại nếu nội dung sạch)" : ""}.</AlertDescription></Alert>}
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
              <Field><FieldLabel htmlFor="c-number">Số chương</FieldLabel><Input id="c-number" inputMode="numeric" disabled={!!editor.id} value={editor.chapter_number} onChange={(event) => setEditor({ ...editor, chapter_number: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="c-title">Tên chương</FieldLabel><Input id="c-title" maxLength={300} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></Field>
            </div>
            <Field><FieldLabel htmlFor="c-content">Nội dung</FieldLabel>
              <Textarea id="c-content" rows={18} disabled={editor.loading} maxLength={MAX_CHAPTER_CHARS} value={editor.loading ? "Đang tải..." : editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} className="font-serif text-base leading-7" />
              <FieldDescription>{words(editor.content).toLocaleString("vi-VN")} chữ · {editor.content.length.toLocaleString("vi-VN")}/{MAX_CHAPTER_CHARS.toLocaleString("vi-VN")} ký tự. Từ ngữ nhạy cảm sẽ được tự động che khi hiển thị.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditor(null)}>Hủy</Button>
            {!published && <Button type="button" variant="secondary" disabled={pending || editor.loading} onClick={() => save(false)}>Lưu nháp</Button>}
            <Button type="button" disabled={pending || editor.loading} onClick={() => save(true)}><Send />{pending ? "Đang lưu..." : trusted ? "Đăng" : "Gửi duyệt"}</Button>
          </DialogFooter>
        </div>}
      </DialogContent>
    </Dialog>

    <ManuscriptDialog open={manuscriptOpen} onOpenChange={setManuscriptOpen} mode="author" story={story} existingNumbers={chapters.map((chapter) => chapter.chapter_number)} onDone={() => router.refresh()} />
    {editingStory && <AuthorStoryDialog open={editingStory} onOpenChange={setEditingStory} story={story} catalog={catalog} />}
  </>;
}
