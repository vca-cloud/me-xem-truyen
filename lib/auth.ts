import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "editor" | "moderator";
export type AdminStatus = "active" | "suspended";

export type AdminProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: AdminRole;
  status: AdminStatus;
  created_at: string;
};

const ADMIN_ROLES: AdminRole[] = ["admin", "editor", "moderator"];

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/dang-nhap");

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("id, email, display_name, role, status, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    !ADMIN_ROLES.includes(profile.role as AdminRole) ||
    profile.status !== "active"
  ) {
    redirect("/admin/dang-nhap?error=unauthorized");
  }

  return { user, profile: profile as AdminProfile };
}

export async function getAdminProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("id, email, display_name, role, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Không thể tải danh sách quản trị viên: ${error.message}`);
  return (data ?? []) as AdminProfile[];
}
