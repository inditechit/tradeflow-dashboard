import { API_BASE } from "@/config/api";

export type SubscriptionStatus = {
  hasSubscription: boolean;
  isActive: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  adminOverrideExpiresAt?: string | null;
  hasAdminOverride?: boolean;
  activeSegment?: {
    packageId: string;
    packageName: string;
    periodEnd: string;
  } | null;
};

export async function fetchUserSubscription(userId: number): Promise<SubscriptionStatus> {
  const res = await fetch(`${API_BASE}/user/subscription/${userId}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load subscription");
  }
  return {
    hasSubscription: Boolean(data.hasSubscription),
    isActive: Boolean(data.isActive),
    isExpired: Boolean(data.isExpired),
    expiresAt: data.expiresAt ?? null,
    adminOverrideExpiresAt: data.adminOverrideExpiresAt ?? null,
    hasAdminOverride: Boolean(data.hasAdminOverride),
    activeSegment: data.activeSegment ?? null,
  };
}

export async function extendUserSubscription(
  userId: number,
  extendDays: number,
): Promise<{ subscription_expires_override: string }> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/subscription`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extendDays }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to extend package");
  }
  return { subscription_expires_override: data.subscription_expires_override };
}
