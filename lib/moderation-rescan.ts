import "server-only";

import { fetchChapterText } from "@/lib/chapter-content";
import { clearModerationCache, moderateContent } from "@/lib/moderation";
import type { ModerationHit } from "@/lib/moderation-core";
import type { createServiceClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createServiceClient>;
type Row = { id: string; title: string; text_url: string; moderation_status: string; moderation_hits: ModerationHit[] | null };

export const RESCAN_BATCH = 25;

// When the dictionary last changed (migration 0011). Chapters scanned before it — or never — are out of date.
async function termsChangedAt(db: Db) {
  const { data, error } = await db.from("moderation_state").select("terms_changed_at").maybeSingle();
  if (error) throw new Error(/moderation_state/.test(error.message) ? "Cần chạy file supabase/migrations/0011_moderation_rescan.sql trong Supabase." : error.message);
  return new Date(data?.terms_changed_at ?? 0);
}

const outdatedFilter = (changedAt: Date) => `moderated_at.is.null,moderated_at.lt.${changedAt.toISOString()}`;

export async function rescanStatus(db: Db) {
  const changedAt = await termsChangedAt(db);
  const [{ count: outdated }, { count: total }] = await Promise.all([
    db.from("chapters").select("id", { count: "exact", head: true }).or(outdatedFilter(changedAt)),
    db.from("chapters").select("id", { count: "exact", head: true }),
  ]);
  return { termsChangedAt: changedAt.toISOString(), outdated: outdated ?? 0, total: total ?? 0 };
}

// Re-scans the next batch of out-of-date chapters with the current dictionary.
// - Not yet reviewed by an admin: ads / review / 18+ follow the new scan.
// - Approved by an admin: the decision is kept, unless the new dictionary finds a serious term (severity ≥ 2) that
//   was not there when it was reviewed — then the chapter goes back to the review queue with ads off.
// - Unreadable file: a reviewed chapter keeps its decision; others go to review (as on first scan).
export async function rescanBatch(db: Db, limit = RESCAN_BATCH) {
  clearModerationCache();
  const changedAt = await termsChangedAt(db);
  // Stamp at least just after the dictionary change, so a server clock behind the database never re-queues a chapter.
  const stamp = () => new Date(Math.max(Date.now(), changedAt.getTime() + 1)).toISOString();
  const { data, error } = await db.from("chapters")
    .select("id, title, text_url, moderation_status, moderation_hits")
    .or(outdatedFilter(changedAt))
    .order("moderated_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const summary = { processed: 0, pending: 0, flaggedBack: 0, failed: 0 };

  for (const row of rows) {
    let text: string | null = null;
    try { text = await fetchChapterText(row.text_url); } catch { text = null; }
    const result = await moderateContent({ title: row.title, text });
    const reviewed = row.moderation_status === "approved";
    let update: Record<string, unknown>;
    if (reviewed && text === null) {
      update = { moderated_at: stamp() };
      summary.failed += 1;
    } else if (reviewed) {
      const before = new Set((row.moderation_hits ?? []).filter((hit) => hit.severity >= 2).map((hit) => hit.term));
      const fresh = (result.moderation_hits as ModerationHit[]).filter((hit) => hit.severity >= 2 && !before.has(hit.term));
      if (fresh.length) {
        update = { ...result, moderated_at: stamp(), moderated_by: null };
        summary.flaggedBack += 1;
      } else {
        update = { moderation_score: result.moderation_score, moderation_hits: result.moderation_hits, moderated_at: stamp() };
      }
    } else {
      update = { ...result, moderated_at: stamp(), moderated_by: null };
      if (text === null) summary.failed += 1;
      if (result.moderation_status === "pending") summary.pending += 1;
    }
    const { error: updateError } = await db.from("chapters").update(update).eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    summary.processed += 1;
  }
  const { outdated } = await rescanStatus(db);
  return { ...summary, remaining: outdated };
}
