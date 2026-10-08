"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, Pencil, Plus, Search, ShieldOff, Trash2 } from "lucide-react";
import { PageHeading, TableCard } from "@/components/admin-ui";
import { ModerationRescanPanel, RESCAN_EVENT } from "@/components/moderation-rescan-panel";
import { useConfirm } from "@/components/confirm-dialog";
import { MatureBadge, ModerationStatusBadge, type ModerationHitSummary } from "@/components/moderation-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { publishStatusLabels } from "@/lib/author-rules";
import { categoryLabels, severityLabels, type MaskStyle, type ModerationCategory } from "@/lib/moderation-core";
import { Textarea } from "@/components/ui/textarea";

export type QueueItem = { id: string; story_title: string; story_slug: string; chapter_number: number; title: string; ads_enabled: boolean; moderation_status: string; moderation_score: number; moderation_hits: ModerationHitSummary[]; is_mature: boolean; publish_status: string; review_note: string | null; author_pen_name: string | null };
export type DictionaryTerm = { id: string; term: string; category: ModerationCategory; severity: number; mask_style: MaskStyle; active: boolean };
type TermDraft = Omit<DictionaryTerm, "id" | "active"> & { id?: string; active: boolean };

const categoryItems = (Object.keys(categoryLabels) as ModerationCategory[]).map((value) => ({ value, label: categoryLabels[value] }));
const severityItems = [1, 2, 3].map((value) => ({ value: String(value), label: severityLabels[value] }));
const maskLabels: Record<MaskStyle, string> = { stars: "Sao (đ***)", dots: "Chấm (c.h.ế.t)", none: "Không che" };
const maskItems = (Object.keys(maskLabels) as MaskStyle[]).map((value) => ({ value, label: maskLabels[value] }));
const filterItems = [{ value: "all", label: "Tất cả nhóm" }, ...categoryItems];

async function send(url: string, init: RequestInit) {
  try {
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, error: (body.error as string | undefined) ?? "Không thể lưu." };
  } catch {
    return { ok: false, error: "Lỗi kết nối đến server." };
  }
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

type Decision = { ads_enabled?: boolean; is_mature?: boolean; approve?: boolean; publish?: boolean; reject?: string };

function QueueTable({ items, onDecide, onReject, pending }: { items: QueueItem[]; onDecide: (item: QueueItem, patch: Decision, message: string) => void; onReject: (item: QueueItem) => void; pending: boolean }) {
  if (!items.length) return <p className="px-5 py-10 text-center text-sm text-muted-foreground">Không có chương nào.</p>;
  return <div className="divide-y">{items.map((item) => <div key={item.id} className="space-y-3 px-5 py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">{item.is_mature && <MatureBadge />}<span className="truncate">{item.story_title} — Chương {item.chapter_number}: {item.title}</span></p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">{item.author_pen_name && <Badge variant="outline">Tác giả: {item.author_pen_name}</Badge>}{item.publish_status !== "published" && <Badge variant={item.publish_status === "submitted" ? "destructive" : "secondary"}>{publishStatusLabels[item.publish_status] ?? item.publish_status}</Badge>}<ModerationStatusBadge status={item.moderation_status} /><Badge variant="outline">Điểm {item.moderation_score}</Badge><Badge variant={item.ads_enabled ? "secondary" : "destructive"}>{item.ads_enabled ? "Đang có quảng cáo" : "Đang tắt quảng cáo"}</Badge></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.publish_status === "submitted" ? <>
          <Button size="sm" disabled={pending} onClick={() => onDecide(item, { publish: true, ads_enabled: true }, "Đã đăng, bật quảng cáo.")}><Check />Đăng, bật QC</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onDecide(item, { publish: true, ads_enabled: false }, "Đã đăng, tắt quảng cáo.")}><ShieldOff />Đăng, tắt QC</Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => onReject(item)}>Từ chối…</Button>
        </> : <>
          <Button size="sm" disabled={pending} onClick={() => onDecide(item, { ads_enabled: true }, "Đã duyệt và bật quảng cáo.")}><Check />Duyệt, bật QC</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onDecide(item, { ads_enabled: false }, "Đã duyệt, giữ tắt quảng cáo.")}><ShieldOff />Giữ tắt QC</Button>
        </>}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => onDecide(item, { is_mature: !item.is_mature }, item.is_mature ? "Đã bỏ nhãn 18+." : "Đã gắn nhãn 18+.")}>{item.is_mature ? "Bỏ 18+" : "Gắn 18+"}</Button>
        <Button size="icon-sm" variant="ghost" aria-label="Mở chương" nativeButton={false} render={<Link href={`/truyen/${item.story_slug}/chuong/${item.chapter_number}`} target="_blank" />}><ExternalLink /></Button>
      </div>
    </div>
    {item.review_note && <p className="text-sm text-destructive">Lý do từ chối: {item.review_note}</p>}
    {item.moderation_hits?.length > 0 && <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">{item.moderation_hits.slice(0, 6).map((hit) => <li key={hit.term} className="grid gap-0.5 sm:grid-cols-[12rem_1fr]">
      <span><b>“{hit.term}”</b> ×{hit.count} <span className="text-xs text-muted-foreground">· {categoryLabels[hit.category as ModerationCategory] ?? hit.category} · mức {hit.severity}</span></span>
      {hit.sample && <span className="truncate text-muted-foreground" title={hit.sample}>{hit.sample}</span>}
    </li>)}</ul>}
  </div>)}</div>;
}

