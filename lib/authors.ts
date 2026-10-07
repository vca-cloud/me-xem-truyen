import "server-only";

import { NextResponse } from "next/server";
import { createServiceClient, serviceRoleReady } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthorProfile = {
  user_id: string; pen_name: string; bio: string; contact: string; status: "pending" | "approved" | "rejected" | "suspended";
  revenue_share: number; trusted_override: boolean | null; review_note: string | null;
  payout_bank: string | null; payout_account: string | null; payout_holder: string | null; created_at: string;
};

const profileColumns = "user_id, pen_name, bio, contact, status, revenue_share, trusted_override, review_note, payout_bank, payout_account, payout_holder, created_at";

// Signed-in member and their author profile (if any), read with the member's own session.
export async function getAuthorContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase } as const;
  const { data } = await supabase.from("author_profiles").select(profileColumns).eq("user_id", user.id).maybeSingle();
  return { user, profile: (data as AuthorProfile | null) ?? null, supabase } as const;
}

export async function isTrustedAuthor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.rpc("author_balance");
  return !!(data as { trusted: boolean }[] | null)?.[0]?.trusted;
}

type Guard =
  | { error: NextResponse }
  | { error?: never; user: { id: string; email?: string }; profile: AuthorProfile; admin: ReturnType<typeof createServiceClient>; supabase: Awaited<ReturnType<typeof createClient>> };

// For author API routes: signed in, approved author, and the server can write with the service role.
export async function guardAuthorApi(): Promise<Guard> {
  if (!serviceRoleReady()) return { error: NextResponse.json({ error: "Máy chủ chưa cấu hình khóa service role." }, { status: 503 }) };
  const { user, profile, supabase } = await getAuthorContext();
  if (!user) return { error: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  if (!profile || profile.status !== "approved") return { error: NextResponse.json({ error: "Tài khoản chưa được duyệt làm tác giả." }, { status: 403 }) };
  return { user, profile, admin: createServiceClient(), supabase };
}

// Loads a story only if it belongs to the author.
export async function ownedStory(admin: ReturnType<typeof createServiceClient>, storyId: string, authorId: string) {
  const { data } = await admin.from("stories").select("id, slug, title, owner_id, lock_from_chapter, lock_price_coins").eq("id", storyId).maybeSingle();
  return data && data.owner_id === authorId ? data : null;
}

type StoryRow = { id: string; slug: string; title: string; description: string; cover_url: string | null; status: string; lock_from_chapter: number | null; lock_price_coins: number; story_genres: { genres: { name: string } | null }[] | null };

// The author's own stories (any publish state) with chapter counts per publish status.
export async function loadAuthorStories(admin: ReturnType<typeof createServiceClient>, authorId: string, storyId?: string) {
  let query = admin.from("stories").select("id, slug, title, description, cover_url, status, lock_from_chapter, lock_price_coins, story_genres(genres(name))").eq("owner_id", authorId).order("updated_at", { ascending: false });
  if (storyId) query = query.eq("id", storyId);
  const { data: stories } = await query;
  const ids = (stories ?? []).map((story) => story.id);
  const { data: chapters } = ids.length ? await admin.from("chapters").select("story_id, publish_status").in("story_id", ids) : { data: [] };
  const count = (id: string, status: string) => (chapters ?? []).filter((chapter) => chapter.story_id === id && chapter.publish_status === status).length;
  return ((stories ?? []) as unknown as StoryRow[]).map(({ story_genres, ...story }) => ({
    ...story,
    status: story.status as "Đang ra" | "Hoàn thành" | "Tạm dừng",
    genres: (story_genres ?? []).map((item) => item.genres?.name).filter((name): name is string => !!name),
    published: count(story.id, "published"), submitted: count(story.id, "submitted"), drafts: count(story.id, "draft"), rejected: count(story.id, "rejected"),
  }));
}
