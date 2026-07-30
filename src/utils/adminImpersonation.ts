import type { UserData } from "@/context/AppContext";
import { persistUser, loadStoredUser } from "@/utils/authSession";

/** Snapshot of the admin session while viewing as a user. */
export const ADMIN_IMPERSONATION_BACKUP_KEY = "mt5_admin_impersonation_backup";
export const ADMIN_IMPERSONATING_FLAG_KEY = "mt5_admin_impersonating";

export function isAdminImpersonating(): boolean {
  try {
    return window.sessionStorage.getItem(ADMIN_IMPERSONATING_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function loadAdminImpersonationBackup(): UserData | null {
  try {
    const raw = window.sessionStorage.getItem(ADMIN_IMPERSONATION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserData;
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAdminImpersonation(): void {
  try {
    window.sessionStorage.removeItem(ADMIN_IMPERSONATION_BACKUP_KEY);
    window.sessionStorage.removeItem(ADMIN_IMPERSONATING_FLAG_KEY);
  } catch {
    // ignore
  }
}

/**
 * Stash the current admin session and switch local auth to the target user.
 * Does not touch the user's stored location on the server.
 */
export function beginAdminImpersonation(adminUser: UserData, targetUser: UserData): UserData {
  if (!adminUser?.userId || !targetUser?.userId) {
    throw new Error("Admin and target user are required");
  }
  const { password: _a, ...adminSafe } = adminUser;
  const { password: _t, ...targetSafe } = targetUser;
  const impersonated: UserData = {
    ...targetSafe,
    role: "user",
    employeePermissions: undefined,
  };
  window.sessionStorage.setItem(ADMIN_IMPERSONATION_BACKUP_KEY, JSON.stringify(adminSafe));
  window.sessionStorage.setItem(ADMIN_IMPERSONATING_FLAG_KEY, "1");
  persistUser(impersonated);
  return impersonated;
}

/** Restore the stashed admin session. Returns null if nothing to restore. */
export function endAdminImpersonation(): UserData | null {
  const backup = loadAdminImpersonationBackup();
  clearAdminImpersonation();
  if (!backup?.userId) {
    persistUser(null);
    return null;
  }
  persistUser(backup);
  return backup;
}

/** Current session user if present (for callers that need a sync read). */
export function peekStoredUser(): UserData | null {
  return loadStoredUser();
}
