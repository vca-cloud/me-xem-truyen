"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// Second login step for admins who enabled 2-step verification.
export function MfaChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((item) => item.status === "verified");
    if (!factor) { setPending(false); router.push("/admin"); return; }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setPending(false);
    if (verifyError) return setError("Mã không đúng hoặc đã hết hạn.");
    router.push("/admin");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/admin/dang-nhap");
  }

  return <form onSubmit={submit} className="space-y-4">
    <Input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" aria-label="Mã xác thực" className="text-center text-lg tracking-[0.5em]" />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="w-full" disabled={pending}>{pending ? "Đang kiểm tra..." : "Xác nhận"}</Button>
    <button type="button" onClick={signOut} className="w-full text-center text-sm text-muted-foreground hover:underline">Đăng xuất</button>
  </form>;
}
