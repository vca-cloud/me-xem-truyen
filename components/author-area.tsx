"use client";

import { COVER_HINT } from "@/lib/cover";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus, Coins, ExternalLink, PenLine, Wallet } from "lucide-react";
import { GenreCombobox } from "@/components/genre-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MIN_FREE_CHAPTERS, MIN_PAYOUT_COINS, MAX_LOCK_PRICE, PAYOUT_DAY, TRUST_THRESHOLD } from "@/lib/author-rules";
import { COIN_VND, formatCoins } from "@/lib/coins";
import type { StoryStatus } from "@/lib/story-data";

async function send(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { ok: response.ok, body: await response.json().catch(() => ({})) as Record<string, unknown> };
  } catch {
    return { ok: false, body: { error: "Lỗi kết nối đến server." } as Record<string, unknown> };
  }
}

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

// ---------- Application ----------

export function AuthorApplyForm({ rejectedNote }: { rejectedNote?: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({ pen_name: "", bio: "", contact: "", agree: false });
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.agree) return toast.error("Bạn cần đồng ý Điều khoản tác giả.");
    setPending(true);
    const { ok, body } = await send("/api/author/apply", "POST", form);
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không gửi được đơn."));
    toast.success("Đã gửi đơn, admin sẽ duyệt sớm.");
    router.refresh();
  }
  return <Card>
    <CardHeader><CardTitle>Đăng ký làm tác giả</CardTitle><CardDescription>Sau khi được duyệt, bạn có thể đăng truyện, tự khóa chương bằng Xu (từ chương {MIN_FREE_CHAPTERS + 1}) và nhận 70% Xu người đọc trả.</CardDescription></CardHeader>
    <CardContent>
      {rejectedNote && <Alert variant="destructive" className="mb-4"><AlertTitle>Đơn trước bị từ chối</AlertTitle><AlertDescription>{rejectedNote}</AlertDescription></Alert>}
      <form onSubmit={submit}><FieldGroup>
        <Field><FieldLabel htmlFor="pen-name">Bút danh</FieldLabel><Input id="pen-name" required minLength={2} maxLength={60} value={form.pen_name} onChange={(event) => setForm({ ...form, pen_name: event.target.value })} /><FieldDescription>Tên hiển thị trên truyện của bạn.</FieldDescription></Field>
        <Field><FieldLabel htmlFor="bio">Giới thiệu</FieldLabel><Textarea id="bio" rows={3} maxLength={1000} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Bạn viết thể loại gì, đã đăng ở đâu…" /></Field>
        <Field><FieldLabel htmlFor="contact">Liên hệ (Facebook/Zalo/email)</FieldLabel><Input id="contact" maxLength={200} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></Field>
        <Field orientation="horizontal"><Checkbox id="agree" checked={form.agree} onCheckedChange={(checked) => setForm({ ...form, agree: checked === true })} /><FieldLabel htmlFor="agree" className="font-normal">Tôi cam kết truyện do tôi sáng tác hoặc có quyền đăng, và đồng ý <Link href="/dieu-khoan-tac-gia" target="_blank" className="text-primary underline">Điều khoản tác giả</Link>.</FieldLabel></Field>
        <Button type="submit" disabled={pending}>{pending ? "Đang gửi..." : "Gửi đơn đăng ký"}</Button>
      </FieldGroup></form>
    </CardContent>
  </Card>;
}

// ---------- Story form (create / edit) ----------

export type AuthorStory = { id: string; slug: string; title: string; description: string; cover_url: string | null; status: StoryStatus; genres: string[]; lock_from_chapter: number | null; lock_price_coins: number; published: number; submitted: number; drafts: number; rejected: number };

const statuses: StoryStatus[] = ["Đang ra", "Hoàn thành", "Tạm dừng"];

