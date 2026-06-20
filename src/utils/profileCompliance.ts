import { hasUserImageData } from "@/utils/userImageUrl";

export type ProfileRecord = Record<string, unknown>;

function filled(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  return true;
}

function hasLivePhoto(profile: ProfileRecord): boolean {
  return hasUserImageData(profile.livePhotoData);
}

function hasLocation(profile: ProfileRecord): boolean {
  const lat = profile.latitude;
  const lng = profile.longitude;
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

/**
 * Active subscribers must satisfy this before full app access (incl. Google-only signups).
 */
export function isProfileComplianceComplete(profile: ProfileRecord | null): boolean {
  if (!profile) return false;
  return (
    filled(profile.name) &&
    filled(profile.email) &&
    filled(profile.mobile) &&
    filled(profile.telegram) &&
    filled(profile.trc20WithdrawAddress) &&
    hasLivePhoto(profile) &&
    hasLocation(profile)
  );
}
