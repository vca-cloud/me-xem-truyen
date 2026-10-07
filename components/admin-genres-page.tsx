"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PageHeading, TableCard } from "@/components/admin-ui";
import { useConfirm } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AdminGenreRow = { id: string; name: string; slug: string; stories: number };

async function send(url: string, init: RequestInit) {
  try {
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, error: (body.error as string | undefined) ?? "Không thể lưu." };
  } catch {
    return { ok: false, error: "Lỗi kết nối đến server." };
  }
}

export function AdminGenresPage({ genres, loadError }: { genres: AdminGenreRow[]; loadError: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const filtered = useMemo(() => genres.filter((genre) => `${genre.name} ${genre.slug}`.toLowerCase().includes(query.toLowerCase())), [genres, query]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return setAddError("Vui lòng nhập tên thể loại.");
    setPending(true);
    const result = await send("/api/admin/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setPending(false);
    if (!result.ok) return setAddError(result.error);
    toast.success(`Đã thêm thể loại "${name}".`);
    setAdding(false);
    router.refresh();
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    const result = await send(`/api/admin/genres/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editing.name }) });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Đã đổi tên thể loại.");
    setEditing(null);
    router.refresh();
  }

  async function remove(genre: AdminGenreRow) {
    if (!await confirm({ title: `Xóa thể loại "${genre.name}"?`, description: genre.stories ? `${genre.stories} truyện sẽ bị bỏ thể loại này (truyện vẫn giữ nguyên).` : "Thể loại chưa gắn với truyện nào.", confirmText: "Xóa", destructive: true })) return;
    setPending(true);
    const result = await send(`/api/admin/genres/${genre.id}`, { method: "DELETE" });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(`Đã xóa thể loại "${genre.name}".`);
    router.refresh();
  }

  return <>
    <PageHeading title="Thể loại" description="Danh mục thể loại để chọn khi đăng/sửa truyện. Import CSV cũng tự thêm thể loại mới." action={<Button onClick={() => { setNewName(""); setAddError(null); setAdding(true); }}><Plus />Thêm thể loại</Button>} />
    {loadError && <Alert variant="destructive" className="mb-4"><AlertTitle>Không tải được thể loại</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
    <TableCard title={`Danh sách thể loại (${genres.length})`}>
      <div className="border-b p-4"><div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm thể loại..." className="pl-8" aria-label="Tìm thể loại" /></div></div>
      {filtered.length ? <Table>
        <TableHeader><TableRow><TableHead className="pl-5">Tên</TableHead><TableHead className="hidden sm:table-cell">Đường dẫn</TableHead><TableHead className="text-right">Số truyện</TableHead><TableHead className="pr-5"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
        <TableBody>{filtered.map((genre) => <TableRow key={genre.id}>
          <TableCell className="pl-5">{editing?.id === genre.id
            ? <form onSubmit={rename} className="flex max-w-sm gap-2"><Input autoFocus required maxLength={60} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} aria-label="Tên mới" /><Button type="submit" size="icon-sm" aria-label="Lưu" disabled={pending}><Check /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label="Hủy" onClick={() => setEditing(null)}><X /></Button></form>
            : <span className="font-medium">{genre.name}</span>}</TableCell>
          <TableCell className="hidden text-muted-foreground sm:table-cell">/{genre.slug}</TableCell>
          <TableCell className="text-right"><Badge variant="secondary">{genre.stories}</Badge></TableCell>
          <TableCell className="pr-5"><div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Đổi tên ${genre.name}`} onClick={() => setEditing({ id: genre.id, name: genre.name })}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Xóa ${genre.name}`} disabled={pending} onClick={() => remove(genre)}><Trash2 /></Button>
          </div></TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">{genres.length ? "Không có thể loại phù hợp." : "Chưa có thể loại nào."}</p>}
    </TableCard>

    <Dialog open={adding} onOpenChange={setAdding}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={create} className="space-y-4">
          <DialogHeader><DialogTitle>Thêm thể loại</DialogTitle><DialogDescription>Thể loại mới xuất hiện ngay trong ô chọn thể loại khi đăng/sửa truyện.</DialogDescription></DialogHeader>
          <Field data-invalid={!!addError}>
            <FieldLabel htmlFor="new-genre">Tên thể loại</FieldLabel>
            <Input id="new-genre" autoFocus maxLength={60} value={newName} aria-invalid={!!addError} onChange={(event) => { setNewName(event.target.value); setAddError(null); }} placeholder="Ví dụ: Cổ Đại" />
            {addError && <FieldError>{addError}</FieldError>}
          </Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setAdding(false)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang thêm..." : "Thêm"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
