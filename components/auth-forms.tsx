"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, turnstileSiteKey } from "@/components/turnstile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

// Internal path to return to after member login (?next=/truyen/...), never an external URL.
function safeNext() {
  return safeInternalPath(new URLSearchParams(window.location.search).get("next"), window.location.origin);
}

function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <Button type="button" variant="outline" size="lg" onClick={onClick} className="w-full">{label}</Button>;
}

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileSiteKey && !captcha) return setError("Vui lòng hoàn thành bước xác minh chống bot.");
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({ email: String(data.get("email")), password: String(data.get("password")), options: { captchaToken: captcha ?? undefined } });
    setPending(false);
    if (error) return setError(error.code === "email_not_confirmed" ? "Email chưa được xác thực. Hãy mở email xác nhận rồi thử lại." : "Email hoặc mật khẩu không đúng.");
    if (admin) {
      const { data: aal } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel();
      router.push(aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/admin/xac-thuc" : "/admin");
    } else router.push(safeNext());
    router.refresh();
  }

  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(admin ? "/admin" : safeNext())}` } });
    if (error) setError(error.message);
  }

  return <form onSubmit={submit}>
    <FieldGroup>
      <Field><FieldLabel htmlFor="login-email">Email</FieldLabel><Input id="login-email" name="email" type="email" required autoComplete="email" placeholder="ban@example.com" className="h-10" /></Field>
      <Field><FieldLabel htmlFor="login-password">Mật khẩu</FieldLabel><Input id="login-password" name="password" type="password" required autoComplete="current-password" className="h-10" /></Field>
      <Turnstile onToken={setCaptcha} />
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Đang xử lý..." : "Đăng nhập"}</Button>
      <FieldSeparator>hoặc</FieldSeparator>
      <GoogleButton onClick={google} label="Đăng nhập với Google" />
    </FieldGroup>
  </form>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileSiteKey && !captcha) return setError("Vui lòng hoàn thành bước xác minh chống bot.");
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signUp({ email: String(data.get("email")), password: String(data.get("password")), options: { data: { display_name: String(data.get("name")) }, emailRedirectTo: `${window.location.origin}/auth/callback`, captchaToken: captcha ?? undefined } });
    setPending(false);
    if (error) return setError(error.message);
    setMessage("Kiểm tra email để xác nhận tài khoản.");
    router.refresh();
  }

  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) setError(error.message);
  }

  return <form onSubmit={submit}>
    <FieldGroup>
      <Field><FieldLabel htmlFor="register-name">Tên hiển thị</FieldLabel><Input id="register-name" name="name" required autoComplete="nickname" className="h-10" /></Field>
      <Field><FieldLabel htmlFor="register-email">Email</FieldLabel><Input id="register-email" name="email" type="email" required autoComplete="email" placeholder="ban@example.com" className="h-10" /></Field>
      <Field><FieldLabel htmlFor="register-password">Mật khẩu</FieldLabel><Input id="register-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="h-10" /><FieldDescription>Tối thiểu 8 ký tự.</FieldDescription></Field>
      <Turnstile onToken={setCaptcha} />
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
      <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Đang xử lý..." : "Đăng ký bằng email"}</Button>
      <FieldSeparator>hoặc</FieldSeparator>
      <GoogleButton onClick={google} label="Đăng ký với Google" />
    </FieldGroup>
  </form>;
}
