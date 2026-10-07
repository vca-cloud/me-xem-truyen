import { AdminAuthorsPage, type AdminAuthor, type AdminPayout } from "@/components/admin-authors-page";
import { createClient } from "@/lib/supabase/server";

export default async function AuthorsPage() {
  const supabase = await createClient();
  const [authors, payouts] = await Promise.all([
    supabase.rpc("admin_list_authors"),
    supabase.from("author_payouts").select("id, author_id, period, coins, amount_vnd, status, payout_bank, payout_account, payout_holder, note, requested_at").order("status").order("requested_at", { ascending: false }).limit(500),
  ]);
  const list = (authors.data ?? []) as AdminAuthor[];
  const names = new Map(list.map((author) => [author.user_id, author.pen_name]));
  const rows = ((payouts.data ?? []) as Omit<AdminPayout, "pen_name">[]).map((payout) => ({ ...payout, pen_name: names.get(payout.author_id) ?? "?" }));
  return <AdminAuthorsPage authors={list} payouts={rows} loadError={authors.error?.message ?? payouts.error?.message ?? null} />;
}
