import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
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

// Admins who enrolled an authenticator app must complete the 2-step code (aal2) before using the admin area.
async function needsSecondFactor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/dang-nhap");
  if (await needsSecondFactor(supabase)) redirect("/admin/xac-thuc");

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

// What each role may do in admin APIs. Database RLS still applies on top of this.
export const roleAccess = {
  view: ["admin", "editor", "moderator"],
  content: ["admin", "editor", "moderator"],
  destructive: ["admin"],
  money: ["admin"],
  admins: ["admin"],
} as const satisfies Record<string, readonly AdminRole[]>;

type GuardResult =
  | { error: NextResponse; profile?: never; supabase?: never }
  | { error?: never; profile: AdminProfile; supabase: Awaited<ReturnType<typeof createClient>> };

// For admin API routes: returns 401/403 responses instead of redirecting.
export async function guardAdminApi(allowed: readonly AdminRole[] = roleAccess.view): Promise<GuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 }) };
  if (await needsSecondFactor(supabase)) return { error: NextResponse.json({ error: "Vui lòng nhập mã xác thực 2 lớp." }, { status: 401 }) };
  const { data: profile } = await supabase.from("admin_profiles").select("id, email, display_name, role, status, created_at").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || !ADMIN_ROLES.includes(profile.role as AdminRole)) {
    return { error: NextResponse.json({ error: "Tài khoản không có quyền quản trị." }, { status: 403 }) };
  }
  if (!allowed.includes(profile.role as AdminRole)) {
    return { error: NextResponse.json({ error: "Vai trò của bạn không được phép thực hiện thao tác này." }, { status: 403 }) };
  }
  return { profile: profile as AdminProfile, supabase };
}