export function AuthorStoryDialog({ open, onOpenChange, story, catalog }: { open: boolean; onOpenChange: (open: boolean) => void; story?: AuthorStory; catalog: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({ title: story?.title ?? "", description: story?.description ?? "", cover_url: story?.cover_url ?? "", status: story?.status ?? "Đang ra" as StoryStatus, genres: story?.genres ?? [], lock_from_chapter: story?.lock_from_chapter ? String(story.lock_from_chapter) : "", lock_price_coins: String(story?.lock_price_coins ?? 3) }));
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { ok, body } = await send(story ? `/api/author/stories/${story.id}` : "/api/author/stories", story ? "PATCH" : "POST", form);
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không lưu được truyện."));
    toast.success(story ? "Đã cập nhật truyện." : "Đã tạo truyện. Hãy viết chương đầu tiên.");
    onOpenChange(false);
    if (!story && body.story) router.push(`/tac-gia/truyen/${(body.story as { id: string }).id}`);
    else router.refresh();
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader><DialogTitle>{story ? "Sửa thông tin truyện" : "Tạo truyện mới"}</DialogTitle><DialogDescription>Truyện chỉ hiện với người đọc khi có ít nhất một chương được đăng.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel htmlFor="s-title">Tên truyện</FieldLabel><Input id="s-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field><FieldLabel htmlFor="s-genres">Thể loại (tối đa 5)</FieldLabel><GenreCombobox id="s-genres" catalog={catalog} value={form.genres} onChange={(genres) => setForm((current) => ({ ...current, genres }))} allowCreate={false} max={5} /></Field>
          <Field><FieldLabel htmlFor="s-desc">Giới thiệu truyện</FieldLabel><Textarea id="s-desc" rows={4} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="s-cover">Link ảnh bìa (tùy chọn)</FieldLabel><Input id="s-cover" type="url" value={form.cover_url} onChange={(event) => setForm({ ...form, cover_url: event.target.value })} placeholder="https://..." /><FieldDescription>{COVER_HINT}</FieldDescription></Field>
            <Field><FieldLabel>Trạng thái</FieldLabel><Select items={statuses.map((value) => ({ value, label: value }))} value={form.status} onValueChange={(value) => setForm({ ...form, status: value as StoryStatus })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <div className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4 sm:grid-cols-2 dark:border-amber-900 dark:bg-amber-950/20">
            <Field><FieldLabel htmlFor="s-lock">Khóa từ chương số</FieldLabel><Input id="s-lock" inputMode="numeric" value={form.lock_from_chapter} onChange={(event) => setForm({ ...form, lock_from_chapter: event.target.value })} placeholder="Để trống = miễn phí" /><FieldDescription>Tối thiểu từ chương {MIN_FREE_CHAPTERS + 1} ({MIN_FREE_CHAPTERS} chương đầu luôn miễn phí).</FieldDescription></Field>
            <Field><FieldLabel htmlFor="s-price">Giá mỗi chương (Xu)</FieldLabel><Input id="s-price" inputMode="numeric" value={form.lock_price_coins} onChange={(event) => setForm({ ...form, lock_price_coins: event.target.value })} /><FieldDescription>1–{MAX_LOCK_PRICE} Xu. 1 Xu = {vnd.format(COIN_VND)}.</FieldDescription></Field>
          </div>
        </FieldGroup>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : story ? "Lưu" : "Tạo truyện"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

// ---------- Dashboard ----------

export type AuthorBalance = { earned: number; withdrawn: number; available: number; published_chapters: number; trusted: boolean };
export type AuthorPayoutRow = { id: string; period: string; coins: number; amount_vnd: number; status: string; note: string | null; requested_at: string };
export type PayoutInfo = { payout_bank: string | null; payout_account: string | null; payout_holder: string | null };

export function AuthorDashboard({ penName, share, stories, catalog, balance, payouts, payoutInfo, nextPayDate }: { penName: string; share: number; stories: AuthorStory[]; catalog: string[]; balance: AuthorBalance; payouts: AuthorPayoutRow[]; payoutInfo: PayoutInfo; nextPayDate: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [bank, setBank] = useState({ payout_bank: payoutInfo.payout_bank ?? "", payout_account: payoutInfo.payout_account ?? "", payout_holder: payoutInfo.payout_holder ?? "" });
  const [pending, setPending] = useState(false);
  const available = Number(balance.available);

  async function saveBank(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { ok, body } = await send("/api/author/profile", "PATCH", bank);
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không lưu được."));
    toast.success("Đã lưu thông tin nhận tiền.");
    router.refresh();
  }

  async function withdraw() {
    setPending(true);
    const { ok, body } = await send("/api/author/payouts", "POST");
    setPending(false);
    if (!ok) return toast.error(String(body.error ?? "Không gửi được yêu cầu."));
    toast.success(`Đã gửi yêu cầu rút ${formatCoins(Number(body.coins))}. Tiền sẽ được chuyển ngày ${body.payDate}.`);
    router.refresh();
  }

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight">Khu vực tác giả</h1><p className="text-sm text-muted-foreground">{penName} · nhận {share}% Xu · {balance.trusted ? <Badge>Tác giả tin cậy</Badge> : <span>còn {Math.max(TRUST_THRESHOLD - balance.published_chapters, 0)} chương đã đăng nữa để thành tác giả tin cậy</span>}</p></div>
      <Button onClick={() => setCreating(true)}><BookPlus />Tạo truyện mới</Button>
    </div>
    <Tabs defaultValue="stories">
      <TabsList className="mb-4"><TabsTrigger value="stories">Truyện của tôi ({stories.length})</TabsTrigger><TabsTrigger value="income">Thu nhập</TabsTrigger><TabsTrigger value="bank">Nhận tiền</TabsTrigger></TabsList>
      <TabsContent value="stories">
        {stories.length ? <div className="grid gap-4 md:grid-cols-2">{stories.map((story) => <Card key={story.id}>
          <CardHeader><CardTitle className="truncate">{story.title}</CardTitle><CardDescription>{story.genres.join(", ") || "Chưa chọn thể loại"} · {story.status}{story.lock_from_chapter ? ` · khóa từ ch.${story.lock_from_chapter}, ${formatCoins(story.lock_price_coins)}` : " · miễn phí"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-xs"><Badge variant="secondary">{story.published} đã đăng</Badge>{story.submitted > 0 && <Badge variant="outline">{story.submitted} chờ duyệt</Badge>}{story.drafts > 0 && <Badge variant="outline">{story.drafts} nháp</Badge>}{story.rejected > 0 && <Badge variant="destructive">{story.rejected} bị từ chối</Badge>}</div>
            <div className="flex flex-wrap gap-2"><Button size="sm" nativeButton={false} render={<Link href={`/tac-gia/truyen/${story.id}`} />}><PenLine />Viết / quản lý chương</Button>{story.published > 0 && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/truyen/${story.slug}`} target="_blank" />}><ExternalLink />Xem</Button>}</div>
          </CardContent>
        </Card>)}</div> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Bạn chưa có truyện nào. Bấm “Tạo truyện mới” để bắt đầu.</CardContent></Card>}
      </TabsContent>
      <TabsContent value="income" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader><CardDescription>Đã kiếm</CardDescription><CardTitle className="flex items-center gap-2 text-2xl"><Coins className="size-5 text-amber-500" />{formatCoins(Number(balance.earned))}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Đã rút / đang chờ chi</CardDescription><CardTitle className="text-2xl">{formatCoins(Number(balance.withdrawn))}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Có thể rút</CardDescription><CardTitle className="text-2xl text-emerald-600">{formatCoins(available)} <span className="text-sm font-normal text-muted-foreground">≈ {vnd.format(Math.floor(available * COIN_VND))}</span></CardTitle></CardHeader></Card>
        </div>
        <Alert><Wallet /><AlertTitle>Rút tiền mỗi tháng một lần, chi vào ngày {PAYOUT_DAY}</AlertTitle><AlertDescription>Kỳ chi gần nhất: <b>{nextPayDate}</b>. Tối thiểu {formatCoins(MIN_PAYOUT_COINS)}. Yêu cầu gửi sau ngày {PAYOUT_DAY} sẽ được chi vào kỳ tháng sau.</AlertDescription></Alert>
        <Button disabled={pending || available < MIN_PAYOUT_COINS} onClick={withdraw}>Yêu cầu rút {formatCoins(available)}</Button>
        {payouts.length > 0 && <Card><CardHeader><CardTitle>Lịch sử rút tiền</CardTitle></CardHeader><CardContent className="px-0"><Table>
          <TableHeader><TableRow><TableHead className="pl-6">Kỳ chi</TableHead><TableHead className="text-right">Xu</TableHead><TableHead className="text-right">Số tiền</TableHead><TableHead className="pr-6">Trạng thái</TableHead></TableRow></TableHeader>
          <TableBody>{payouts.map((payout) => <TableRow key={payout.id}><TableCell className="pl-6">{PAYOUT_DAY}/{payout.period.slice(5)}/{payout.period.slice(0, 4)}<p className="text-xs text-muted-foreground">gửi {dateFormat.format(new Date(payout.requested_at))}</p></TableCell><TableCell className="text-right tabular-nums">{formatCoins(Number(payout.coins))}</TableCell><TableCell className="text-right tabular-nums">{vnd.format(payout.amount_vnd)}</TableCell><TableCell className="pr-6"><Badge variant={payout.status === "paid" ? "default" : payout.status === "rejected" ? "destructive" : "secondary"}>{payout.status === "paid" ? "Đã chuyển" : payout.status === "rejected" ? "Từ chối" : "Chờ chi"}</Badge>{payout.note && <p className="text-xs text-muted-foreground">{payout.note}</p>}</TableCell></TableRow>)}</TableBody>
        </Table></CardContent></Card>}
      </TabsContent>
      <TabsContent value="bank"><Card>
        <CardHeader><CardTitle>Tài khoản nhận tiền</CardTitle><CardDescription>Dùng cho các kỳ chi ngày {PAYOUT_DAY}. Tên chủ tài khoản phải trùng với người đăng ký.</CardDescription></CardHeader>
        <CardContent><form onSubmit={saveBank}><FieldGroup>
          <Field><FieldLabel htmlFor="bank">Ngân hàng</FieldLabel><Input id="bank" required value={bank.payout_bank} onChange={(event) => setBank({ ...bank, payout_bank: event.target.value })} placeholder="Ví dụ: Vietcombank" /></Field>
          <Field><FieldLabel htmlFor="account">Số tài khoản</FieldLabel><Input id="account" required inputMode="numeric" value={bank.payout_account} onChange={(event) => setBank({ ...bank, payout_account: event.target.value })} /></Field>
          <Field><FieldLabel htmlFor="holder">Tên chủ tài khoản</FieldLabel><Input id="holder" required value={bank.payout_holder} onChange={(event) => setBank({ ...bank, payout_holder: event.target.value.toUpperCase() })} placeholder="NGUYEN VAN A" /></Field>
          <Button type="submit" disabled={pending}>Lưu</Button>
        </FieldGroup></form></CardContent>
      </Card></TabsContent>
    </Tabs>
    {creating && <AuthorStoryDialog open={creating} onOpenChange={setCreating} catalog={catalog} />}
  </>;
}
