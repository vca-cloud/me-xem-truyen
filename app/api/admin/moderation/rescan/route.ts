import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { rescanBatch, rescanStatus } from "@/lib/moderation-rescan";
import { createServiceClient, serviceRoleReady } from "@/lib/supabase/admin";

export const maxDuration = 60;

// How many chapters were scanned before the last dictionary change.
export async function GET() {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  if (!serviceRoleReady()) return NextResponse.json({ error: "Thiếu SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  try {
    return NextResponse.json(await rescanStatus(createServiceClient()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không đọc được trạng thái." }, { status: 500 });
  }
}

// Re-scans the next batch; the admin page calls it repeatedly until nothing is left (and can resume later).
export async function POST() {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  if (!serviceRoleReady()) return NextResponse.json({ error: "Thiếu SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  try {
    return NextResponse.json(await rescanBatch(createServiceClient()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quét lại thất bại." }, { status: 500 });
  }
}
