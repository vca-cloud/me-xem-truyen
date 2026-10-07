"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";
import { PageHeading, StatusBadge, TableCard } from "@/components/admin-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { authorStatusLabels, PAYOUT_DAY, TRUST_THRESHOLD } from "@/lib/author-rules";
import { formatCoins } from "@/lib/coins";

export type AdminAuthor = { user_id: string; email: string; pen_name: string; bio: string; contact: string; status: string; revenue_share: number; trusted_override: boolean | null; review_note: string | null; created_at: string; stories: number; published_chapters: number; pending_chapters: number; earned: number; withdrawn: number; has_payout_info: boolean };
export type AdminPayout = { id: string; author_id: string; pen_name: string; period: string; coins: number; amount_vnd: number; status: string; payout_bank: string; payout_account: string; payout_holder: string; note: string | null; requested_at: string };

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });
const trustItems = [{ value: "auto", label: `Tự động (đủ ${TRUST_THRESHOLD} chương đã đăng)` }, { value: "true", label: "Luôn tin cậy" }, { value: "false", label: "Luôn duyệt tay" }];
const payoutLabels: Record<string, string> = { requested: "Chờ chi", paid: "Đã chi", rejected: "Từ chối" };

async function patch(url: string, body: unknown) {
  try {
    const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, error: (result.error as string | undefined) ?? "Không thể lưu." };
  } catch {
    return { ok: false, error: "Lỗi kết nối đến server." };
  }
}

