"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/safe-redirect";

// Internal path to return to after member login (?next=/truyen/...), never an external URL.
function safeNext() {
  return safeInternalPath(new URLSearchParams(window.location.search).get("next"), window.location.origin);
}

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    const data = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({ email: String(data.get("email")), password: String(data.get("password")) });
    setPending(false);
    if (error) {
      setError(error.code === "email_not_confirmed" ? "Email chưa được xác thực. Hãy mở email xác nhận từ Supabase rồi thử lại." : "Email hoặc mật khẩu không đúng.");
      return;
    }
    router.push(admin ? "/admin" : safeNext()); router.refresh();
  }
  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(admin ? "/admin" : safeNext())}` } });
    if (error) setError(error.message);
  }
  return <div className="space-y-4"><form onSubmit={submit} className="space-y-4"><input name="email" type="email" required autoComplete="email" placeholder="ban@example.com" className="h-10 w-full rounded-md border bg-background px-3 text-sm" /><input name="password" type="password" required autoComplete="current-password" placeholder="Mật khẩu" className="h-10 w-full rounded-md border bg-background px-3 text-sm" /><Button disabled={pending} type="submit" className="w-full">{pending ? "Đang xử lý..." : "Đăng nhập"}</Button></form><Button type="button" variant="outline" onClick={google} className="w-full">Đăng nhập với Google</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}

export function RegisterForm() {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(null); setMessage(null); const data = new FormData(event.currentTarget); const { error } = await createClient().auth.signUp({ email: String(data.get("email")), password: String(data.get("password")), options: { data: { display_name: String(data.get("name")) }, emailRedirectTo: `${window.location.origin}/auth/callback` } }); setPending(false); if (error) setError(error.message); else { setMessage("Kiểm tra email để xác nhận tài khoản."); router.refresh(); } }
  async function google() { const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (error) setError(error.message); }
  return <div className="space-y-4"><form onSubmit={submit} className="space-y-4"><input name="name" required placeholder="Tên hiển thị" className="h-10 w-full rounded-md border bg-background px-3 text-sm" /><input name="email" type="email" required autoComplete="email" placeholder="ban@example.com" className="h-10 w-full rounded-md border bg-background px-3 text-sm" /><input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" className="h-10 w-full rounded-md border bg-background px-3 text-sm" /><Button disabled={pending} type="submit" className="w-full">{pending ? "Đang xử lý..." : "Đăng ký bằng email"}</Button></form><Button type="button" variant="outline" onClick={google} className="w-full">Đăng ký với Google</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p className="text-sm text-emerald-600">{message}</p>}</div>;
}
