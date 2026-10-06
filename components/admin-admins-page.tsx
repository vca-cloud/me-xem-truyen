"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, StatusBadge, TableCard } from "@/components/admin-ui";
import type { AdminProfile } from "@/lib/auth";

const roleLabels: Record<AdminProfile["role"], string> = { admin: "Toàn quyền", editor: "Biên tập viên", moderator: "Kiểm duyệt" };
const roleHelp: Record<AdminProfile["role"], string> = {
  admin: "Mọi quyền: xóa truyện, tiền Xu, affiliate, doanh thu, quản trị viên.",
  editor: "Đăng/sửa truyện và chương, import CSV, xem dashboard.",
  moderator: "Giống biên tập viên (dùng cho người kiểm duyệt nội dung).",
};
type Draft = { email: string; role: AdminProfile["role"]; status: AdminProfile["status"]; isNew: boolean };

export function AdminAdminsPage({ admins, currentUserId, loadError }: { admins: AdminProfile[]; currentUserId: string | null; loadError: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [password, setPassword] = useState<{ id: string; email: string; value: string; confirm: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(url: string, init: RequestInit, success: string) {
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setFormError(body.error ?? "Không thể lưu."); return false; }
      setMessage({ ok: true, text: success });
      router.refresh();
      return true;
    } catch {
      setFormError("Lỗi kết nối đến server.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (await send("/api/admin/administrators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }, draft.isNew ? `Đã cấp quyền cho ${draft.email}.` : `Đã cập nhật ${draft.email}.`)) setDraft(null);
  }

  async function remove(admin: AdminProfile) {
    if (!window.confirm(`Gỡ quyền quản trị của ${admin.email}? Tài khoản thành viên vẫn được giữ.`)) return;
    setMessage(null);
    await send(`/api/admin/administrators/${admin.id}`, { method: "DELETE" }, `Đã gỡ quyền của ${admin.email}.`);
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    if (password.value.length < 8 || password.value !== password.confirm) return setFormError("Mật khẩu tối thiểu 8 ký tự và hai ô phải trùng nhau.");
    if (await send(`/api/admin/administrators/${password.id}/password`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password.value }) }, `Đã đổi mật khẩu cho ${password.email}.`)) setPassword(null);
  }

  return <>
    <PageHeading title="Quản trị viên" description="Cấp quyền quản trị cho tài khoản đã đăng ký, đổi vai trò, tạm khóa hoặc gỡ quyền." action={<Button onClick={() => { setFormError(null); setMessage(null); setDraft({ email: "", role: "editor", status: "active", isNew: true }); }}><Plus className="size-4" />Thêm quản trị viên</Button>} />
    {loadError && <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Không tải được danh sách: {loadError}</p>}
    {message && <p role="status" className={`mb-4 rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</p>}
    {formError && !draft && !password && <p role="alert" className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
    <TableCard title={`Danh sách (${admins.length})`}>
      <div className="divide-y">{admins.map((admin) => <div key={admin.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{admin.display_name || admin.email}{admin.id === currentUserId && <span className="ml-2 text-xs font-normal text-slate-400">(bạn)</span>}</p><p className="truncate text-xs text-slate-400">{admin.email}</p></div>
        <span className="text-sm text-slate-600">{roleLabels[admin.role]}</span>
        <StatusBadge>{admin.status === "active" ? "Hoạt động" : "Tạm dừng"}</StatusBadge>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Sửa vai trò" onClick={() => { setFormError(null); setDraft({ email: admin.email, role: admin.role, status: admin.status, isNew: false }); }}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Đổi mật khẩu" onClick={() => { setFormError(null); setPassword({ id: admin.id, email: admin.email, value: "", confirm: "" }); }}><KeyRound className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label="Gỡ quyền quản trị" disabled={pending} onClick={() => remove(admin)}><Trash2 className="size-4" /></Button>
        </div>
      </div>)}</div>
    </TableCard>

    {draft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Quản trị viên"><form onSubmit={save} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between"><h2 className="text-lg font-semibold">{draft.isNew ? "Thêm quản trị viên" : "Sửa quản trị viên"}</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setDraft(null)}><X /></Button></div>
      <label className="block text-sm font-medium">Email tài khoản<Input required type="email" disabled={!draft.isNew} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="nguoi-do@gmail.com" /></label>
      {draft.isNew && <p className="text-xs text-slate-500">Người này phải đăng ký tài khoản thành viên trên web trước.</p>}
      <label className="block text-sm font-medium">Vai trò<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as AdminProfile["role"] })} className="mt-1 h-9 w-full rounded-lg border border-input px-3 text-sm">{(Object.keys(roleLabels) as AdminProfile["role"][]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">{roleHelp[draft.role]}</span></label>
      <label className="block text-sm font-medium">Trạng thái<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as AdminProfile["status"] })} className="mt-1 h-9 w-full rounded-lg border border-input px-3 text-sm"><option value="active">Hoạt động</option><option value="suspended">Tạm dừng (không vào được admin)</option></select></label>
      {formError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button></div>
    </form></div>}

    {password && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Đổi mật khẩu"><form onSubmit={changePassword} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Đổi mật khẩu</h2><p className="text-sm text-slate-500">{password.email}</p></div><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setPassword(null)}><X /></Button></div>
      <label className="block text-sm font-medium">Mật khẩu mới<Input required minLength={8} type="password" autoComplete="new-password" value={password.value} onChange={(event) => setPassword({ ...password, value: event.target.value })} /></label>
      <label className="block text-sm font-medium">Nhập lại<Input required minLength={8} type="password" autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} /></label>
      <p className="text-xs text-slate-500">Cần cấu hình SUPABASE_SERVICE_ROLE_KEY trên máy chủ. Muốn tự đổi mật khẩu của chính mình, có thể dùng chức năng quên mật khẩu.</p>
      {formError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPassword(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Đổi mật khẩu"}</Button></div>
    </form></div>}
  </>;
}
