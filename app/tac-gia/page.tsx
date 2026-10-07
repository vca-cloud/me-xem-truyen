import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthorApplyForm, AuthorDashboard, type AuthorBalance, type AuthorPayoutRow } from "@/components/author-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { payoutPeriod } from "@/lib/author-rules";
import { getAuthorContext, loadAuthorStories } from "@/lib/authors";
import { createServiceClient, serviceRoleReady } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Khu vực tác giả", robots: { index: false } };

export default async function AuthorHomePage() {
  const { user, profile, supabase } = await getAuthorContext();
  if (!user) redirect("/dang-nhap?next=/tac-gia");

  let content: React.ReactNode;
  if (!serviceRoleReady()) content = <Alert variant="destructive"><AlertTitle>Khu vực tác giả chưa sẵn sàng</AlertTitle><AlertDescription>Máy chủ chưa cấu hình khóa service role.</AlertDescription></Alert>;
  else if (!profile || profile.status === "rejected") content = <AuthorApplyForm rejectedNote={profile?.review_note} />;
  else if (profile.status === "pending") content = <Alert><AlertTitle>Đơn đăng ký đang chờ duyệt</AlertTitle><AlertDescription>Bút danh “{profile.pen_name}”. Admin sẽ duyệt sớm; bạn có thể quay lại trang này để kiểm tra.</AlertDescription></Alert>;
  else if (profile.status === "suspended") content = <Alert variant="destructive"><AlertTitle>Tài khoản tác giả đang bị tạm khóa</AlertTitle><AlertDescription>{profile.review_note ?? "Vui lòng liên hệ admin."}</AlertDescription></Alert>;
  else {
    const admin = createServiceClient();
    const [stories, { data: genres }, { data: balance }, { data: payouts }] = await Promise.all([
      loadAuthorStories(admin, user.id),
      admin.from("genres").select("name").order("name"),
      supabase.rpc("author_balance"),
      supabase.from("author_payouts").select("id, period, coins, amount_vnd, status, note, requested_at").order("requested_at", { ascending: false }).limit(24),
    ]);
    content = <AuthorDashboard penName={profile.pen_name} share={profile.revenue_share} stories={stories} catalog={(genres ?? []).map((genre) => genre.name)}
      balance={((balance as AuthorBalance[] | null)?.[0]) ?? { earned: 0, withdrawn: 0, available: 0, published_chapters: 0, trusted: false }}
      payouts={(payouts ?? []) as AuthorPayoutRow[]} payoutInfo={profile} nextPayDate={payoutPeriod().payDate} />;
  }

  return <main className="min-h-screen bg-muted/30 px-4 py-8"><div className="mx-auto max-w-5xl">
    <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Về trang chủ</Link>
    {content}
  </div></main>;
}
