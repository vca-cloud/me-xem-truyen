"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Pencil, Plus, Power, Trash2, Upload } from "lucide-react";
import { StatusBadge, TableCard } from "@/components/admin-ui";
import { useConfirm } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { affiliatePlacements, formatNumber, formatVnd, placementLabel, revenueImportTemplates, type RevenueDashboard, type RevenueImportType } from "@/lib/analytics-shared";

type AffiliateLink = RevenueDashboard["links"][number] & { image_url?: string | null; headline?: string | null };
type Draft = { id?: string; name: string; target_url: string; placement: string; sub_id: string; story_slug: string; image_url: string; headline: string };

const blank: Draft = { name: "", target_url: "", placement: "cuoi-chuong", sub_id: "", story_slug: "", image_url: "", headline: "" };
const placementItems = affiliatePlacements.map((item) => ({ value: item.value, label: item.label }));

function downloadTemplate(type: RevenueImportType) {
  const template = revenueImportTemplates[type];
  const csv = "﻿" + [template.headers.join(","), template.sample.join(",")].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = template.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AffiliateManager({ links }: { links: AffiliateLink[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  async function request(url: string, init: RequestInit): Promise<{ ok: boolean; body: Record<string, unknown> }> {
    setPending(true);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      if (response.ok) router.refresh();
      return { ok: response.ok, body };
    } catch {
      return { ok: false, body: { error: "Lỗi kết nối đến server." } };
    } finally {
      setPending(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const { id, ...payload } = draft;
    const { ok, body } = await request(id ? `/api/admin/affiliate-links/${id}` : "/api/admin/affiliate-links", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!ok) return setFormError(String(body.error ?? "Không thể lưu link."));
    toast.success(id ? "Đã cập nhật link." : "Đã tạo link.");
    setDraft(null);
  }

  async function toggle(link: AffiliateLink) {
    const { ok, body } = await request(`/api/admin/affiliate-links/${link.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !link.active }) });
    if (ok) toast.success(link.active ? "Đã tắt link." : "Đã bật link.");
    else toast.error(String(body.error ?? "Không thể cập nhật."));
  }

  async function remove(link: AffiliateLink) {
    if (!await confirm({ title: `Xóa link "${link.name}"?`, description: "Lịch sử click của link này cũng bị xóa.", confirmText: "Xóa link", destructive: true })) return;
    const { ok, body } = await request(`/api/admin/affiliate-links/${link.id}`, { method: "DELETE" });
    if (ok) toast.success("Đã xóa link.");
    else toast.error(String(body.error ?? "Không thể xóa."));
  }

  async function copyTrackingUrl(link: AffiliateLink) {
    const url = `${window.location.origin}/go/${link.id}${link.story_slug ? `?s=${link.story_slug}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép link theo dõi.", { description: url });
    } catch {
      toast.error("Không sao chép được.", { description: url });
    }
  }

  async function importReport(type: RevenueImportType, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.set("type", type);
    formData.set("file", file);
    const { ok, body } = await request("/api/admin/revenue/import", { method: "POST", body: formData });
    setImportErrors(!ok && Array.isArray(body.errors) ? (body.errors as string[]) : []);
    if (!ok) return toast.error(String(body.error ?? "File có lỗi, xem chi tiết bên dưới."));
    toast.success(`Đã nhập ${formatNumber(Number(body.imported))} dòng${body.unmatched ? `, ${formatNumber(Number(body.unmatched))} đơn không khớp Sub ID của link nào` : ""}.`);
  }

  return <div className="space-y-6">
    {importErrors.length > 0 && <Alert variant="destructive"><AlertTitle>File báo cáo có lỗi</AlertTitle><AlertDescription><ul className="list-inside list-disc">{importErrors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}

    <TableCard title="Link affiliate" action={<Button size="sm" onClick={() => { setFormError(null); setDraft({ ...blank }); }}><Plus />Thêm link</Button>}>
      {links.length ? <Table className="min-w-[860px]">
        <TableHeader><TableRow><TableHead className="pl-5">Tên link</TableHead><TableHead>Vị trí</TableHead><TableHead>Sub ID</TableHead><TableHead className="text-right">Click</TableHead><TableHead className="text-right">Đơn</TableHead><TableHead className="text-right">Hoa hồng</TableHead><TableHead>Trạng thái</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
        <TableBody>{links.map((link) => <TableRow key={link.id}>
          <TableCell className="max-w-64 pl-5"><p className="truncate font-medium">{link.name}</p><p className="truncate text-xs text-muted-foreground">{link.target_url}</p></TableCell>
          <TableCell className="text-muted-foreground">{placementLabel(link.placement)}</TableCell>
          <TableCell className="font-mono text-xs text-muted-foreground">{link.sub_id ?? "—"}</TableCell>
          <TableCell className="text-right tabular-nums">{formatNumber(link.clicks)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatNumber(link.orders)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatVnd(link.commission)}</TableCell>
          <TableCell><StatusBadge>{link.active ? "Đang bật" : "Đã tắt"}</StatusBadge></TableCell>
          <TableCell className="pr-5"><div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Sao chép link theo dõi" onClick={() => copyTrackingUrl(link)}><Copy /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Chỉnh sửa" onClick={() => { setFormError(null); setDraft({ id: link.id, name: link.name, target_url: link.target_url, placement: link.placement, sub_id: link.sub_id ?? "", story_slug: link.story_slug ?? "", image_url: link.image_url ?? "", headline: link.headline ?? "" }); }}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={link.active ? "Tắt link" : "Bật link"} disabled={pending} onClick={() => toggle(link)}><Power /></Button>
            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Xóa" disabled={pending} onClick={() => remove(link)}><Trash2 /></Button>
          </div></TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chưa có link nào. Tạo link Shopee, sau đó dùng link theo dõi <code>/go/…</code> khi gắn lên trang đọc.</p>}
    </TableCard>

    <div className="grid gap-4 md:grid-cols-2">
      {(["shopee", "adsense"] as const).map((type) => <Card key={type}>
        <CardHeader><CardTitle>{type === "shopee" ? "Đơn hàng Shopee Affiliate" : "Báo cáo AdSense theo ngày"}</CardTitle><CardDescription>{type === "shopee" ? "Cập nhật theo order_id. Đơn được gán cho link qua cột sub_id. status: pending, approved, cancelled." : "Cập nhật theo ngày + ad_unit. Số tiền tính bằng VND."}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">{revenueImportTemplates[type].headers.join(",")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(type)}><Download />Tải file mẫu</Button>
            <Button size="sm" disabled={pending} nativeButton={false} render={<label />}><Upload />Chọn file CSV<input type="file" accept=".csv,text/csv" className="sr-only" disabled={pending} onChange={(event) => importReport(type, event)} /></Button>
          </div>
        </CardContent>
      </Card>)}
    </div>

    <Dialog open={!!draft} onOpenChange={(open) => { if (!open) setDraft(null); }}>
      <DialogContent className="sm:max-w-xl">
        {draft && <form onSubmit={save} className="space-y-4">
          <DialogHeader><DialogTitle>{draft.id ? "Sửa link affiliate" : "Thêm link affiliate"}</DialogTitle></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor="aff-name">Tên link</FieldLabel><Input id="aff-name" required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ví dụ: Gợi ý sách cuối chương" /></Field>
            <Field><FieldLabel htmlFor="aff-url">Link Shopee (đích)</FieldLabel><Input id="aff-url" required type="url" value={draft.target_url} onChange={(event) => setDraft({ ...draft, target_url: event.target.value })} placeholder="https://s.shopee.vn/…" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel>Vị trí đặt</FieldLabel>
                <Select items={placementItems} value={draft.placement} onValueChange={(value) => setDraft({ ...draft, placement: String(value) })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{placementItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field><FieldLabel htmlFor="aff-sub">Sub ID</FieldLabel><Input id="aff-sub" maxLength={50} pattern="[A-Za-z0-9_\-]*" value={draft.sub_id} onChange={(event) => setDraft({ ...draft, sub_id: event.target.value })} placeholder="cuoi-chuong-01" /></Field>
            </div>
            <FieldDescription>Sub ID phải trùng với Sub ID bạn đặt khi tạo link trên Shopee Affiliate để đơn hàng import được gán đúng link.</FieldDescription>
            <Field><FieldLabel htmlFor="aff-story">Chỉ dùng cho truyện (slug, tùy chọn)</FieldLabel><Input id="aff-story" value={draft.story_slug} onChange={(event) => setDraft({ ...draft, story_slug: event.target.value })} placeholder="thien-dao-do-thu-quan" /></Field>
            {draft.placement === "popup" && <div className="space-y-4 rounded-lg border border-highlight/40 bg-highlight/5 p-3">
              <p className="text-sm font-medium">Hiển thị trong pop-up mở chương</p>
              <Field><FieldLabel htmlFor="aff-image">Link ảnh sản phẩm (tùy chọn)</FieldLabel><Input id="aff-image" type="url" value={draft.image_url} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} placeholder="https://…jpg" /><FieldDescription>Trên Shopee: bấm giữ ảnh sản phẩm → Sao chép địa chỉ hình ảnh, rồi dán vào đây.</FieldDescription></Field>
              <Field><FieldLabel htmlFor="aff-headline">Câu giới thiệu (tùy chọn)</FieldLabel><Input id="aff-headline" maxLength={160} value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} placeholder="Ví dụ: Deal sách hay giảm đến 50% hôm nay" /></Field>
            </div>}
          </FieldGroup>
          {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDraft(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}
