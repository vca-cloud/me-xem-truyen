"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return <Button variant="outline" size="sm" onClick={signOut} disabled={pending}><LogOut className="size-4" />{pending ? "Đang đăng xuất..." : "Đăng xuất"}</Button>;
}