export function AdminAuthorsPage({ authors, payouts, loadError }: { authors: AdminAuthor[]; payouts: AdminPayout[]; loadError: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{ author: AdminAuthor; share: string; trust: string } | null>(null);
  const [reason, setReason] = useState<{ title: string; url: string; body: (note: string) => unknown; done: string; text: string } | null>(null);

  async function run(url: string, body: unknown, done: string) {
    setPending(true);
    const result = await patch(url, body);
    setPending(false);
    if (!result.ok) { toast.error(result.error); return false; }
    toast.success(done);
    router.refresh();
    return true;
  }

  const applications = authors.filter((author) => author.status === "pending");
  const others = authors.filter((author) => author.status !== "pending");
  const requested = payouts.filter((payout) => payout.status === "requested");
  const requestedTotal = requested.reduce((sum, payout) => sum + payout.amount_vnd, 0);

  return <>
    <PageHeading title="Tác giả" description={`Duyệt đơn làm tác giả, chỉnh tỷ lệ chia Xu và chi tiền cho tác giả vào ngày ${PAYOUT_DAY} hằng tháng.`} />
    {loadError && <Alert variant="destructive" className="mb-4"><AlertTitle>Không tải được dữ liệu tác giả</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
    <Tabs defaultValue={applications.length ? "applications" : "authors"}>
      <TabsList className="mb-4"><TabsTrigger value="applications">Đơn đăng ký ({applications.length})</TabsTrigger><TabsTrigger value="authors">Tác giả ({others.length})</TabsTrigger><TabsTrigger value="payouts">Rút tiền ({requested.length})</TabsTrigger></TabsList>

      <TabsContent value="applications"><TableCard title="Đơn chờ duyệt">
        {applications.length ? <div className="divide-y">{applications.map((author) => <div key={author.user_id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0 space-y-1"><p className="font-medium">{author.pen_name} <span className="text-sm font-normal text-muted-foreground">· {author.email}</span></p>{author.bio && <p className="text-sm text-muted-foreground">{author.bio}</p>}{author.contact && <p className="text-sm">Liên hệ: {author.contact}</p>}<p className="text-xs text-muted-foreground">Gửi ngày {dateFormat.format(new Date(author.created_at))}</p></div>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(`/api/admin/authors/${author.user_id}`, { status: "approved" }, `Đã duyệt ${author.pen_name}.`)}><Check />Duyệt</Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => setReason({ title: `Từ chối ${author.pen_name}`, url: `/api/admin/authors/${author.user_id}`, body: (note) => ({ status: "rejected", review_note: note }), done: "Đã từ chối đơn.", text: "" })}><X />Từ chối…</Button>
          </div>
        </div>)}</div> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">Không có đơn nào chờ duyệt.</p>}
      </TableCard></TabsContent>

      <TabsContent value="authors"><TableCard title="Danh sách tác giả">
        {others.length ? <Table className="min-w-[900px]">
          <TableHeader><TableRow><TableHead className="pl-5">Tác giả</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Chia</TableHead><TableHead className="text-right">Truyện</TableHead><TableHead className="text-right">Chương đã đăng</TableHead><TableHead className="text-right">Chờ duyệt</TableHead><TableHead className="text-right">Đã kiếm</TableHead><TableHead className="text-right">Đã rút</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
          <TableBody>{others.map((author) => {
            const trusted = author.trusted_override ?? author.published_chapters >= TRUST_THRESHOLD;
            return <TableRow key={author.user_id}>
              <TableCell className="max-w-64 pl-5"><p className="truncate font-medium">{author.pen_name}</p><p className="truncate text-xs text-muted-foreground">{author.email}</p></TableCell>
              <TableCell><div className="flex flex-wrap gap-1"><StatusBadge>{authorStatusLabels[author.status] === "Đã duyệt" ? "Hoạt động" : authorStatusLabels[author.status] === "Tạm khóa" ? "Bị khóa" : authorStatusLabels[author.status]}</StatusBadge>{author.status === "approved" && <Badge variant={trusted ? "default" : "outline"}>{trusted ? "Tin cậy" : "Mới"}</Badge>}</div></TableCell>
              <TableCell className="text-right tabular-nums">{author.revenue_share}%</TableCell>
              <TableCell className="text-right tabular-nums">{author.stories}</TableCell>
              <TableCell className="text-right tabular-nums">{author.published_chapters}</TableCell>
              <TableCell className="text-right tabular-nums">{author.pending_chapters}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCoins(Number(author.earned))}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatCoins(Number(author.withdrawn))}</TableCell>
              <TableCell className="pr-5"><div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${author.pen_name}`} onClick={() => setEditing({ author, share: String(author.revenue_share), trust: author.trusted_override === null ? "auto" : String(author.trusted_override) })}><Pencil /></Button>
                {author.status === "approved"
                  ? <Button variant="outline" size="sm" disabled={pending} onClick={() => setReason({ title: `Khóa ${author.pen_name}`, url: `/api/admin/authors/${author.user_id}`, body: (note) => ({ status: "suspended", review_note: note }), done: "Đã khóa tác giả.", text: "" })}>Khóa…</Button>
                  : <Button variant="outline" size="sm" disabled={pending} onClick={() => run(`/api/admin/authors/${author.user_id}`, { status: "approved" }, `Đã mở/duyệt ${author.pen_name}.`)}>Duyệt lại</Button>}
              </div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chưa có tác giả nào.</p>}
      </TableCard></TabsContent>

      <TabsContent value="payouts"><TableCard title={`Yêu cầu rút tiền — chờ chi ${vnd.format(requestedTotal)}`}>
        {payouts.length ? <Table className="min-w-[900px]">
          <TableHeader><TableRow><TableHead className="pl-5">Tác giả</TableHead><TableHead>Kỳ chi</TableHead><TableHead className="text-right">Xu</TableHead><TableHead className="text-right">Số tiền</TableHead><TableHead>Ngân hàng</TableHead><TableHead>Trạng thái</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
          <TableBody>{payouts.map((payout) => <TableRow key={payout.id}>
            <TableCell className="pl-5 font-medium">{payout.pen_name}</TableCell>
            <TableCell>{PAYOUT_DAY}/{payout.period.slice(5)}/{payout.period.slice(0, 4)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCoins(Number(payout.coins))}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{vnd.format(payout.amount_vnd)}</TableCell>
            <TableCell className="max-w-64 text-sm"><p className="truncate">{payout.payout_bank} · {payout.payout_account}</p><p className="truncate text-xs text-muted-foreground">{payout.payout_holder}</p></TableCell>
            <TableCell><Badge variant={payout.status === "paid" ? "default" : payout.status === "rejected" ? "destructive" : "secondary"}>{payoutLabels[payout.status]}</Badge>{payout.note && <p className="mt-1 text-xs text-muted-foreground">{payout.note}</p>}</TableCell>
            <TableCell className="pr-5">{payout.status === "requested" && <div className="flex justify-end gap-1">
              <Button size="sm" disabled={pending} onClick={() => run(`/api/admin/payouts/${payout.id}`, { status: "paid" }, `Đã đánh dấu chi ${vnd.format(payout.amount_vnd)} cho ${payout.pen_name}.`)}><Check />Đã chuyển</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setReason({ title: `Từ chối yêu cầu của ${payout.pen_name}`, url: `/api/admin/payouts/${payout.id}`, body: (note) => ({ status: "rejected", note }), done: "Đã từ chối, Xu được trả lại cho tác giả.", text: "" })}>Từ chối…</Button>
            </div>}</TableCell>
          </TableRow>)}</TableBody>
        </Table> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chưa có yêu cầu rút tiền.</p>}
      </TableCard></TabsContent>
    </Tabs>

    <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
      <DialogContent className="sm:max-w-md">
        {editing && <form onSubmit={async (event) => { event.preventDefault(); if (await run(`/api/admin/authors/${editing.author.user_id}`, { revenue_share: Number(editing.share), trusted_override: editing.trust === "auto" ? null : editing.trust === "true" }, "Đã cập nhật tác giả.")) setEditing(null); }} className="space-y-4">
          <DialogHeader><DialogTitle>{editing.author.pen_name}</DialogTitle><DialogDescription>Tỷ lệ chia áp dụng cho các lượt mở khóa từ bây giờ, không tính lại lượt cũ.</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor="share">Tỷ lệ tác giả nhận (%)</FieldLabel><Input id="share" inputMode="numeric" value={editing.share} onChange={(event) => setEditing({ ...editing, share: event.target.value })} /><FieldDescription>Mặc định 70%. Tác giả nổi tiếng có thể cao hơn.</FieldDescription></Field>
            <Field><FieldLabel>Mức tin cậy</FieldLabel><Select items={trustItems} value={editing.trust} onValueChange={(value) => setEditing({ ...editing, trust: String(value) })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{trustItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><FieldDescription>Tác giả tin cậy: chương sạch được đăng ngay; chương có cờ vẫn chờ duyệt.</FieldDescription></Field>
          </FieldGroup>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" disabled={pending}>Lưu</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!reason} onOpenChange={(open) => { if (!open) setReason(null); }}>
      <DialogContent className="sm:max-w-md">
        {reason && <form onSubmit={async (event) => { event.preventDefault(); if (!reason.text.trim()) return toast.error("Vui lòng nhập lý do."); if (await run(reason.url, reason.body(reason.text), reason.done)) setReason(null); }} className="space-y-4">
          <DialogHeader><DialogTitle>{reason.title}</DialogTitle><DialogDescription>Tác giả sẽ thấy lý do này.</DialogDescription></DialogHeader>
          <Field><FieldLabel htmlFor="reason">Lý do</FieldLabel><Textarea id="reason" required rows={3} value={reason.text} onChange={(event) => setReason({ ...reason, text: event.target.value })} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setReason(null)}>Hủy</Button><Button type="submit" variant="destructive" disabled={pending}>Xác nhận</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
