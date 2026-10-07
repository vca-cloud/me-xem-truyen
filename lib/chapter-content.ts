import "server-only";

import { AwsClient } from "aws4fetch";
import { r2Config } from "@/lib/r2";

// Chapter content links come in two forms:
//   https://...            a public file (e.g. the public R2 bucket)
//   r2://path/file.txt     an object in the PRIVATE R2 bucket (R2_BUCKET), read with server credentials —
//                          use this for paid chapters so the file cannot be opened by guessing its address.
const PRIVATE_PREFIX = "r2://";

function allowedHosts() {
  const hosts = new Set((process.env.CHAPTER_TEXT_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
  try {
    if (r2Config.publicUrl) hosts.add(new URL(r2Config.publicUrl).host.toLowerCase());
  } catch {
    // ignore a malformed R2_PUBLIC_URL
  }
  return hosts;
}

const privateR2Ready = () => !!(r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey && r2Config.bucket);

// Validates an admin-entered content link. Public links must be http(s) and, when an allow-list exists
// (R2_PUBLIC_URL and/or CHAPTER_TEXT_HOSTS), point at one of those hosts so the server never fetches arbitrary URLs.
export function contentUrlError(value: string): string | null {
  const url = value.trim();
  if (url.startsWith(PRIVATE_PREFIX)) {
    if (!/^r2:\/\/[A-Za-z0-9._\-/]+$/.test(url) || url.includes("..")) return "Đường dẫn r2:// chỉ gồm chữ, số, . _ - /";
    return privateR2Ready() ? null : "Chưa cấu hình R2 riêng tư (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).";
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Link nội dung không hợp lệ.";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "Link nội dung phải bắt đầu bằng http:// hoặc https://.";
  const hosts = allowedHosts();
  if (hosts.size && !hosts.has(parsed.host.toLowerCase())) return `Link nội dung phải nằm trên: ${[...hosts].join(", ")}.`;
  return null;
}

// Downloads chapter text from a public link or the private R2 bucket. Throws on any failure.
export async function fetchChapterText(link: string): Promise<string> {
  if (contentUrlError(link)) throw new Error("Link nội dung không được phép.");
  let response: Response;
  if (link.startsWith(PRIVATE_PREFIX)) {
    const key = link.slice(PRIVATE_PREFIX.length).split("/").map(encodeURIComponent).join("/");
    const client = new AwsClient({ accessKeyId: r2Config.accessKeyId!, secretAccessKey: r2Config.secretAccessKey!, service: "s3", region: "auto" });
    response = await client.fetch(`https://${r2Config.accountId}.r2.cloudflarestorage.com/${r2Config.bucket}/${key}`, { cache: "no-store" });
  } else {
    response = await fetch(link, { next: { revalidate: 3600 }, redirect: "error" });
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.text()).replace(/^﻿/, "");
}

// Many chapter files start with their own heading ("CHƯƠNG 1: ...", "Tập 3 - ..."), which the page already shows.
// Drops that first line when it names the same chapter number, so the heading is not repeated.
export function stripChapterHeading(text: string, chapterNumber: number) {
  const match = text.match(/^\s*(chương|chuong|tập|tap|chapter)\s*0*(\d+)\b[^\n]*(\r?\n)+/iu);
  return match && Number(match[2]) === chapterNumber ? text.slice(match[0].length) : text;
}
