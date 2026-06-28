import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";
import {
  EMPTY_ADMIN_SIDEBAR_BADGES,
  getAdminUsersSeenAt,
  type AdminSidebarBadges,
} from "@/utils/adminSidebarSeen";

export function useAdminSidebarBadges(pollMs = 30_000) {
  const [badges, setBadges] = useState<AdminSidebarBadges>(EMPTY_ADMIN_SIDEBAR_BADGES);

  const refresh = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      const seenAt = getAdminUsersSeenAt();
      if (seenAt) qs.set("users_since", seenAt);
      const res = await fetch(`${API_BASE}/admin/sidebar-badges?${qs.toString()}`);
      const data = await res.json();
      if (data?.success && data.badges) {
        setBadges({ ...EMPTY_ADMIN_SIDEBAR_BADGES, ...data.badges });
      }
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    const onRefresh = () => void refresh();
    window.addEventListener("admin-sidebar-badges-refresh", onRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("admin-sidebar-badges-refresh", onRefresh);
    };
  }, [refresh, pollMs]);

  return { badges, refresh };
}
