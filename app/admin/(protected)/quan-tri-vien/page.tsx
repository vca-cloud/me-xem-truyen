import { AdminResourcePage } from "@/components/admin-resource-page";
import { getAdminProfiles } from "@/lib/auth";

export default async function AdminsPage() {
  const admins = await getAdminProfiles();
  return <AdminResourcePage type="admins" initialAdmins={admins} />;
}
