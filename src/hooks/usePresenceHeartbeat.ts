import { useEffect, useRef } from "react";

/**
 * Pings the backend every `intervalMs` while the tab is visible so the
 * server can mark the current user as "live". Also fires immediately on
 * mount and whenever the tab regains focus, so admins see the user
 * appear online without waiting for the next tick.
 *
 * Backend contract: POST /api/user/heartbeat/:userId  -> { success: true }
 *
 * Definition of "live" lives on the server (default: seen within the
 * last 90s). 30s intervals comfortably stay inside that window even
 * if one ping is dropped.
 */
export function usePresenceHeartbeat(
  userId: string | number | undefined | null,
  apiBase: string,
  intervalMs: number = 30_000,
  /** When false, no pings (e.g. admin staff accounts). */
  enabled: boolean = true,
) {
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !userId) return;
    const idNum = Number(userId);
    if (!Number.isFinite(idNum) || idNum <= 0) return;

    let cancelled = false;
    let timer: number | undefined;

    const ping = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await fetch(`${apiBase}/user/heartbeat/${idNum}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // No body needed — the user id is in the path.
          keepalive: true,
        });
      } catch {
        // Best-effort; ignore network errors.
      } finally {
        inFlight.current = false;
      }
    };

    ping();
    timer = window.setInterval(ping, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, apiBase, intervalMs, enabled]);
}
