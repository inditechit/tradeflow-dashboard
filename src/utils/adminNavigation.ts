/** Query param carrying the admin list URL to restore when leaving a detail page. */
export const ADMIN_RETURN_PARAM = "return";

const ADMIN_PATH_PREFIX = "/admin";

function isSafeAdminReturnPath(path: string): boolean {
  const trimmed = String(path || "").trim();
  if (!trimmed.startsWith(ADMIN_PATH_PREFIX)) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("://")) return false;
  return true;
}

/** Current pathname + search (e.g. `/admin/users?status=pending&page=2`). */
export function currentAdminReturnPath(): string {
  if (typeof window === "undefined") return "/admin/users";
  return `${window.location.pathname}${window.location.search}`;
}

/** Append `return` so detail pages can navigate back to the originating list view. */
export function withAdminReturn(path: string, returnPath?: string): string {
  const base = String(path || "").trim();
  if (!base) return base;
  const ret = (returnPath ?? currentAdminReturnPath()).trim();
  if (!isSafeAdminReturnPath(ret)) return base;
  if (ret === base) return base;

  const qIndex = base.indexOf("?");
  const pathname = qIndex >= 0 ? base.slice(0, qIndex) : base;
  const search = qIndex >= 0 ? base.slice(qIndex + 1) : "";
  const params = new URLSearchParams(search);
  params.set(ADMIN_RETURN_PARAM, ret);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function resolveAdminBackTarget(
  returnParam: string | null | undefined,
  fallback = "/admin/users",
): string {
  if (!returnParam) return fallback;
  try {
    const decoded = decodeURIComponent(returnParam);
    if (isSafeAdminReturnPath(decoded)) return decoded;
  } catch {
    /* ignore */
  }
  return fallback;
}
