import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Only use it in server code AFTER checking who the caller is and what they may do.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên máy chủ.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serviceRoleReady() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
