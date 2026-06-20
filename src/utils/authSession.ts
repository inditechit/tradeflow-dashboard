import type { UserData } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
export type AppRole = "admin" | "user" | "employee";

export const SESSION_STORAGE_KEY = "mt5_user";

export function loadStoredUser(): UserData | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserData;
    if (!parsed?.userId) return null;
    const { password: _pw, ...safe } = parsed;
    return safe;
  } catch {
    return null;
  }
}

export function persistUser(user: UserData | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  const { password: _pw, ...safe } = user;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safe));
}

export function clearAuthStorage(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem("mt5_packages");
}

function toAppRole(role: unknown): AppRole {
  const r = String(role || "user").toLowerCase();
  if (r === "admin") return "admin";
  if (r === "employee") return "employee";
  return "user";
}

function mergeServerUser(cached: UserData | null, data: Record<string, unknown>): UserData {
  const userObj = (data.user as Record<string, unknown> | undefined) ?? data;
  const role = toAppRole(userObj.role ?? data.role);
  const perms = Array.isArray(userObj.employeePermissions)
    ? (userObj.employeePermissions as string[])
    : Array.isArray(data.employeePermissions)
      ? (data.employeePermissions as string[])
      : cached?.employeePermissions;
  return {
    ...cached,
    userId: String(userObj.userId ?? data.userId ?? cached?.userId ?? ""),
    role,
    employeePermissions: role === "employee" ? perms ?? [] : undefined,
    name: (userObj.name as string | undefined) ?? (data.name as string | undefined) ?? cached?.name,
    email: (userObj.email as string | undefined) ?? (data.email as string | undefined) ?? cached?.email,
    telegram: (userObj.telegram as string | undefined) ?? (data.telegram as string | undefined) ?? cached?.telegram,
    createdAt: userObj.created_at
      ? String(userObj.created_at)
      : data.created_at
        ? String(data.created_at)
        : cached?.createdAt,
  };
}

export type SessionVerifyResult =
  | { status: "valid"; user: UserData }
  | { status: "offline"; user: UserData }
  | { status: "invalid" };

/** Confirm session with API; keep cached session if the network is down. */
export async function verifySession(
  userId: string,
  cached: UserData | null
): Promise<SessionVerifyResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/session/${userId}`);
    if (res.status === 404 || res.status === 403) {
      return { status: "invalid" };
    }

    const data = await res.json().catch(() => null);

    if (data?.success && data?.user) {
      return {
        status: "valid",
        user: mergeServerUser(cached, data.user),
      };
    }

    if (cached?.userId) {
      return { status: "offline", user: cached };
    }
    return { status: "invalid" };
  } catch {
    if (cached?.userId) {
      return { status: "offline", user: cached };
    }
    return { status: "invalid" };
  }
}
