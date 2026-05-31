/** Platform end-user (copy trader), not staff admin account. */
export function isAdminRoleUser(u: { role?: string | null } | null | undefined): boolean {
  return String(u?.role ?? "").toLowerCase() === "admin";
}

export function isEndUser(u: { role?: string | null } | null | undefined): boolean {
  return !isAdminRoleUser(u);
}
