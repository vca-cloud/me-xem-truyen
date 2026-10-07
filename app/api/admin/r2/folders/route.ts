import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { listR2, r2ApiReady, r2Buckets, type R2Source } from "@/lib/r2-browser";

// Folders (one level) in the public or private R2 bucket, for "Nhập từ Cloudflare".
export async function GET(request: NextRequest) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const buckets = r2Buckets();
  const available = (Object.keys(buckets) as R2Source[]).filter((source) => buckets[source]);
  if (!r2ApiReady()) return NextResponse.json({ ready: false, sources: available, error: "Chưa có khóa API R2 (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)." }, { status: 503 });
  const source = (request.nextUrl.searchParams.get("source") ?? available[0]) as R2Source;
  const bucket = buckets[source];
  if (!bucket) return NextResponse.json({ error: "Chưa cấu hình bucket này." }, { status: 400 });
  const prefix = request.nextUrl.searchParams.get("prefix") ?? "";
  try {
    const { folders, files } = await listR2(bucket, prefix);
    return NextResponse.json({ ready: true, sources: available, source, bucket, prefix, folders, txtCount: files.filter((file) => /\.txt$/i.test(file.key)).length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không đọc được R2." }, { status: 502 });
  }
}
