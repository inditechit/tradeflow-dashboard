import { API_BASE } from "@/config/api";
import { isAdminImpersonating } from "@/utils/adminImpersonation";
import { getGeolocationIfAllowed } from "@/utils/devicePermissions";

type ReportOpts = {
  userId: string | number;
  loginMethod: "password" | "google";
};

/**
 * Fire-and-forget login location log. Never blocks navigation.
 * Writes a row even when GPS is denied / unavailable.
 * Only prompts the browser when location permission has not been decided yet.
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

  void getGeolocationIfAllowed({
    // Login is an intentional moment to ask once if not yet decided.
    allowPrompt: true,
    enableHighAccuracy: false,
    timeout: 10_000,
    maximumAge: 300_000,
  }).then((result) => {
    if (result.ok) {
      post({
        locationAvailable: true,
        lat: result.lat,
        lng: result.lng,
      });
    } else {
      post({ locationAvailable: false });
    }
  });
}
