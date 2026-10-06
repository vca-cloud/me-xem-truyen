// Returns `next` only if it resolves to a path on the same origin; otherwise "/".
// Plain startsWith("/") is not enough: "/\\evil.com" is normalized by URL parsers to "//evil.com".
export function safeInternalPath(next: string | null | undefined, origin: string) {
  if (!next || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
