import { useCallback, useEffect, useState } from "react";

export const ADMIN_USERS_FILTERS_COLLAPSED_KEY = "tradeflow.admin.users.filtersCollapsed";
export const ADMIN_USERS_FILTERS_COLLAPSED_EVENT = "tradeflow:admin-users-filters-collapsed";

export function loadAdminUsersFiltersCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_USERS_FILTERS_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminUsersFiltersCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(ADMIN_USERS_FILTERS_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent(ADMIN_USERS_FILTERS_COLLAPSED_EVENT, { detail: { collapsed } }),
  );
}

export function toggleAdminUsersFiltersCollapsed(): boolean {
  const next = !loadAdminUsersFiltersCollapsed();
  setAdminUsersFiltersCollapsed(next);
  return next;
}

export function useAdminUsersFiltersCollapsed() {
  const [collapsed, setCollapsed] = useState(loadAdminUsersFiltersCollapsed);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ collapsed?: boolean }>).detail;
      if (typeof detail?.collapsed === "boolean") {
        setCollapsed(detail.collapsed);
      } else {
        setCollapsed(loadAdminUsersFiltersCollapsed());
      }
    };
    window.addEventListener(ADMIN_USERS_FILTERS_COLLAPSED_EVENT, onChange);
    return () => window.removeEventListener(ADMIN_USERS_FILTERS_COLLAPSED_EVENT, onChange);
  }, []);

  const toggle = useCallback(() => {
    toggleAdminUsersFiltersCollapsed();
  }, []);

  return { filtersCollapsed: collapsed, toggleFiltersCollapsed: toggle };
}
