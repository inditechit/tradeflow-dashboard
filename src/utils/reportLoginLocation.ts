import { API_BASE } from "@/config/api";
import { isAdminImpersonating } from "@/utils/adminImpersonation";

type ReportOpts = {
  userId: string | number;
  loginMethod: "password" | "google";
};

/**
 * Fire-and-forget login location log. Never blocks navigation.
 * Writes a row even when GPS is denied / unavailable.
 */
export function reportLoginLocation({ userId, loginMethod }: ReportOpts): void {
  const uid = Number(userId);
  if (!(uid > 0)) return;
  if (isAdminImpersonating()) return;

  const post = (body: Record<string, unknown>) => {
    void fetch(`${API_BASE}/user/login-location-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: uid,
        loginMethod,
        skipLocationUpdate: isAdminImpersonating(),
        impersonating: isAdminImpersonating(),
        ...body,
      }),
    }).catch(() => {});
  };

  if (!navigator.geolocation) {
    post({ locationAvailable: false });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      post({
        locationAvailable: true,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    },
    () => {
      post({ locationAvailable: false });
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}
