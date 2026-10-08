import { NextResponse, type NextRequest } from "next/server";
import { rescanBatch } from "@/lib/moderation-rescan";
import { createServiceClient, serviceRoleReady } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Nightly job (vercel.json → crons): re-scans chapters left out of date after dictionary changes.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without the secret configured the job refuses to run.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serviceRoleReady()) return NextResponse.json({ error: "Thiếu SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  const db = createServiceClient();
  const started = Date.now();
  const total = { processed: 0, pending: 0, flaggedBack: 0, failed: 0, remaining: 0 };
  // Stop well before the 60 s limit; the next night continues where this one stopped.
  while (Date.now() - started < 45_000) {
    const batch = await rescanBatch(db);
    for (const key of ["processed", "pending", "flaggedBack", "failed"] as const) total[key] += batch[key];
    total.remaining = batch.remaining;
    if (!batch.processed || !batch.remaining) break;
  }
  return NextResponse.json(total);
}
