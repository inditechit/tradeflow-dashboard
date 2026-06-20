import { hasUserImageData } from "@/utils/userImageUrl";

/** Profile shape from GET /api/user/profile/:id */
export type ProfileForCompletion = Record<string, unknown> | null;

function filled(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  return true;
}

function hasDocPhoto(raw: unknown): boolean {
  return hasUserImageData(raw);
}

/**
 * Simple 0–100% completion for onboarding display.
 * Weights: identity, contact, location, payout, KYC docs.
 */
export function computeProfileCompletionPercent(profile: ProfileForCompletion): number {
  if (!profile) return 0;

  const checks = [
    filled(profile.name),
    filled(profile.email),
    filled(profile.telegram),
    filled(profile.mobile),
    filled(profile.country) && filled(profile.city),
    filled(profile.trc20WithdrawAddress),
    hasDocPhoto(profile.livePhotoData),
    hasDocPhoto(profile.idProofData),
    hasDocPhoto(profile.addressProofData),
  ];

  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
