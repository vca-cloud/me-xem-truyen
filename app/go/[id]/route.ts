import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validTextUrl } from "@/lib/story-data";
import { deviceFromUserAgent, isBot, setVisitorCookie, visitorIdFrom } from "@/lib/tracking";

// Affiliate redirect: /go/<link-id>?s=<story-slug>&c=<chapter-number>
// Logs the click, then sends the reader to the stored affiliate URL.
export async function GET(request: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const home = new URL("/", request.url);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(home);

  const userAgent = request.headers.get("user-agent");
  const visitor = visitorIdFrom(request);
  const storySlug = request.nextUrl.searchParams.get("s");
  const chapter = Number(request.nextUrl.searchParams.get("c"));

  let target: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("track_affiliate_click", {
      p_link_id: id,
      p_story_slug: storySlug && /^[a-z0-9-]{1,200}$/.test(storySlug) ? storySlug : null,
      p_chapter_number: Number.isInteger(chapter) && chapter > 0 ? chapter : null,
      p_visitor_id: isBot(userAgent) ? null : visitor.id,
      p_device: deviceFromUserAgent(userAgent),
    });
    target = typeof data === "string" ? data : null;
  } catch {
    target = null;
  }

  const response = NextResponse.redirect(target && validTextUrl(target) ? target : home, 302);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  if (!isBot(userAgent)) setVisitorCookie(response, visitor);
  return response;
}
