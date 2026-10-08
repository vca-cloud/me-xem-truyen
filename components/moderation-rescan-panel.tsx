"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Square } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Status = { termsChangedAt: string; outdated: number; total: number };
export const RESCAN_EVENT = "moderation:rescan";

const time = (iso: string) => new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

// Site-wide re-scan after dictionary changes: shows how many chapters were scanned with an older dictionary and
// re-scans them batch by batch (resumable: closing the page and pressing again continues with what is left).
// `version` changes whenever the dictionary list changes, which refreshes the count.
export function ModerationRescanPanel({ version }: { version: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/moderation/rescan").then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!active) return;
      if (response.ok) { setStatus(body as Status); setError(null); } else setError(String(body.error ?? "Không đọc được trạng thái quét."));
    }).catch(() => { if (active) setError("Lỗi kết nối đến server."); });
    return () => { active = false; };
  }, [version]);

  async function run() {
    if (progress) return;
    stop.current = false;
    const total = status?.outdated ?? 0;
    const sum = { processed: 0, pending: 0, flaggedBack: 0, failed: 0 };
    setProgress({ done: 0, total });
    try {
      for (;;) {
        const response = await fetch("/api/admin/moderation/rescan", { method: "POST" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(body.error ?? "Quét lại thất bại."));
        for (const key of ["processed", "pending", "flaggedBack", "failed"] as const) sum[key] += Number(body[key] ?? 0);
        setProgress({ done: sum.processed, total: Math.max(total, sum.processed + Number(body.remaining ?? 0)) });
        setStatus((current) => current && { ...current, outdated: Number(body.remaining ?? 0) });
        if (!body.processed || !body.remaining || stop.current) break;
      }
      toast.success(`Đã quét lại ${sum.processed.toLocaleString("vi-VN")} chương.`, { description: [sum.pending && `${sum.pending} chương chờ duyệt`, sum.flaggedBack && `${sum.flaggedBack} chương đã duyệt bị đưa lại hàng chờ (có từ nặng mới)`, sum.failed && `${sum.failed} chương không đọc được file`].filter(Boolean).join(" · ") || "Không có chương nào cần duyệt thêm." });
    } catch (runError) {
      toast.error(runError instanceof Error ? runError.message : "Quét lại thất bại.", { description: "Bấm lại để quét tiếp phần còn thiếu." });
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  // The dictionary editor's toast offers "Quét lại toàn web" through this event.
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  useEffect(() => {
    const listener = () => { void runRef.current(); };
    window.addEventListener(RESCAN_EVENT, listener);
    return () => window.removeEventListener(RESCAN_EVENT, listener);
  }, []);

  if (error) return <Alert variant="destructive" className="mb-6"><AlertTitle>Không đọc được trạng thái quét lại</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (!status) return null;
  if (!status.outdated && !progress) return <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" />Toàn bộ {status.total.toLocaleString("vi-VN")} chương đã được quét theo từ điển mới nhất ({time(status.termsChangedAt)}).</p>;

  return <Alert className="mb-6 border-highlight/40 bg-highlight/5">
    <RefreshCw />
    <AlertTitle>Từ điển đã thay đổi lúc {time(status.termsChangedAt)}</AlertTitle>
    <AlertDescription>
      <p>{status.outdated.toLocaleString("vi-VN")}/{status.total.toLocaleString("vi-VN")} chương chưa được quét theo từ điển mới (phần che chữ trên trang đọc đã áp dụng ngay; quét lại để cập nhật quảng cáo, hàng chờ duyệt và nhãn 18+). Chương admin đã duyệt giữ nguyên, trừ khi có từ mức nặng mới.</p>
      {progress && <div className="mt-2 w-full"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-highlight transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }} /></div><p className="mt-1 text-xs">Đã quét {progress.done.toLocaleString("vi-VN")}/{progress.total.toLocaleString("vi-VN")} chương…</p></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!!progress} onClick={run} className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><RefreshCw className={progress ? "animate-spin" : undefined} />{progress ? "Đang quét..." : "Quét lại toàn web"}</Button>
        {progress && <Button size="sm" variant="outline" onClick={() => { stop.current = true; }}><Square />Dừng sau đợt này</Button>}
      </div>
    </AlertDescription>
  </Alert>;
}
