import { NextResponse } from "next/server";
import { COIN_VND } from "@/lib/coins";
import { MIN_PAYOUT_COINS, payoutPeriod } from "@/lib/author-rules";
import { guardAuthorApi } from "@/lib/authors";

// Author asks to withdraw all available Xu. One request per payout period; payment is made on the 20th.
export async function POST() {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const { profile } = guard;
  if (!profile.payout_bank || !profile.payout_account || !profile.payout_holder) return NextResponse.json({ error: "Vui lòng điền thông tin tài khoản ngân hàng trước." }, { status: 400 });
  const { data: balance } = await guard.supabase.rpc("author_balance");
  const available = Number((balance as { available: number }[] | null)?.[0]?.available ?? 0);
  if (available < MIN_PAYOUT_COINS) return NextResponse.json({ error: `Cần tối thiểu ${MIN_PAYOUT_COINS} Xu để rút (hiện có ${available}).` }, { status: 400 });
  const { period, payDate } = payoutPeriod();
  const coins = Math.floor(available * 100) / 100;
  const { error } = await guard.admin.from("author_payouts").insert({
    author_id: guard.user.id, period, coins, amount_vnd: Math.floor(coins * COIN_VND),
    payout_bank: profile.payout_bank, payout_account: profile.payout_account, payout_holder: profile.payout_holder,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? `Bạn đã gửi yêu cầu cho kỳ chi ngày ${payDate}.` : error.message }, { status: 400 });
  return NextResponse.json({ ok: true, coins, payDate }, { status: 201 });
}
