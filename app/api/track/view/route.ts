import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deviceFromUserAgent, isBot, referrerHost, setVisitorCookie, visitorIdFrom } from "@/lib/tracking";

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent");
  const response = new NextResponse(null, { status: 204 });
  if (isBot(userAgent)) return response;

  const body = await request.json().catch(() => null) as { story_slug?: unknown; chapter_number?: unknown; referrer?: unknown } | null;
  const storySlug = typeof body?.story_slug === "string" ? body.story_slug.trim() : "";
  const chapterNumber = Number.isInteger(body?.chapter_number) && Number(body?.chapter_number) > 0 ? Number(body?.chapter_number) : null;
  if (!/^[a-z0-9-]{1,200}$/.test(storySlug)) return NextResponse.json({ error: "Truyện không hợp lệ." }, { status: 400 });

  const visitor = visitorIdFrom(request);
  try {
    const supabase = await createClient();
    await supabase.rpc("track_view", {
      p_story_slug: storySlug,
      p_chapter_number: chapterNumber,
      p_visitor_id: visitor.id,
      p_device: deviceFromUserAgent(userAgent),
      p_referrer_host: referrerHost(body?.referrer, request.nextUrl.host),
    });
  } catch {
    // Tracking must never break reading; failures are dropped silently.
  }
  setVisitorCookie(response, visitor);
  return response;
}
