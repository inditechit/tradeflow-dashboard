export type PermissionItem = { key: string; label: string };

export type PermissionTab = {
  tabId: string;
  label: string;
  path: string;
  tabKey: string;
  filters: PermissionItem[];
  columns: PermissionItem[];
  actions: PermissionItem[];
};

/** Path → tab permission key (sidebar / route guard). */
export const ADMIN_TAB_PATH_KEYS: Record<string, string> = {
  "/admin/dashboard": "tab:dashboard",
  "/admin/package-catalog": "tab:packages",
  "/admin/profile": "tab:profile",
  "/admin/open-trades": "tab:open_trades",
  "/admin/users": "tab:users",
  "/admin/user-map": "tab:user_map",
  "/admin/login-locations": "tab:user_map",
  "/admin/transactions": "tab:transactions",
  "/admin/recharge": "tab:recharge",
  "/admin/unmatched-payments": "tab:transactions",
  "/admin/withdrawals": "tab:withdrawals",
  "/admin/bulk-withdraw": "tab:withdrawals",
  "/admin/support-tickets": "tab:support",
  "/admin/alerts": "tab:admin_alerts",
  "/admin/notifications": "tab:notifications",
  "/admin/packages": "tab:packages",
  "/admin/coupons": "tab:coupons",
  "/admin/blogs": "tab:blogs",
  "/admin/contact-leads": "tab:contact_leads",
  "/admin/invoices": "tab:invoices",
  "/admin/maintenance": "tab:maintenance",
  "/admin/affiliate-rules": "tab:affiliate_rules",
  "/admin/referrals": "tab:referrals",
  "/admin/wallet-ledger": "tab:wallet_ledger",
  "/admin/financial-stats": "tab:financial_stats",
  "/admin/referral-payable": "tab:financial_stats",
  "/admin/user-pnl-report": "tab:user_pnl_report",
  "/admin/wallet-rebuild-doc": "tab:financial_stats",
  "/admin/employees": "tab:employees",
};

export function tabKeyForPath(path: string): string | null {
  if (ADMIN_TAB_PATH_KEYS[path]) return ADMIN_TAB_PATH_KEYS[path];
  if (path.startsWith("/admin/users/") && path.endsWith("/trades")) return "tab:users";
  if (path.startsWith("/admin/user-profile/")) return "tab:users";
  return null;
}

/** Sidebar order — used for employee default landing. */
export const ADMIN_MENU_PATHS = [
  "/admin/dashboard",
  "/admin/package-catalog",
  "/admin/profile",
  "/admin/open-trades",
  "/admin/users",
  "/admin/user-map",
  "/admin/login-locations",
  "/admin/transactions",
  "/admin/recharge",
  "/admin/unmatched-payments",
  "/admin/withdrawals",
  "/admin/bulk-withdraw",
  "/admin/support-tickets",
  "/admin/alerts",
  "/admin/notifications",
  "/admin/packages",
  "/admin/coupons",
  "/admin/blogs",
  "/admin/contact-leads",
  "/admin/invoices",
  "/admin/maintenance",
  "/admin/affiliate-rules",
  "/admin/referrals",
  "/admin/wallet-ledger",
  "/admin/financial-stats",
  "/admin/referral-payable",
  "/admin/user-pnl-report",
  "/admin/wallet-rebuild-doc",
];

export function firstAllowedEmployeePath(
  permissions: string[],
  isAdmin: boolean,
): string {
  if (isAdmin) return "/admin/dashboard";
  for (const path of ADMIN_MENU_PATHS) {
    const key = tabKeyForPath(path);
    if (key && permissions.includes(key)) return path;
  }
  return "/admin/dashboard";
}

/** @deprecated use firstAllowedEmployeePath */
export const firstAllowedStaffPath = firstAllowedEmployeePath;
