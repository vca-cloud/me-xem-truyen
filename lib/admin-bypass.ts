// Dev-only: skip the admin login screen when running `next dev` with ADMIN_AUTH_BYPASS=true.
// Never active in production builds. Admin API routes still require a real session.
export const adminAuthBypass =
  process.env.NODE_ENV === "development" && process.env.ADMIN_AUTH_BYPASS === "true";
