"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
  const askConfirm = useConfirm();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => setFactors(await listVerified()), []);
  useEffect(() => {
    let active = true;
    listVerified().then((value) => { if (active) setFactors(value); });
    return () => { active = false; };
  }, []);

  async function start() {
    setPending(true);
    const supabase = createClient();
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `mê xem truyện ${new Date().toISOString().slice(0, 16)}` });
    setPending(false);
    if (error || !data) return void toast.error(error?.message ?? "Không thể bắt đầu thiết lập.");
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setPending(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
    setPending(false);
    if (error) return void toast.error("Mã không đúng hoặc đã hết hạn, hãy thử mã mới.");
    setEnrollment(null);
    setCode("");
    toast.success("Đã bật xác thực 2 lớp. Lần đăng nhập admin sau sẽ cần mã từ ứng dụng.");
    await refresh();
  }

  async function disable(factor: Factor) {
    if (!await askConfirm({ title: "Tắt xác thực 2 lớp?", description: "Tài khoản admin sẽ chỉ còn được bảo vệ bằng mật khẩu.", confirmText: "Tắt", destructive: true })) return;
    setPending(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: factor.id });
    setPending(false);
    if (error) toast.error(error.message); else toast.success("Đã tắt xác thực 2 lớp.");
    await refresh();
  }

  return <div className="space-y-4">
    {factors === null ? <p className="text-sm text-slate-500">Đang kiểm tra...</p>
      : factors.length ? <Alert><ShieldCheck /><AlertTitle>Xác thực 2 lớp đang bật</AlertTitle><AlertDescription>Đăng nhập admin cần thêm mã 6 số từ ứng dụng.</AlertDescription><AlertAction><Button variant="outline" size="sm" disabled={pending} onClick={() => disable(factors[0])}><ShieldOff />Tắt</Button></AlertAction></Alert>
      : !enrollment ? <Alert><ShieldOff /><AlertTitle>Chưa bật xác thực 2 lớp</AlertTitle><AlertDescription>Nên bật để kẻ gian không vào được admin dù biết mật khẩu.</AlertDescription><AlertAction><Button size="sm" disabled={pending} onClick={start}>Bật</Button></AlertAction></Alert>
      : <form onSubmit={confirm} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">1. Mở ứng dụng <b>Google Authenticator</b> (hoặc Authy, Microsoft Authenticator) và quét mã QR:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR is an inline SVG data URL from Supabase */}
          <img src={enrollment.qr} alt="Mã QR xác thực 2 lớp" className="size-44 rounded border bg-white p-2" />
          <p className="text-xs text-slate-500">Không quét được? Nhập khóa thủ công: <code className="break-all">{enrollment.secret}</code></p>
          <Field><FieldLabel htmlFor="mfa-code">2. Nhập mã 6 số đang hiện trong ứng dụng</FieldLabel><Input id="mfa-code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} className="max-w-40" /><FieldDescription>Mã đổi mỗi 30 giây.</FieldDescription></Field>
          <div className="flex gap-2"><Button type="submit" disabled={pending}>Xác nhận</Button><Button type="button" variant="outline" onClick={() => setEnrollment(null)}>Hủy</Button></div>
        </form>}
  </div>;
}
