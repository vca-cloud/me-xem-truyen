"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Search } from "lucide-react";
import { PageHeading, TableCard } from "@/components/admin-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCoins } from "@/lib/coins";

export type AdminMember = { id: string; email: string; display_name: string; created_at: string; last_sign_in_at: string | null; balance: number; total_topup: number; total_spent: number; unlocked_chapters: number; is_admin: boolean };
type Adjustment = { member: AdminMember; mode: "add" | "subtract"; amount: string; reason: string };

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export function AdminMembersPage({ members, loadError }: { members: AdminMember[]; loadError: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Adjustment | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => members.filter((member) => `${member.display_name} ${member.email}`.toLowerCase().includes(query.toLowerCase())), [members, query]);
  const totals = useMemo(() => ({ balance: members.reduce((sum, member) => sum + member.balance, 0), payers: members.filter((member) => member.total_topup > 0).length }), [members]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const amount = Number(target.amount);
    if (!Number.isInteger(amount) || amount <= 0) return setFormError("Nhập số Xu là số nguyên dương.");
    if (!target.reason.trim()) return setFormError("Vui lòng nhập lý do (bắt buộc, được lưu vào lịch sử).");
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/admin/members/${target.member.id}/coins`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: target.mode === "add" ? amount : -amount, reason: target.reason }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setFormError(body.error ?? "Không thể cập nhật Xu.");
      toast.success(`${target.mode === "add" ? "Đã cộng" : "Đã trừ"} ${formatCoins(amount)} cho ${target.member.email}. Số dư mới: ${formatCoins(body.balance)}.`);
      setTarget(null);
      router.refresh();
    } catch {
      setFormError("Lỗi kết nối đến server.");
    } finally {
      setPending(false);
    }
  }

  return <>
    <PageHeading title="Thành viên" description={`${members.length} tài khoản · ${totals.payers} người đã nạp · tổng Xu đang lưu hành ${formatCoins(totals.balance)}`} />
    {loadError && <Alert variant="destructive" className="mb-4"><AlertTitle>Không tải được danh sách thành viên</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
    <TableCard title="Danh sách thành viên">
      <div className="border-b p-4"><div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc email..." className="pl-8" aria-label="Tìm thành viên" /></div></div>
      {filtered.length ? <Table className="min-w-[860px]">
        <TableHeader><TableRow><TableHead className="pl-5">Thành viên</TableHead><TableHead>Ngày tham gia</TableHead><TableHead className="text-right">Số dư</TableHead><TableHead className="text-right">Đã nạp</TableHead><TableHead className="text-right">Đã dùng</TableHead><TableHead className="text-right">Chương đã mở</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
        <TableBody>{filtered.map((member) => <TableRow key={member.id}>
          <TableCell className="max-w-72 pl-5"><p className="flex items-center gap-2 truncate font-medium">{member.display_name}{member.is_admin && <Badge variant="outline">Admin</Badge>}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></TableCell>
          <TableCell className="text-muted-foreground">{dateFormat.format(new Date(member.created_at))}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatCoins(member.balance)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{formatCoins(member.total_topup)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{formatCoins(member.total_spent)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{member.unlocked_chapters}</TableCell>
          <TableCell className="pr-5 text-right"><Button variant="outline" size="sm" onClick={() => { setFormError(null); setTarget({ member, mode: "add", amount: "", reason: "" }); }}><Coins />Cộng/Trừ Xu</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">{members.length ? "Không có thành viên phù hợp." : "Chưa có thành viên nào."}</p>}
    </TableCard>

    <Dialog open={!!target} onOpenChange={(open) => { if (!open) setTarget(null); }}>
      <DialogContent className="sm:max-w-md">
        {target && <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>Cộng/Trừ Xu</DialogTitle><DialogDescription>{target.member.email} · số dư {formatCoins(target.member.balance)}</DialogDescription></DialogHeader>
          <Tabs value={target.mode} onValueChange={(mode) => setTarget({ ...target, mode: mode as Adjustment["mode"] })}>
            <TabsList className="w-full"><TabsTrigger value="add">Cộng Xu</TabsTrigger><TabsTrigger value="subtract">Trừ Xu</TabsTrigger></TabsList>
          </Tabs>
          <FieldGroup>
            <Field><FieldLabel htmlFor="coin-amount">Số Xu</FieldLabel><Input id="coin-amount" required inputMode="numeric" value={target.amount} onChange={(event) => setTarget({ ...target, amount: event.target.value })} placeholder="Ví dụ: 100" /></Field>
            <Field data-invalid={!!formError}><FieldLabel htmlFor="coin-reason">Lý do (bắt buộc)</FieldLabel><Input id="coin-reason" required maxLength={200} value={target.reason} onChange={(event) => setTarget({ ...target, reason: event.target.value })} placeholder="Ví dụ: Khách chuyển khoản sai nội dung, mã GD 123456" /><FieldDescription>Mọi lần cộng/trừ đều được lưu vào lịch sử Xu kèm tài khoản admin thực hiện.</FieldDescription>{formError && <FieldError>{formError}</FieldError>}</Field>
          </FieldGroup>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setTarget(null)}>Hủy</Button><Button type="submit" variant={target.mode === "subtract" ? "destructive" : "default"} disabled={pending}>{pending ? "Đang lưu..." : target.mode === "add" ? "Cộng Xu" : "Trừ Xu"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
