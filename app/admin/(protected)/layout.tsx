import { AdminShell } from "@/components/admin-shell";
import { adminAuthBypass } from "@/lib/admin-bypass";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!adminAuthBypass) await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
