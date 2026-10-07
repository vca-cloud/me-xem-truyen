"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeading, StatusBadge, TableCard } from "@/components/admin-ui";
import { useConfirm } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminProfile } from "@/lib/auth";

const roleLabels: Record<AdminProfile["role"], string> = { admin: "Toàn quyền", editor: "Biên tập viên", moderator: "Kiểm duyệt" };
const roleHelp: Record<AdminProfile["role"], string> = {
  admin: "Mọi quyền: xóa truyện, tiền Xu, affiliate, doanh thu, quản trị viên.",
  editor: "Đăng/sửa truyện và chương, import CSV, xem dashboard.",
  moderator: "Giống biên tập viên (dùng cho người kiểm duyệt nội dung).",
};
const statusLabels: Record<AdminProfile["status"], string> = { active: "Hoạt động", suspended: "Tạm dừng" };
const roleItems = (Object.keys(roleLabels) as AdminProfile["role"][]).map((value) => ({ value, label: roleLabels[value] }));
const statusItems = [{ value: "active", label: "Hoạt động" }, { value: "suspended", label: "Tạm dừng (không vào được admin)" }];

type Draft = { email: string; role: AdminProfile["role"]; status: AdminProfile["status"]; isNew: boolean };
type PasswordDraft = { id: string; email: string; value: string; confirm: string };

async function send(url: string, init: RequestInit) {
  try {
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, error: (body.error as string | undefined) ?? "Không thể lưu." };
  } catch {
    return { ok: false, error: "Lỗi kết nối đến server." };
  }
}

export function AdminAdminsPage({ admins, currentUserId, loadError }: { admins: AdminProfile[]; currentUserId: string | null; loadError: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [password, setPassword] = useState<PasswordDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(url: string, init: RequestInit, success: string) {
    setPending(true);
    setFormError(null);
    const result = await send(url, init);
    setPending(false);
    if (!result.ok) { setFormError(result.error); return false; }
    toast.success(success);
    router.refresh();
    return true;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (draft && await run("/api/admin/administrators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }, draft.isNew ? `Đã cấp quyền cho ${draft.email}.` : `Đã cập nhật ${draft.email}.`)) setDraft(null);
  }

  async function remove(admin: AdminProfile) {
    if (!await confirm({ title: `Gỡ quyền quản trị của ${admin.email}?`, description: "Tài khoản thành viên vẫn được giữ, chỉ mất quyền vào trang admin.", confirmText: "Gỡ quyền", destructive: true })) return;
    setPending(true);
    const result = await send(`/api/admin/administrators/${admin.id}`, { method: "DELETE" });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(`Đã gỡ quyền của ${admin.email}.`);
    router.refresh();
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    if (password.value.length < 8 || password.value !== password.confirm) return setFormError("Mật khẩu tối thiểu 8 ký tự và hai ô phải trùng nhau.");
    if (await run(`/api/admin/administrators/${password.id}/password`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password.value }) }, `Đã đổi mật khẩu cho ${password.email}.`)) setPassword(null);
  }

  return <>
    <PageHeading title="Quản trị viên" description="Cấp quyền quản trị cho tài khoản đã đăng ký, đổi vai trò, tạm khóa hoặc gỡ quyền." action={<Button onClick={() => { setFormError(null); setDraft({ email: "", role: "editor", status: "active", isNew: true }); }}><Plus />Thêm quản trị viên</Button>} />
    {loadError && <Alert variant="destructive" className="mb-4"><AlertTitle>Không tải được danh sách</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
    <TableCard title={`Danh sách (${admins.length})`}>
      <Table>
        <TableHeader><TableRow><TableHead className="pl-5">Tài khoản</TableHead><TableHead className="hidden sm:table-cell">Vai trò</TableHead><TableHead>Trạng thái</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
        <TableBody>{admins.map((admin) => <TableRow key={admin.id}>
          <TableCell className="max-w-72 pl-5"><p className="truncate font-medium">{admin.display_name || admin.email}{admin.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">(bạn)</span>}</p><p className="truncate text-xs text-muted-foreground">{admin.email}</p></TableCell>
          <TableCell className="hidden sm:table-cell">{roleLabels[admin.role]}</TableCell>
          <TableCell><StatusBadge>{statusLabels[admin.status]}</StatusBadge></TableCell>
          <TableCell className="pr-5"><div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Sửa vai trò" onClick={() => { setFormError(null); setDraft({ email: admin.email, role: admin.role, status: admin.status, isNew: false }); }}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Đổi mật khẩu" onClick={() => { setFormError(null); setPassword({ id: admin.id, email: admin.email, value: "", confirm: "" }); }}><KeyRound /></Button>
            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Gỡ quyền quản trị" disabled={pending} onClick={() => remove(admin)}><Trash2 /></Button>
          </div></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </TableCard>

    <Dialog open={!!draft} onOpenChange={(open) => { if (!open) setDraft(null); }}>
      <DialogContent className="sm:max-w-md">
        {draft && <form onSubmit={save} className="space-y-4">
          <DialogHeader><DialogTitle>{draft.isNew ? "Thêm quản trị viên" : "Sửa quản trị viên"}</DialogTitle>{draft.isNew && <DialogDescription>Người này phải đăng ký tài khoản thành viên trên web trước.</DialogDescription>}</DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor="admin-email">Email tài khoản</FieldLabel><Input id="admin-email" required type="email" disabled={!draft.isNew} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="nguoi-do@gmail.com" /></Field>
            <Field><FieldLabel>Vai trò</FieldLabel>
              <Select items={roleItems} value={draft.role} onValueChange={(value) => setDraft({ ...draft, role: value as AdminProfile["role"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{roleItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
              <FieldDescription>{roleHelp[draft.role]}</FieldDescription>
            </Field>
            <Field><FieldLabel>Trạng thái</FieldLabel>
              <Select items={statusItems} value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as AdminProfile["status"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statusItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
            </Field>
          </FieldGroup>
          {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDraft(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!password} onOpenChange={(open) => { if (!open) setPassword(null); }}>
      <DialogContent className="sm:max-w-md">
        {password && <form onSubmit={changePassword} className="space-y-4">
          <DialogHeader><DialogTitle>Đổi mật khẩu</DialogTitle><DialogDescription>{password.email}</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor="new-password">Mật khẩu mới</FieldLabel><Input id="new-password" required minLength={8} type="password" autoComplete="new-password" value={password.value} onChange={(event) => setPassword({ ...password, value: event.target.value })} /></Field>
            <Field data-invalid={!!formError}><FieldLabel htmlFor="confirm-password">Nhập lại</FieldLabel><Input id="confirm-password" required minLength={8} type="password" autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} /><FieldDescription>Cần cấu hình SUPABASE_SERVICE_ROLE_KEY trên máy chủ.</FieldDescription>{formError && <FieldError>{formError}</FieldError>}</Field>
          </FieldGroup>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setPassword(null)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Đổi mật khẩu"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
