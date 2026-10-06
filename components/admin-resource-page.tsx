"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Edit3, FileUp, KeyRound, Plus, Search, ShieldOff, Trash2, X } from "lucide-react";
import { parseStoryImportCsv, storyImportTemplate } from "@/lib/story-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, StatusBadge, TableCard, MoreButton } from "@/components/admin-ui";
import { adminGenres, adminMembers, adminStories, type AdminGenre } from "@/lib/admin-data";
import type { AdminProfile } from "@/lib/auth";

type Resource = "stories" | "members" | "genres" | "admins";
type AdminDraft = { id?: string; email: string; display_name: string; role: AdminProfile["role"]; status: AdminProfile["status"] };
type PasswordDraft = { id: string; email: string; password: string; confirmation: string };
type GenreDraft = { originalSlug?: string; name: string; slug: string };
type StoryChapterDraft = { chapter_number: string; title: string; text_url: string };
type StoryDraft = { title: string; author: string; description: string; cover_url: string; audio_url: string; status: "Đang ra" | "Hoàn thành" | "Tạm dừng"; genres: string[]; chapters: StoryChapterDraft[] };

const config = {
  stories: { title: "Quản lý truyện", description: "Theo dõi, chỉnh sửa và quản lý kho truyện trên hệ thống.", add: "Thêm truyện", search: "Tìm tên truyện hoặc tác giả..." },
  members: { title: "Thành viên", description: "Quản lý tài khoản và hoạt động của thành viên.", add: "Thêm thành viên", search: "Tìm tên hoặc email..." },
  genres: { title: "Thể loại", description: "Tổ chức và phân loại truyện trong hệ thống.", add: "Thêm thể loại", search: "Tìm thể loại..." },
  admins: { title: "Quản trị viên", description: "Quản lý quyền truy cập của đội ngũ quản trị.", add: "Thêm quản trị viên", search: "Tìm quản trị viên..." },
} as const;
const roleLabels: Record<AdminProfile["role"], string> = { admin: "Quản trị viên toàn quyền", editor: "Biên tập viên", moderator: "Kiểm duyệt nội dung" };
const statusLabels: Record<AdminProfile["status"], string> = { active: "Hoạt động", suspended: "Tạm dừng" };
const genreColors = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-pink-100 text-pink-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700"];

