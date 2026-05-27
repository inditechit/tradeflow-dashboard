import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { SUBSCRIPTION_REFRESH_EVENT } from "@/utils/subscriptionEvents";

const API_BASE = "https://api.copytradeengine.org/api";

export type SubscriptionSegment = {
  paymentId: number;
  packageId: string;
  packageName: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  durationDays: number;
};

export type SubscriptionStatus = {
  loading: boolean;
  hasSubscription: boolean;
  isActive: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  segments: SubscriptionSegment[];
  activeSegment: SubscriptionSegment | null;
  refetch: () => void;
};

const EMPTY: Omit<SubscriptionStatus, "loading" | "refetch"> = {
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

  return { loading, ...data, refetch: fetchStatus };
}