// After each dictionary change: masking applies at once; offer the site-wide re-scan (run it once when done editing).
const rescanPrompt = {
  description: "Che chữ áp dụng cho trang đọc trong ~1 phút. Sửa xong hết thì quét lại toàn web để cập nhật quảng cáo và hàng chờ duyệt.",
  action: { label: "Quét lại toàn web", onClick: () => window.dispatchEvent(new Event(RESCAN_EVENT)) },
  duration: 8000,
};

export function AdminModerationPage({ queue, dictionary, loadError }: { queue: QueueItem[]; dictionary: DictionaryTerm[]; loadError: string | null }) {
  const dictionaryVersion = dictionary.map((term) => `${term.id}:${term.term}:${term.severity}:${term.active}`).join("|");
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<TermDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState<{ item: QueueItem; reason: string } | null>(null);
  const waiting = queue.filter((item) => item.moderation_status === "pending" || item.publish_status === "submitted");
  const handled = queue.filter((item) => item.moderation_status !== "pending" && item.publish_status !== "submitted");
  const terms = useMemo(() => dictionary.filter((term) => (category === "all" || term.category === category) && term.term.toLowerCase().includes(query.toLowerCase())), [dictionary, category, query]);

  async function decide(item: QueueItem, patch: Decision, message: string) {
    setPending(true);
    const result = await send(`/api/admin/chapters/${item.id}`, json("PATCH", patch));
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(`${item.story_title} — chương ${item.chapter_number}: ${message}`);
    router.refresh();
  }

  async function saveTerm(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setPending(true);
    const result = await send(draft.id ? `/api/admin/moderation-terms/${draft.id}` : "/api/admin/moderation-terms", json(draft.id ? "PATCH" : "POST", draft));
    setPending(false);
    if (!result.ok) return setDraftError(result.error);
    toast.success(draft.id ? "Đã cập nhật từ." : `Đã thêm “${draft.term}” vào từ điển.`, rescanPrompt);
    setDraft(null);
    router.refresh();
  }

  async function toggleTerm(term: DictionaryTerm, active: boolean) {
    const result = await send(`/api/admin/moderation-terms/${term.id}`, json("PATCH", { ...term, active }));
    if (!result.ok) return toast.error(result.error);
    toast.success(active ? `Đã bật “${term.term}”.` : `Đã tắt “${term.term}”.`, rescanPrompt);
    router.refresh();
  }

  async function removeTerm(term: DictionaryTerm) {
    if (!await confirm({ title: `Xóa “${term.term}” khỏi từ điển?`, description: "Từ này sẽ không còn bị che và không còn được tính khi quét.", confirmText: "Xóa", destructive: true })) return;
    const result = await send(`/api/admin/moderation-terms/${term.id}`, { method: "DELETE" });
    if (!result.ok) return toast.error(result.error);
    toast.success(`Đã xóa “${term.term}”.`, rescanPrompt);
    router.refresh();
  }

  return <>
    <PageHeading title="Kiểm duyệt nội dung" description="Chương có từ mức nặng được tắt quảng cáo và chờ duyệt. Từ trong từ điển luôn được che trên trang đọc." />
    {loadError && <Alert variant="destructive" className="mb-4"><AlertTitle>Không tải được dữ liệu kiểm duyệt</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
    <ModerationRescanPanel version={dictionaryVersion} />
    <Tabs defaultValue="queue">
      <TabsList className="mb-4"><TabsTrigger value="queue">Chờ duyệt ({waiting.length})</TabsTrigger><TabsTrigger value="handled">Đã xử lý ({handled.length})</TabsTrigger><TabsTrigger value="dictionary">Từ điển ({dictionary.length})</TabsTrigger></TabsList>
      <TabsContent value="queue"><TableCard title="Chương chờ duyệt"><QueueTable items={waiting} onDecide={decide} onReject={(item) => setRejecting({ item, reason: "" })} pending={pending} /></TableCard></TabsContent>
      <TabsContent value="handled"><TableCard title="Đã duyệt / đang tắt quảng cáo / 18+"><QueueTable items={handled} onDecide={decide} onReject={(item) => setRejecting({ item, reason: "" })} pending={pending} /></TableCard></TabsContent>
      <TabsContent value="dictionary">
        <TableCard title="Từ điển che chữ" action={<Button size="sm" onClick={() => { setDraftError(null); setDraft({ term: "", category: "profanity", severity: 2, mask_style: "stars", active: true }); }}><Plus />Thêm từ</Button>}>
          <div className="flex flex-wrap gap-3 border-b p-4">
            <div className="relative min-w-[200px] flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm từ..." className="pl-8" aria-label="Tìm từ" /></div>
            <Select items={filterItems} value={category} onValueChange={(value) => setCategory(String(value))}><SelectTrigger className="w-44" aria-label="Lọc nhóm"><SelectValue /></SelectTrigger><SelectContent>{filterItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <Table className="min-w-[720px]">
            <TableHeader><TableRow><TableHead className="pl-5">Từ / cụm từ</TableHead><TableHead>Nhóm</TableHead><TableHead>Mức</TableHead><TableHead>Kiểu che</TableHead><TableHead>Bật</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
            <TableBody>{terms.map((term) => <TableRow key={term.id}>
              <TableCell className="pl-5 font-medium">{term.term}</TableCell>
              <TableCell>{categoryLabels[term.category]}</TableCell>
              <TableCell><Badge variant={term.severity >= 2 ? "destructive" : "secondary"}>{term.severity}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{maskLabels[term.mask_style]}</TableCell>
              <TableCell><Switch checked={term.active} onCheckedChange={(checked) => toggleTerm(term, checked)} aria-label={`Bật từ ${term.term}`} /></TableCell>
              <TableCell className="pr-5"><div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${term.term}`} onClick={() => { setDraftError(null); setDraft({ ...term }); }}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Xóa ${term.term}`} onClick={() => removeTerm(term)}><Trash2 /></Button>
              </div></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {!terms.length && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Không có từ phù hợp.</p>}
        </TableCard>
      </TabsContent>
    </Tabs>

    <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
      <DialogContent className="sm:max-w-md">
        {rejecting && <form onSubmit={async (event) => { event.preventDefault(); if (!rejecting.reason.trim()) return toast.error("Vui lòng nhập lý do."); await decide(rejecting.item, { reject: rejecting.reason }, "Đã từ chối, tác giả sẽ thấy lý do."); setRejecting(null); }} className="space-y-4">
          <DialogHeader><DialogTitle>Từ chối chương {rejecting.item.chapter_number}</DialogTitle><DialogDescription>{rejecting.item.story_title} — tác giả sẽ thấy lý do và có thể sửa rồi gửi lại.</DialogDescription></DialogHeader>
          <Field><FieldLabel htmlFor="reject-reason">Lý do</FieldLabel><Textarea id="reject-reason" required rows={3} value={rejecting.reason} onChange={(event) => setRejecting({ ...rejecting, reason: event.target.value })} placeholder="Ví dụ: Cảnh tra tấn mô tả quá chi tiết, vui lòng viết giảm nhẹ." /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setRejecting(null)}>Hủy</Button><Button type="submit" variant="destructive" disabled={pending}>Từ chối</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!draft} onOpenChange={(open) => { if (!open) setDraft(null); }}>
      <DialogContent className="sm:max-w-md">
        {draft && <form onSubmit={saveTerm} className="space-y-4">
          <DialogHeader><DialogTitle>{draft.id ? "Sửa từ" : "Thêm từ vào từ điển"}</DialogTitle><DialogDescription>Không phân biệt hoa/thường; tự bắt cả kiểu viết tách như “c.h.ế.t”.</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor="term">Từ / cụm từ</FieldLabel><Input id="term" required maxLength={80} value={draft.term} onChange={(event) => setDraft({ ...draft, term: event.target.value })} /></Field>
            <Field><FieldLabel>Nhóm</FieldLabel><Select items={categoryItems} value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value as ModerationCategory })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categoryItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field><FieldLabel>Mức độ</FieldLabel><Select items={severityItems} value={String(draft.severity)} onValueChange={(value) => setDraft({ ...draft, severity: Number(value) })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{severityItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><FieldDescription>Mức 2–3: chương chứa từ này sẽ tắt quảng cáo và chờ duyệt.</FieldDescription></Field>
            <Field><FieldLabel>Kiểu che trên trang đọc</FieldLabel><Select items={maskItems} value={draft.mask_style} onValueChange={(value) => setDraft({ ...draft, mask_style: value as MaskStyle })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{maskItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          </FieldGroup>
          {draftError && <Alert variant="destructive"><AlertDescription>{draftError}</AlertDescription></Alert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDraft(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
