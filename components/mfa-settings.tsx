"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string; created_at: string };
type Enrollment = { factorId: string; qr: string; secret: string };

async function listVerified(): Promise<Factor[]> {
  const { data } = await createClient().auth.mfa.listFactors();
  return (data?.totp ?? []).filter((factor) => factor.status === "verified") as Factor[];
}

// Lets an admin turn on/off 2-step verification with an authenticator app (Google Authenticator, Authy, ...).
export function MfaSettings() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => setFactors(await listVerified()), []);
  useEffect(() => {
    let active = true;
    listVerified().then((value) => { if (active) setFactors(value); });
    return () => { active = false; };
  }, []);

  async function start() {
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Mê Xem Truyện ${new Date().toISOString().slice(0, 16)}` });
    setPending(false);
    if (error || !data) return setMessage({ ok: false, text: error?.message ?? "Không thể bắt đầu thiết lập." });
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setPending(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
    setPending(false);
    if (error) return setMessage({ ok: false, text: "Mã không đúng hoặc đã hết hạn, hãy thử mã mới." });
    setEnrollment(null);
    setCode("");
    setMessage({ ok: true, text: "Đã bật xác thực 2 lớp. Lần đăng nhập admin sau sẽ cần mã từ ứng dụng." });
    await refresh();
  }

  async function disable(factor: Factor) {
    if (!window.confirm("Tắt xác thực 2 lớp? Tài khoản admin sẽ chỉ còn bảo vệ bằng mật khẩu.")) return;
    setPending(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: factor.id });
    setPending(false);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: "Đã tắt xác thực 2 lớp." });
    await refresh();
  }

  return <div className="space-y-4">
    {message && <p role="status" className={`rounded-md px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</p>}
    {factors === null ? <p className="text-sm text-slate-500">Đang kiểm tra...</p>
      : factors.length ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800"><ShieldCheck className="size-5" />Xác thực 2 lớp đang bật</p>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => disable(factors[0])}><ShieldOff className="size-4" />Tắt</Button>
        </div>
      : !enrollment ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">Chưa bật. Nên bật để kẻ gian không vào được admin dù biết mật khẩu.</p>
          <Button size="sm" disabled={pending} onClick={start}>Bật xác thực 2 lớp</Button>
        </div>
      : <form onSubmit={confirm} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">1. Mở ứng dụng <b>Google Authenticator</b> (hoặc Authy, Microsoft Authenticator) và quét mã QR:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR is an inline SVG data URL from Supabase */}
          <img src={enrollment.qr} alt="Mã QR xác thực 2 lớp" className="size-44 rounded border bg-white p-2" />
          <p className="text-xs text-slate-500">Không quét được? Nhập khóa thủ công: <code className="break-all">{enrollment.secret}</code></p>
          <label className="block text-sm">2. Nhập mã 6 số đang hiện trong ứng dụng:<Input required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 max-w-40" /></label>
          <div className="flex gap-2"><Button type="submit" disabled={pending}>Xác nhận</Button><Button type="button" variant="outline" onClick={() => setEnrollment(null)}>Hủy</Button></div>
        </form>}
  </div>;
}
