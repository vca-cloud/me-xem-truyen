"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, TableCard } from "@/components/admin-ui";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";

export type AdminMember = { id: string; email: string; display_name: string; created_at: string; last_sign_in_at: string | null; balance: number; total_topup: number; total_spent: number; unlocked_chapters: number; is_admin: boolean };

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export function AdminMembersPage({ members, loadError }: { members: AdminMember[]; loadError: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ member: AdminMember; mode: "add" | "subtract"; amount: string; reason: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(`${target.mode === "add" ? "Đã cộng" : "Đã trừ"} ${formatCoins(amount)} cho ${target.member.email}. Số dư mới: ${formatCoins(body.balance)}.`);
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
    {loadError && <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Không tải được danh sách thành viên: {loadError}</p>}
    {message && <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    <TableCard title="Danh sách thành viên">
      <div className="border-b p-4"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc email..." className="pl-9" aria-label="Tìm thành viên" /></div></div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Thành viên</th><th className="px-5 py-3">Ngày tham gia</th><th className="px-5 py-3 text-right">Số dư</th><th className="px-5 py-3 text-right">Đã nạp</th><th className="px-5 py-3 text-right">Đã dùng</th><th className="px-5 py-3 text-right">Chương đã mở</th><th className="px-5 py-3"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>{filtered.map((member) => <tr key={member.id} className="border-t">
          <td className="max-w-72 px-5 py-3"><p className="truncate font-medium">{member.display_name}{member.is_admin && <span className="ml-2 rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-700">Admin</span>}</p><p className="truncate text-xs text-slate-400">{member.email}</p></td>
          <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dateFormat.format(new Date(member.created_at))}</td>
          <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCoins(member.balance)}</td>
          <td className="px-5 py-3 text-right tabular-nums text-slate-500">{formatCoins(member.total_topup)}</td>
          <td className="px-5 py-3 text-right tabular-nums text-slate-500">{formatCoins(member.total_spent)}</td>
          <td className="px-5 py-3 text-right tabular-nums text-slate-500">{member.unlocked_chapters}</td>
          <td className="px-5 py-3"><div className="flex justify-end gap-1">
            <Button variant="outline" size="sm" onClick={() => { setFormError(null); setMessage(null); setTarget({ member, mode: "add", amount: "", reason: "" }); }}><Coins className="size-4" />Cộng/Trừ Xu</Button>
          </div></td>
        </tr>)}</tbody>
      </table></div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{members.length ? "Không có thành viên phù hợp." : "Chưa có thành viên nào."}</p>}
    </TableCard>

    {target && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Cộng hoặc trừ Xu">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Cộng/Trừ Xu</h2><p className="text-sm text-slate-500">{target.member.email} · số dư {formatCoins(target.member.balance)}</p></div><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setTarget(null)}><X /></Button></div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">{(["add", "subtract"] as const).map((mode) => <button key={mode} type="button" onClick={() => setTarget({ ...target, mode })} className={cn("rounded-md py-1.5 text-sm font-medium", target.mode === mode ? "bg-white shadow-sm" : "text-slate-500")}>{mode === "add" ? "Cộng Xu" : "Trừ Xu"}</button>)}</div>
        <label className="block text-sm font-medium">Số Xu<Input required inputMode="numeric" value={target.amount} onChange={(event) => setTarget({ ...target, amount: event.target.value })} placeholder="Ví dụ: 100" /></label>
        <label className="block text-sm font-medium">Lý do (bắt buộc)<Input required maxLength={200} value={target.reason} onChange={(event) => setTarget({ ...target, reason: event.target.value })} placeholder="Ví dụ: Khách chuyển khoản sai nội dung, mã GD 123456" /></label>
        <p className="text-xs text-slate-500">Mọi lần cộng/trừ đều được lưu vào lịch sử Xu của thành viên kèm tài khoản admin thực hiện.</p>
        {formError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setTarget(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : target.mode === "add" ? "Cộng Xu" : "Trừ Xu"}</Button></div>
      </form>
    </div>}
  </>;
}