export function AdminResourcePage({ type, initialAdmins = [] }: { type: Resource; initialAdmins?: AdminProfile[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả");
  const [message, setMessage] = useState<string | null>(null);
  const [admins, setAdmins] = useState(initialAdmins);
  const [genres, setGenres] = useState<AdminGenre[]>(adminGenres);
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft | null>(null);
  const [genreDraft, setGenreDraft] = useState<GenreDraft | null>(null);
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(null);
  const [storyPending, setStoryPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPending, setImportPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const c = config[type];
  const stories = useMemo(() => adminStories.filter((x) => `${x.title} ${x.author}`.toLowerCase().includes(query.toLowerCase()) && (status === "Tất cả" || x.status === status)), [query, status]);
  const members = useMemo(() => adminMembers.filter((x) => `${x.name} ${x.email}`.toLowerCase().includes(query.toLowerCase()) && (status === "Tất cả" || x.status === status)), [query, status]);
  const filteredGenres = useMemo(() => genres.filter((x) => `${x.name} ${x.slug}`.toLowerCase().includes(query.toLowerCase())), [genres, query]);
  const filteredAdmins = useMemo(() => admins.filter((x) => `${x.display_name ?? ""} ${x.email} ${roleLabels[x.role]}`.toLowerCase().includes(query.toLowerCase()) && (status === "Tất cả" || statusLabels[x.status] === status)), [admins, query, status]);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + storyImportTemplate()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "mau-import-truyen-nhieu-chuong.csv"; link.click(); URL.revokeObjectURL(url);
  }
  function chooseImportFile(file: File | undefined) {
    if (!file) return;
    setImportErrors([]); setMessage(null); setImportFile(file);
  }
  async function importStories() {
    if (!importFile) return;
    setImportPending(true); setImportErrors([]);
    const parsed = parseStoryImportCsv(await importFile.text());
    if (parsed.errors.length) { setImportErrors(parsed.errors); setImportPending(false); return; }
    const formData = new FormData(); formData.append("file", importFile);
    try {
      const response = await fetch("/api/admin/stories/import", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setImportErrors(body.errors ?? [body.error ?? "Không thể import file."]);
      else { setMessage(`Đã import ${body.stories} truyện và ${body.chapters} chương.`); setImportFile(null); }
    } catch { setImportErrors(["Lỗi kết nối đến server."]); }
    finally { setImportPending(false); }
  }
  function add() {
    setMessage(null);
    if (type === "stories") setStoryDraft({ title: "", author: "", description: "", cover_url: "", audio_url: "", status: "Đang ra", genres: [], chapters: [{ chapter_number: "1", title: "", text_url: "" }] });
    else if (type === "admins") setDraft({ email: "", display_name: "", role: "moderator", status: "active" });
    else if (type === "genres") setGenreDraft({ name: "", slug: "" });
  }
  function updateChapter(index: number, patch: Partial<StoryChapterDraft>) { setStoryDraft((current) => current ? { ...current, chapters: current.chapters.map((chapter, i) => i === index ? { ...chapter, ...patch } : chapter) } : current); }
  function saveStory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyDraft || !storyDraft.title.trim() || !storyDraft.author.trim()) return setMessage("Vui lòng nhập tên truyện và tác giả.");
    const numbers = storyDraft.chapters.map((chapter) => Number(chapter.chapter_number));
    if (numbers.some((number) => !Number.isInteger(number) || number < 1) || new Set(numbers).size !== numbers.length || storyDraft.chapters.some((chapter) => !chapter.title.trim() || !/^https?:\/\//i.test(chapter.text_url.trim()))) return setMessage("Mỗi chương cần số duy nhất, tên chương và Link Text (.txt) hợp lệ.");
    setStoryPending(true);
    fetch("/api/admin/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...storyDraft, chapters: storyDraft.chapters.map((chapter) => ({ ...chapter, chapter_number: Number(chapter.chapter_number) })) }) })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) setMessage(body.error || "Không thể thêm truyện."); else { setMessage("Đã thêm truyện thành công."); setStoryDraft(null); } })
      .catch(() => setMessage("Lỗi kết nối đến server."))
      .finally(() => setStoryPending(false));
  }
  function saveGenre(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!genreDraft) return; const name = genreDraft.name.trim(); const slug = genreDraft.slug.trim().toLowerCase(); if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return setMessage("Slug chỉ gồm chữ thường, số và dấu gạch ngang."); if (genres.some((item) => item.slug === slug && item.slug !== genreDraft.originalSlug)) return setMessage("Slug thể loại đã tồn tại."); const old = genres.find((item) => item.slug === genreDraft.originalSlug); setGenres((items) => genreDraft.originalSlug ? items.map((item) => item.slug === genreDraft.originalSlug ? { ...item, name, slug } : item) : [...items, { name, slug, stories: 0, views: "0", color: genreColors[items.length % genreColors.length] }]); setMessage(genreDraft.originalSlug ? "Đã cập nhật thể loại trong phiên này." : "Đã thêm thể loại trong phiên này."); setGenreDraft(null); }
  function removeGenre(slug: string) { if (window.confirm("Bạn có chắc muốn xóa thể loại này khỏi danh sách demo?")) { setGenres((items) => items.filter((item) => item.slug !== slug)); setMessage("Đã xóa thể loại trong phiên này."); } }
  function toggleAdmin(item: AdminProfile) { setAdmins((items) => items.map((x) => x.id === item.id ? { ...x, status: x.status === "active" ? "suspended" : "active" } : x)); setMessage("Đã cập nhật trạng thái trong phiên này."); }
  function removeAdmin(id: string) { if (window.confirm("Bạn có chắc muốn xóa quản trị viên này?")) { setAdmins((items) => items.filter((x) => x.id !== id)); setMessage("Đã xóa quản trị viên trong phiên này."); } }
  async function saveAdmin(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!draft) return; setMessage("Chức năng lưu quản trị viên cần API quản trị."); setDraft(null); }
  async function changePassword(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!passwordDraft) return; if (passwordDraft.password.length < 8 || passwordDraft.password !== passwordDraft.confirmation) return setMessage("Mật khẩu phải có ít nhất 8 ký tự và xác nhận trùng khớp."); setPasswordPending(true); try { const response = await fetch(`/api/admin/administrators/${passwordDraft.id}/password`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: passwordDraft.password }) }); const body = await response.json().catch(() => ({})); if (!response.ok) setMessage(body.error || "Không thể đổi mật khẩu."); else { setMessage("Đã đổi mật khẩu thành công."); setPasswordDraft(null); } } catch { setMessage("Lỗi kết nối đến server."); } finally { setPasswordPending(false); } }
  const adminActions = (item: AdminProfile) => <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label="Chỉnh sửa" onClick={() => setDraft({ id: item.id, email: item.email, display_name: item.display_name ?? "", role: item.role, status: item.status })}><Edit3 className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label="Đổi mật khẩu" onClick={() => setPasswordDraft({ id: item.id, email: item.email, password: "", confirmation: "" })}><KeyRound className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label="Đổi trạng thái" onClick={() => toggleAdmin(item)}><ShieldOff className="size-4" /></Button><Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label="Xóa" onClick={() => removeAdmin(item.id)}><Trash2 className="size-4" /></Button></div>;
  return <>
    <PageHeading title={c.title} description={c.description} action={<div className="flex flex-wrap gap-2">{type === "stories" && <><Button type="button" variant="outline" onClick={downloadTemplate}><Download className="size-4" />Tải file mẫu</Button><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="size-4" />Import hàng loạt</Button><input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => chooseImportFile(event.target.files?.[0])} /></>}<Button variant="outline"><Download className="size-4" />Xuất dữ liệu</Button><Button onClick={add}><Plus className="size-4" />{c.add}</Button></div>} />
    {message && <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    <TableCard title={type === "stories" ? "Danh sách truyện" : type === "members" ? "Danh sách thành viên" : type === "genres" ? "Danh sách thể loại" : "Danh sách quản trị viên"}>
      <div className="flex flex-wrap gap-3 border-b p-4"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} className="pl-9" /></div>{(type === "stories" || type === "members" || type === "admins") && <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><option>Tất cả</option><option>Hoạt động</option><option>{type === "members" ? "Bị khóa" : type === "stories" ? "Hoàn thành" : "Tạm dừng"}</option></select>}</div>
      {type === "stories" && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{stories.map((x) => <tr key={x.title} className="border-t"><td className="px-5 py-4 font-medium">{x.title}<p className="text-xs font-normal text-slate-400">{x.author}</p></td><td className="px-5 py-4 text-slate-500">{x.genre}</td><td className="px-5 py-4 text-slate-500">{x.chapters}</td><td className="px-5 py-4"><StatusBadge>{x.status}</StatusBadge></td><td className="px-3"><MoreButton /></td></tr>)}</tbody></table></div>}
      {type === "members" && <div className="divide-y">{members.map((x) => <div key={x.email} className="flex items-center gap-4 px-5 py-4"><div><p className="font-medium">{x.name}</p><p className="text-xs text-slate-400">{x.email}</p></div><span className="ml-auto text-sm text-slate-500">{x.joined}</span><StatusBadge>{x.status}</StatusBadge><MoreButton /></div>)}</div>}
      {type === "genres" && <div className="divide-y">{filteredGenres.map((x) => <div key={x.slug} className="flex items-center gap-4 px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${x.color}`}>{x.name}</span><span className="text-sm text-slate-500">/{x.slug}</span><span className="text-sm text-slate-500">{x.stories} truyện · {x.views} lượt xem</span><div className="ml-auto flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="Chỉnh sửa" onClick={() => setGenreDraft({ originalSlug: x.slug, name: x.name, slug: x.slug })}><Edit3 className="size-4" /></Button><Button variant="ghost" size="icon-sm" className="text-rose-600" aria-label="Xóa" onClick={() => removeGenre(x.slug)}><Trash2 className="size-4" /></Button></div></div>)}</div>}
      {type === "admins" && <div className="divide-y">{filteredAdmins.map((x) => <div key={x.id} className="flex items-center gap-4 px-5 py-4"><div><p className="font-medium">{x.display_name || x.email}</p><p className="text-xs text-slate-400">{x.email}</p></div><span className="ml-auto hidden text-sm text-slate-500 sm:block">{roleLabels[x.role]}</span><StatusBadge>{statusLabels[x.status]}</StatusBadge>{adminActions(x)}</div>)}</div>}
    </TableCard>
    {type === "stories" && importFile && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Import truyện hàng loạt</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => { setImportFile(null); setImportErrors([]); }}><X /></Button></div><p className="text-sm text-slate-600">File: <strong>{importFile.name}</strong> ({Math.ceil(importFile.size / 1024)} KB)</p>{importErrors.length > 0 && <div className="max-h-48 overflow-y-auto rounded-md bg-rose-50 p-3 text-sm text-rose-700"><p className="mb-1 font-semibold">Không thể import:</p><ul className="list-inside list-disc">{importErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<p className="text-xs text-slate-500">Mỗi dòng là một chương. Các dòng có cùng <strong>title</strong> sẽ được gộp vào cùng một truyện.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setImportFile(null)}>Hủy</Button><Button type="button" onClick={importStories} disabled={importPending}>{importPending ? "Đang import..." : "Bắt đầu import"}</Button></div></div></div>}
    {type === "stories" && storyDraft && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4"><form onSubmit={saveStory} className="mx-auto my-8 max-w-3xl space-y-5 rounded-xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-cyan-800">Thêm truyện mới</h2><p className="text-sm text-slate-500">Nhập thông tin truyện chữ và các chương.</p></div><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setStoryDraft(null)}><X /></Button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Tên truyện<Input required value={storyDraft.title} onChange={(e) => setStoryDraft({ ...storyDraft, title: e.target.value })} /></label><label className="text-sm font-medium">Tác giả<Input required value={storyDraft.author} onChange={(e) => setStoryDraft({ ...storyDraft, author: e.target.value })} /></label></div><label className="block text-sm font-medium">Mô tả<textarea value={storyDraft.description} onChange={(e) => setStoryDraft({ ...storyDraft, description: e.target.value })} className="mt-1 min-h-24 w-full rounded-md border px-3 py-2" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Link cover (tùy chọn)<Input type="url" value={storyDraft.cover_url} onChange={(e) => setStoryDraft({ ...storyDraft, cover_url: e.target.value })} /></label><label className="text-sm font-medium">Link Mê Nghe Truyện (tùy chọn)<Input type="url" value={storyDraft.audio_url} onChange={(e) => setStoryDraft({ ...storyDraft, audio_url: e.target.value })} /></label></div><label className="block text-sm font-medium">Trạng thái<select value={storyDraft.status} onChange={(e) => setStoryDraft({ ...storyDraft, status: e.target.value as StoryDraft["status"] })} className="mt-1 h-10 w-full rounded-md border px-3"><option>Đang ra</option><option>Hoàn thành</option><option>Tạm dừng</option></select></label><div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Danh sách chương</h3><Button type="button" variant="outline" size="sm" onClick={() => setStoryDraft({ ...storyDraft, chapters: [...storyDraft.chapters, { chapter_number: String(storyDraft.chapters.length + 1), title: "", text_url: "" }] })}><Plus className="size-4" />Thêm chương</Button></div><div className="space-y-3">{storyDraft.chapters.map((chapter, index) => <div key={index} className="rounded-lg border p-3"><div className="grid gap-3 sm:grid-cols-[90px_1fr_auto]"><Input required type="number" min="1" aria-label="Số chương" value={chapter.chapter_number} onChange={(e) => updateChapter(index, { chapter_number: e.target.value })} /><Input required placeholder="Tên chương" value={chapter.title} onChange={(e) => updateChapter(index, { title: e.target.value })} /><Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa chương" disabled={storyDraft.chapters.length === 1} onClick={() => setStoryDraft({ ...storyDraft, chapters: storyDraft.chapters.filter((_, i) => i !== index) })}><Trash2 className="size-4" /></Button></div><Input required type="url" placeholder="Link Text (.txt) trên Cloudflare R2" value={chapter.text_url} onChange={(e) => updateChapter(index, { text_url: e.target.value })} className="mt-3" /></div>)}</div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStoryDraft(null)}>Hủy</Button><Button type="submit" disabled={storyPending}>{storyPending ? "Đang lưu..." : "Lưu truyện"}</Button></div></form></div>}
    {type === "genres" && genreDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={saveGenre} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{genreDraft.originalSlug ? "Chỉnh sửa thể loại" : "Thêm thể loại"}</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng" onClick={() => setGenreDraft(null)}><X /></Button></div><label className="block text-sm font-medium">Tên thể loại<Input required value={genreDraft.name} onChange={(e) => setGenreDraft({ ...genreDraft, name: e.target.value })} /></label><label className="block text-sm font-medium">Slug<Input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={genreDraft.slug} onChange={(e) => setGenreDraft({ ...genreDraft, slug: e.target.value })} /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setGenreDraft(null)}>Hủy</Button><Button type="submit">Lưu thể loại</Button></div></form></div>}
    {type === "admins" && passwordDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={changePassword} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"><h2 className="text-lg font-semibold">Đổi mật khẩu</h2><p className="text-sm text-slate-500">Tài khoản: {passwordDraft.email}</p><label className="block text-sm font-medium">Mật khẩu mới<Input required minLength={8} type="password" value={passwordDraft.password} onChange={(e) => setPasswordDraft({ ...passwordDraft, password: e.target.value })} /></label><label className="block text-sm font-medium">Xác nhận mật khẩu<Input required minLength={8} type="password" value={passwordDraft.confirmation} onChange={(e) => setPasswordDraft({ ...passwordDraft, confirmation: e.target.value })} /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPasswordDraft(null)}>Hủy</Button><Button type="submit" disabled={passwordPending}>{passwordPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</Button></div></form></div>}
  </>;
}
