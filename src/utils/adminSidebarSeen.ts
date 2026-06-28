const USERS_SEEN_KEY = "admin_users_seen_at";

export function getAdminUsersSeenAt(): string | null {
  try {
    return window.localStorage.getItem(USERS_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markAdminUsersSeen(): void {
  try {
    window.localStorage.setItem(USERS_SEEN_KEY, new Date().toISOString());
    window.dispatchEvent(new Event("admin-sidebar-badges-refresh"));
  } catch {
    // ignore
  }
}

export type AdminSidebarBadgeKey =
  | "new_users"
  | "support_needs_reply"
  | "unread_alerts"
  | "pending_withdrawals"
  | "pending_recharges"
  | "unmatched_payments";

export type AdminSidebarBadges = Record<AdminSidebarBadgeKey, number>;

export const EMPTY_ADMIN_SIDEBAR_BADGES: AdminSidebarBadges = {
  new_users: 0,
  support_needs_reply: 0,
  unread_alerts: 0,
  pending_withdrawals: 0,
  pending_recharges: 0,
  unmatched_payments: 0,
};
