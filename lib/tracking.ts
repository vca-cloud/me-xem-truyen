import "server-only";

import type { NextRequest, NextResponse } from "next/server";

export const VISITOR_COOKIE = "mxt_vid";
const VISITOR_PATTERN = /^[a-f0-9-]{36}$/;
const BOT_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python|axios|node-fetch|go-http/i;

export function isBot(userAgent: string | null) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export function deviceFromUserAgent(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

// Anonymous first-party visitor id; no IP or personal data is stored.
export function visitorIdFrom(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  return existing && VISITOR_PATTERN.test(existing) ? { id: existing, isNew: false } : { id: crypto.randomUUID(), isNew: true };
}

export function setVisitorCookie(response: NextResponse, visitor: { id: string; isNew: boolean }) {
  if (!visitor.isNew) return;
  response.cookies.set(VISITOR_COOKIE, visitor.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export function referrerHost(value: unknown, ownHost: string | null) {
  if (typeof value !== "string" || !value) return null;
  try {
    const host = new URL(value).host;
    return host && host !== ownHost ? host : null;
  } catch {
    return null;
  }
}
