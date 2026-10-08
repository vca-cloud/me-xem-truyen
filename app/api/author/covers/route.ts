import { after, NextResponse, type NextRequest } from "next/server";
import { guardAuthorApi } from "@/lib/authors";
import { cleanupOrphanCovers, deleteCoverIfUnused, receiveCoverUpload } from "@/lib/cover-storage";

// Approved authors upload covers for their own stories (same rules as admin uploads).
export async function POST(request: Request) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const result = await receiveCoverUpload(request);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  after(() => cleanupOrphanCovers(guard.admin));
  return NextResponse.json(result);
}

// Discards a cover uploaded in the open form but replaced or removed before saving. Only deleted when no story uses it.
export async function DELETE(request: NextRequest) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const url = request.nextUrl.searchParams.get("url");
  if (url) await deleteCoverIfUnused(guard.admin, url);
  return new NextResponse(null, { status: 204 });
}
