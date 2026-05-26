import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";

export type AppRole = "admin" | "user";

type VerifyState = "idle" | "loading" | "ready" | "invalid";

/** Load role from server so URL / localStorage tampering cannot grant admin access. */
export function useVerifiedSession() {
  const { currentUser, setCurrentUser } = useApp();
  const [state, setState] = useState<VerifyState>("idle");
  const [role, setRole] = useState<AppRole | null>(null);

  const userId = currentUser?.userId;

  useEffect(() => {
    if (!userId) {
      setState("idle");
      setRole(null);
      return;
    }

    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/session/${userId}`);
        const data = await res.json();

        if (cancelled) return;

        if (!data?.success || !data?.user) {
          setCurrentUser(null);
          setRole(null);
          setState("invalid");
          return;
        }

        const serverRole: AppRole =
          String(data.user.role || "user").toLowerCase() === "admin" ? "admin" : "user";

        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                userId: String(data.user.userId ?? prev.userId),
                role: serverRole,
                name: data.user.name ?? prev.name,
                email: data.user.email ?? prev.email,
                telegram: data.user.telegram ?? prev.telegram,
              }
            : null
        );
        setRole(serverRole);
        setState("ready");
      } catch {
        if (cancelled) return;
        setCurrentUser(null);
        setRole(null);
        setState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, setCurrentUser]);

  return {
    userId,
    role,
    state: userId ? state : "idle",
    isLoading: Boolean(userId) && state === "loading",
    isReady: state === "ready" && role != null,
    isInvalid: state === "invalid",
  };
}
