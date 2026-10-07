"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Account = { loggedIn: false } | { loggedIn: true; balance: number };

async function loadAccount(): Promise<Account> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { loggedIn: false };
  const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  return { loggedIn: true, balance: data?.balance ?? 0 };
}

// Header area for readers: login/register links, or the Xu balance and a link to the wallet.
// tone "dark" sits on the blue site header, "light" on the pale reading background.
export function AccountMenu({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const outline = tone === "dark" ? "border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white" : "bg-background";
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    let active = true;
    loadAccount().then((value) => { if (active) setAccount(value); }).catch(() => { if (active) setAccount({ loggedIn: false }); });
    return () => { active = false; };
  }, []);

  if (!account) return <div className="h-8 w-28" aria-hidden="true" />;
  if (!account.loggedIn) return <div className="flex shrink-0 items-center gap-2">
    <Button variant="outline" className={cn("hidden sm:inline-flex", outline)} nativeButton={false} render={<Link href="/dang-nhap" />}>Đăng nhập</Button>
    <Button className="bg-orange-500 text-white hover:bg-orange-600" nativeButton={false} render={<Link href="/dang-ky" />}>Đăng ký</Button>
  </div>;
  return <Button variant="outline" className={outline} aria-label={`Ví Xu: ${account.balance} Xu`} nativeButton={false} render={<Link href="/tai-khoan" />}>
    <Coins className="text-amber-400" aria-hidden="true" /><span className="tabular-nums">{account.balance.toLocaleString("vi-VN")}</span><span className="hidden sm:inline">Xu</span><UserRound aria-hidden="true" />
  </Button>;
}
