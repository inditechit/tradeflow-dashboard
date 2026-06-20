import { firstAllowedEmployeePath } from "@/config/employeePermissionCatalog";

export type EmployeeExploreMode = "user" | "employee";

const STORAGE_PREFIX = "mt5_employee_explore_";

export function getEmployeeExploreMode(userId: string | number | undefined | null): EmployeeExploreMode | null {
  if (userId == null || userId === "") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw === "user" || raw === "employee") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function setEmployeeExploreMode(userId: string | number, mode: EmployeeExploreMode): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, mode);
  } catch {
    /* ignore */
  }
}

export function clearEmployeeExploreMode(userId?: string | number | null): void {
  try {
    if (userId != null && userId !== "") {
      localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
      return;
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/** Where to send an employee after login or when mode is unset. */
export function resolveEmployeeLandingPath(
  userId: string | number,
  permissions: string[] = [],
): string {
  const mode = getEmployeeExploreMode(userId);
  if (!mode) return "/choose-experience";
  if (mode === "user") return "/user/dashboard";
  return firstAllowedEmployeePath(permissions, false);
}

export function employeeHomeForMode(
  mode: EmployeeExploreMode,
  permissions: string[] = [],
): string {
  if (mode === "user") return "/user/dashboard";
  return firstAllowedEmployeePath(permissions, false);
}
