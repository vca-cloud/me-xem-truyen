import { after, NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { cleanupOrphanCovers, deleteCoverIfUnused, receiveCoverUpload } from "@/lib/cover-storage";
import { createServiceClient, serviceRoleReady } from "@/lib/supabase/admin";

// Uploads a story cover (cropped and resized in the browser) to the public R2 bucket.
// Afterwards, sweeps covers that were uploaded but never saved to a story (older than 24 hours).
export async function POST(request: Request) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const result = await receiveCoverUpload(request);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (serviceRoleReady()) after(() => cleanupOrphanCovers(createServiceClient()));
  return NextResponse.json(result);
}

// Discards a cover uploaded in the open form but replaced or removed before saving. Only deleted when no story uses it.
export async function DELETE(request: NextRequest) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const url = request.nextUrl.searchParams.get("url");
  if (url && serviceRoleReady()) await deleteCoverIfUnused(createServiceClient(), url);
  return new NextResponse(null, { status: 204 });
}
