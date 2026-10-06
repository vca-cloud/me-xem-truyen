import { AdminAdminsPage } from "@/components/admin-admins-page";
import { getAdminProfiles, type AdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminsPage() {
  let admins: AdminProfile[] = [];
  let loadError: string | null = null;
  try {
    admins = await getAdminProfiles();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Lỗi không xác định.";
  }
  const { data: { user } } = await (await createClient()).auth.getUser();
  return <AdminAdminsPage admins={admins} currentUserId={user?.id ?? null} loadError={loadError} />;
}
