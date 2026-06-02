import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

type MaintenanceState = {
  loading: boolean;
  underMaintenance: boolean;
  message: string;
  refresh: () => Promise<void>;
};

export function useMaintenanceStatus(userId: string | number | undefined): MaintenanceState {
  const [loading, setLoading] = useState(true);
  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      setLoading(false);
      setUnderMaintenance(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/user/maintenance/${uid}`);
      const data = await res.json();
      if (data?.success) {
        setUnderMaintenance(Boolean(data.underMaintenance));
        setMessage(String(data.message || ""));
      }
    } catch {
      // keep previous state on network blip
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { loading, underMaintenance, message, refresh };
}
