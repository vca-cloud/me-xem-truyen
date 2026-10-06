"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Pencil, Plus, Power, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCard } from "@/components/admin-ui";
import { affiliatePlacements, formatNumber, formatVnd, placementLabel, revenueImportTemplates, type RevenueDashboard, type RevenueImportType } from "@/lib/analytics-shared";
import { cn } from "@/lib/utils";

type Link = RevenueDashboard["links"][number];
type Draft = { id?: string; name: string; target_url: string; placement: string; sub_id: string; story_slug: string };

const blank: Draft = { name: "", target_url: "", placement: "cuoi-chuong", sub_id: "", story_slug: "" };
const selectClass = "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

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

export function AffiliateManager({ links }: { links: Link[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  async function request(url: string, init: RequestInit, success: string) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setImportErrors(Array.isArray(body.errors) ? body.errors : []);
        setMessage({ tone: "error", text: body.error || (Array.isArray(body.errors) ? "File có lỗi, xem chi tiết bên dưới." : "Không thể xử lý yêu cầu.") });
        return null;
      }
      setImportErrors([]);
      setMessage({ tone: "ok", text: success });
      router.refresh();
      return body;
    } catch {
      setMessage({ tone: "error", text: "Lỗi kết nối đến server." });
      return null;
    } finally {
      setPending(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const { id, ...payload } = draft;
    const ok = await request(id ? `/api/admin/affiliate-links/${id}` : "/api/admin/affiliate-links", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, id ? "Đã cập nhật link." : "Đã tạo link.");
    if (ok) setDraft(null);
  }

  function toggle(link: Link) {
    request(`/api/admin/affiliate-links/${link.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !link.active }) }, link.active ? "Đã tắt link." : "Đã bật link.");
  }

  function remove(link: Link) {
    if (window.confirm(`Xóa link "${link.name}"? Lịch sử click của link này cũng bị xóa.`)) request(`/api/admin/affiliate-links/${link.id}`, { method: "DELETE" }, "Đã xóa link.");
  }

  async function copyTrackingUrl(link: Link) {
    const url = `${window.location.origin}/go/${link.id}${link.story_slug ? `?s=${link.story_slug}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ tone: "ok", text: `Đã sao chép: ${url}` });
    } catch {
      setMessage({ tone: "error", text: `Không sao chép được, link theo dõi: ${url}` });
    }
  }

  async function importReport(type: RevenueImportType, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.set("type", type);
    formData.set("file", file);
    const body = await request("/api/admin/revenue/import", { method: "POST", body: formData }, "Đang xử lý…");
    if (body) setMessage({ tone: "ok", text: `Đã nhập ${formatNumber(body.imported)} dòng${body.unmatched ? `, ${formatNumber(body.unmatched)} đơn không khớp Sub ID của link nào` : ""}.` });
  }

  return <div className="space-y-6">
    {message && <p role="status" className={cn("rounded-lg px-4 py-3 text-sm", message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>{message.text}</p>}
    {importErrors.length > 0 && <ul className="list-inside list-disc rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{importErrors.map((error) => <li key={error}>{error}</li>)}</ul>}

    <TableCard title="Link affiliate" action={<Button size="sm" onClick={() => { setMessage(null); setDraft({ ...blank }); }}><Plus className="size-4" />Thêm link</Button>}>
      {links.length ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Tên link</th><th className="px-5 py-3">Vị trí</th><th className="px-5 py-3">Sub ID</th><th className="px-5 py-3 text-right">Click</th><th className="px-5 py-3 text-right">Đơn</th><th className="px-5 py-3 text-right">Hoa hồng</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3"><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{links.map((link) => <tr key={link.id} className="border-t"><td className="max-w-64 px-5 py-3"><p className="truncate font-medium">{link.name}</p><p className="truncate text-xs text-slate-500">{link.target_url}</p></td><td className="px-5 py-3 text-slate-600">{placementLabel(link.placement)}</td><td className="px-5 py-3 font-mono text-xs text-slate-600">{link.sub_id ?? "—"}</td><td className="px-5 py-3 text-right tabular-nums">{formatNumber(link.clicks)}</td><td className="px-5 py-3 text-right tabular-nums">{formatNumber(link.orders)}</td><td className="px-5 py-3 text-right font-medium tabular-nums">{formatVnd(link.commission)}</td><td className="px-5 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", link.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{link.active ? "Đang bật" : "Đã tắt"}</span></td><td className="px-5 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label="Sao chép link theo dõi" onClick={() => copyTrackingUrl(link)}><Copy className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label="Chỉnh sửa" onClick={() => setDraft({ id: link.id, name: link.name, target_url: link.target_url, placement: link.placement, sub_id: link.sub_id ?? "", story_slug: link.story_slug ?? "" })}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label={link.active ? "Tắt link" : "Bật link"} disabled={pending} onClick={() => toggle(link)}><Power className="size-4" /></Button><Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label="Xóa" disabled={pending} onClick={() => remove(link)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có link nào. Tạo link Shopee, sau đó dùng link theo dõi <code>/go/…</code> khi gắn lên trang đọc.</p>}
    </TableCard>

    <TableCard title="Nhập báo cáo doanh thu">
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {(["shopee", "adsense"] as const).map((type) => <div key={type} className="rounded-lg border p-4">
          <p className="font-medium">{type === "shopee" ? "Đơn hàng Shopee Affiliate" : "Báo cáo AdSense theo ngày"}</p>
          <p className="mt-1 text-sm text-slate-500">{type === "shopee" ? "Cập nhật theo order_id. Đơn được gán cho link qua cột sub_id. status: pending, approved, cancelled." : "Cập nhật theo ngày + ad_unit. Số tiền tính bằng VND."}</p>
          <p className="mt-2 font-mono text-xs text-slate-500">{revenueImportTemplates[type].headers.join(",")}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => downloadTemplate(type)}><Download className="size-4" />Tải file mẫu</Button><label className={cn("inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground", pending && "pointer-events-none opacity-50")}><Upload className="size-4" />Chọn file CSV<input type="file" accept=".csv,text/csv" className="sr-only" disabled={pending} onChange={(event) => importReport(type, event)} /></label></div>
        </div>)}
      </div>
    </TableCard>

    {draft && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4"><form onSubmit={save} className="mx-auto my-8 max-w-xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{draft.id ? "Sửa link affiliate" : "Thêm link affiliate"}</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setDraft(null)}><X className="size-4" /></Button></div>
      <label className="grid gap-1.5 text-sm font-medium">Tên link<Input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ví dụ: Gợi ý sách cuối chương" /></label>
      <label className="grid gap-1.5 text-sm font-medium">Link Shopee (đích)<Input required type="url" value={draft.target_url} onChange={(event) => setDraft({ ...draft, target_url: event.target.value })} placeholder="https://s.shopee.vn/…" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">Vị trí đặt<select className={selectClass} value={draft.placement} onChange={(event) => setDraft({ ...draft, placement: event.target.value })}>{affiliatePlacements.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm font-medium">Sub ID<Input maxLength={50} pattern="[A-Za-z0-9_\-]*" value={draft.sub_id} onChange={(event) => setDraft({ ...draft, sub_id: event.target.value })} placeholder="cuoi-chuong-01" /></label>
      </div>
      <p className="text-xs text-slate-500">Sub ID phải trùng với Sub ID bạn đặt khi tạo link trên Shopee Affiliate để đơn hàng import được gán đúng link.</p>
      <label className="grid gap-1.5 text-sm font-medium">Chỉ dùng cho truyện (slug, tùy chọn)<Input value={draft.story_slug} onChange={(event) => setDraft({ ...draft, story_slug: event.target.value })} placeholder="thien-dao-do-thu-quan" /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button></div>
    </form></div>}
  </div>;
}
