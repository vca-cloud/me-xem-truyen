import { NextResponse } from "next/server";
import { guardAuthorApi } from "@/lib/authors";

// Author edits bio/contact and the bank account used for monthly payouts.
export async function PATCH(request: Request) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const text = (key: string, max: number) => (typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : undefined);
  const update: Record<string, string | null> = { updated_at: new Date().toISOString() };
  for (const [key, max] of [["bio", 1000], ["contact", 200], ["payout_bank", 100], ["payout_account", 40], ["payout_holder", 100]] as const) {
    const value = text(key, max);
    if (value !== undefined) update[key] = value || null;
  }
  if (update.payout_account && !/^[0-9 ]{6,30}$/.test(update.payout_account)) return NextResponse.json({ error: "Số tài khoản chỉ gồm chữ số." }, { status: 400 });
  const { error } = await guard.admin.from("author_profiles").update(update).eq("user_id", guard.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
