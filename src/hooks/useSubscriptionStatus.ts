import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { SUBSCRIPTION_REFRESH_EVENT } from "@/utils/subscriptionEvents";
import { API_BASE } from "@/config/api";

export type SubscriptionSegment = {
  paymentId: number;
  packageId: string;
  packageName: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  durationDays: number;
};

export type RestrictionReason = "none" | "no_package" | "expired";

export type SubscriptionStatus = {
  loading: boolean;
  /** True only after a successful /user/subscription response (avoids locking on network errors). */
  fetchOk: boolean;
  hasSubscription: boolean;
  isActive: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  segments: SubscriptionSegment[];
  activeSegment: SubscriptionSegment | null;
  /** No active plan (never bought, or stacked period ended) — full app gated except dashboard + withdraw + onboarding. */
  accessRestricted: boolean;
  restrictionReason: RestrictionReason;
  refetch: () => void;
};

const EMPTY: Omit<SubscriptionStatus, "loading" | "refetch" | "accessRestricted" | "restrictionReason"> = {
  fetchOk: false,
  hasSubscription: false,
  isActive: false,
  isExpired: false,
  expiresAt: null,
  segments: [],
  activeSegment: null,
};

export function useSubscriptionStatus(): SubscriptionStatus {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY);

  const fetchStatus = useCallback(async () => {
    const userId = currentUser?.userId;
    if (!userId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/subscription/${userId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setData(EMPTY);
        return;
      }
      setData({
        fetchOk: true,
        hasSubscription: Boolean(json.hasSubscription),
        isActive: Boolean(json.isActive),
        isExpired: Boolean(json.isExpired),
        expiresAt: json.expiresAt ?? null,
        segments: Array.isArray(json.segments) ? json.segments : [],
        activeSegment: json.activeSegment ?? null,
      });
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const onFocus = () => fetchStatus();
    const onRefresh = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    window.addEventListener(SUBSCRIPTION_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SUBSCRIPTION_REFRESH_EVENT, onRefresh);
    };
  }, [fetchStatus]);

  const accessRestricted =
    !loading && data.fetchOk && !data.isActive;
  const restrictionReason: RestrictionReason = !accessRestricted
    ? "none"
    : data.isExpired
      ? "expired"
      : "no_package";

  return {
    loading,
    ...data,
    accessRestricted,
    restrictionReason,
    refetch: fetchStatus,
  };
}
