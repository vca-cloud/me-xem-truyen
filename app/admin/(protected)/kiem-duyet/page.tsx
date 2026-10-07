import { AdminModerationPage, type DictionaryTerm, type QueueItem } from "@/components/admin-moderation-page";
import { createClient } from "@/lib/supabase/server";

export default async function ModerationPage() {
  const supabase = await createClient();
  const [queue, dictionary] = await Promise.all([
    supabase.rpc("admin_moderation_queue", { p_include_reviewed: true }),
    supabase.from("moderation_terms").select("id, term, category, severity, mask_style, active").order("category").order("severity", { ascending: false }).order("term"),
  ]);
  const loadError = queue.error?.message ?? dictionary.error?.message ?? null;
  return <AdminModerationPage queue={(queue.data ?? []) as QueueItem[]} dictionary={(dictionary.data ?? []) as DictionaryTerm[]} loadError={loadError} />;
}
