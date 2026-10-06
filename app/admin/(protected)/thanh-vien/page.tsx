import { AdminMembersPage, type AdminMember } from "@/components/admin-members-page";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage() {
  let members: AdminMember[] = [];
  let loadError: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_members");
    if (error) loadError = error.message;
    else members = (data ?? []) as AdminMember[];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  return <AdminMembersPage members={members} loadError={loadError} />;
}
