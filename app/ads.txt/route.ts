import { adsEnabled, adsenseClient } from "@/lib/ads";

// Serves /ads.txt from NEXT_PUBLIC_ADSENSE_CLIENT so the publisher id lives in one place.
export function GET() {
  if (!adsEnabled || !adsenseClient) return new Response("Not found", { status: 404 });
  const publisherId = adsenseClient.replace(/^ca-/, "");
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
