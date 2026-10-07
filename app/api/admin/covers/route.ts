import { NextResponse } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { receiveCoverUpload } from "@/lib/cover-storage";

// Uploads a story cover (cropped and resized in the browser) to the public R2 bucket.
export async function POST(request: Request) {
  const guard = await guardAdminApi(roleAccess.content);
  if (guard.error) return guard.error;
  const result = await receiveCoverUpload(request);
  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json(result);
}
