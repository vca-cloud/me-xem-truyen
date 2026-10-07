import { NextResponse } from "next/server";
import { guardAuthorApi } from "@/lib/authors";
import { receiveCoverUpload } from "@/lib/cover-storage";

// Approved authors upload covers for their own stories (same rules as admin uploads).
export async function POST(request: Request) {
  const guard = await guardAuthorApi();
  if (guard.error) return guard.error;
  const result = await receiveCoverUpload(request);
  return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json(result);
}
