/** Keep in sync with mt5-backend/utils/subscription.js */
export const PACKAGE_DURATION_DAYS: Record<string, number> = {
  "7-day-trial": 7,
  "1-month": 30,
  "3-month": 90,
  "6-month": 180,
  "1-year": 365,
};

export function isSubscriptionPackageId(packageId: string | null | undefined) {
  return Boolean(
    packageId && packageId !== "recharge" && packageId in PACKAGE_DURATION_DAYS,
  );
}
