"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, TableCard } from "@/components/admin-ui";

export type AdminGenreRow = { id: string; name: string; slug: string; stories: number };

export function AdminGenresPage({ genres, loadError }: { genres: AdminGenreRow[]; loadError: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const filtered = useMemo(() => genres.filter((genre) => `${genre.name} ${genre.slug}`.toLowerCase().includes(query.toLowerCase())), [genres, query]);

  async function send(url: string, init: RequestInit, success: string) {
    setPending(true);
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? { ok: true, text: success } : { ok: false, text: body.error ?? "Không thể lưu." });
      if (response.ok) router.refresh();
      return response.ok;
    } catch {
      setMessage({ ok: false, text: "Lỗi kết nối đến server." });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return setMessage({ ok: false, text: "Vui lòng nhập tên thể loại." });
    if (await send("/api/admin/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) }, `Đã thêm thể loại "${newName.trim()}".`)) { setNewName(""); setAdding(false); }
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (await send(`/api/admin/genres/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editing.name }) }, "Đã đổi tên thể loại.")) setEditing(null);
  }

  async function remove(genre: AdminGenreRow) {
    if (!window.confirm(`Xóa thể loại "${genre.name}"? ${genre.stories ? `${genre.stories} truyện sẽ bị bỏ thể loại này (truyện vẫn giữ nguyên).` : ""}`)) return;
    await send(`/api/admin/genres/${genre.id}`, { method: "DELETE" }, `Đã xóa thể loại "${genre.name}".`);
  }

  return <>
    <PageHeading title="Thể loại" description="Danh mục thể loại để chọn khi đăng/sửa truyện. Import CSV cũng tự thêm thể loại mới." action={<Button onClick={() => { setMessage(null); setNewName(""); setAdding(true); }}><Plus className="size-4" />Thêm thể loại</Button>} />
    {loadError && <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Không tải được thể loại: {loadError}</p>}
    {message && <p role="status" className={`mb-4 rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</p>}
    <TableCard title={`Danh sách thể loại (${genres.length})`}>
      <div className="flex flex-wrap gap-3 border-b p-4">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm thể loại..." className="pl-9" aria-label="Tìm thể loại" /></div>
      </div>
      {filtered.length ? <div className="divide-y">{filtered.map((genre) => <div key={genre.id} className="flex items-center gap-3 px-5 py-3">
        {editing?.id === genre.id
          ? <form onSubmit={rename} className="flex flex-1 gap-2"><Input autoFocus required maxLength={60} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} aria-label="Tên mới" /><Button type="submit" size="icon-sm" aria-label="Lưu" disabled={pending}><Check className="size-4" /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label="Hủy" onClick={() => setEditing(null)}><X className="size-4" /></Button></form>
          : <><span className="min-w-0 flex-1 truncate font-medium">{genre.name}</span><span className="hidden text-sm text-slate-400 sm:block">/{genre.slug}</span><span className="text-sm text-slate-500">{genre.stories} truyện</span>
            <Button variant="ghost" size="icon-sm" aria-label={`Đổi tên ${genre.name}`} onClick={() => setEditing({ id: genre.id, name: genre.name })}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label={`Xóa ${genre.name}`} disabled={pending} onClick={() => remove(genre)}><Trash2 className="size-4" /></Button></>}
      </div>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{genres.length ? "Không có thể loại phù hợp." : "Chưa có thể loại nào."}</p>}
    </TableCard>
    {adding && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Thêm thể loại"><form onSubmit={create} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between"><h2 className="text-lg font-semibold">Thêm thể loại</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setAdding(false)}><X className="size-4" /></Button></div>
      <label className="block text-sm font-medium">Tên thể loại<Input autoFocus maxLength={60} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ví dụ: Cổ Đại" aria-label="Tên thể loại mới" className="mt-1" /></label>
      {message && !message.ok && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{message.text}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdding(false)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang thêm..." : "Thêm"}</Button></div>
    </form></div>}
  </>;
}
