"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Account = { loggedIn: false } | { loggedIn: true; balance: number };

async function loadAccount(): Promise<Account> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { loggedIn: false };
  const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  return { loggedIn: true, balance: data?.balance ?? 0 };
}

// Header area for readers: login/register links, or the Xu balance and a link to the wallet.
export function AccountMenu() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    let active = true;
    loadAccount().then((value) => { if (active) setAccount(value); }).catch(() => { if (active) setAccount({ loggedIn: false }); });
    return () => { active = false; };
  }, []);

  if (!account) return <div className="h-8 w-28" aria-hidden="true" />;
  if (!account.loggedIn) return <div className="flex shrink-0 items-center gap-2">
    <Link href="/dang-nhap" className="hidden h-8 items-center rounded-lg border border-white/35 px-2.5 text-sm font-medium text-white hover:bg-white/15 sm:inline-flex">Đăng nhập</Link>
    <Link href="/dang-ky" className="inline-flex h-8 items-center rounded-lg bg-orange-500 px-2.5 text-sm font-medium text-white hover:bg-orange-600">Đăng ký</Link>
  </div>;
  return <Link href="/tai-khoan" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/35 bg-white/10 px-2.5 text-sm font-medium text-white hover:bg-white/20" aria-label={`Ví Xu: ${account.balance} Xu`}>
    <Coins className="size-4 text-amber-300" aria-hidden="true" /><span className="tabular-nums">{account.balance.toLocaleString("vi-VN")}</span><span className="hidden sm:inline">Xu</span><UserRound className="ml-1 size-4" aria-hidden="true" />
  </Link>;
}
