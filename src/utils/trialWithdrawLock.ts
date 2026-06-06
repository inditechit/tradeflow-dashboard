import type { SubscriptionSegment } from "@/hooks/useSubscriptionStatus";

export type PackageFundWithdrawLock = {
  locked: boolean;
  trialActive: boolean;
  unlockAt: string | null;
  daysRemaining: number;
  message: string | null;
  packageName: string | null;
};

/** Fund-lock from active subscription segment (dynamic package days from admin). */
export function getPackageFundWithdrawLock(
  isActive: boolean,
  activeSegment: SubscriptionSegment | null,
  withdrawLock?: {
    locked?: boolean;
    unlockAt?: string | null;
    daysRemaining?: number;
    packageName?: string | null;
    isTrial?: boolean;
  } | null,
): PackageFundWithdrawLock {
  const unlocked: PackageFundWithdrawLock = {
    locked: false,
    trialActive: false,
    unlockAt: null,
    daysRemaining: 0,
    message: null,
    packageName: null,
  };

  if (withdrawLock?.locked && withdrawLock.unlockAt) {
    const name = withdrawLock.packageName || "your plan";
    const days = Number(withdrawLock.daysRemaining ?? 0);
    return {
      locked: true,
      trialActive: Boolean(withdrawLock.isTrial),
      unlockAt: withdrawLock.unlockAt,
      daysRemaining: days,
      packageName: withdrawLock.packageName ?? null,
      message: withdrawLock.isTrial
        ? `Free trial — funds locked for ${days} day${days === 1 ? "" : "s"}. Stop trading anytime; withdrawal opens when the trial ends.`
        : `${name} — withdrawals locked for ${days} more day${days === 1 ? "" : "s"}.`,
    };
  }

  if (!isActive || !activeSegment?.fundLockUntil) return unlocked;

  const until = new Date(activeSegment.fundLockUntil);
  if (until.getTime() <= Date.now()) return unlocked;

  const msLeft = until.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const isTrial = Boolean(activeSegment.isTrial);
  const lockDays = activeSegment.fundLockDays ?? activeSegment.durationDays;

  return {
    locked: true,
    trialActive: isTrial,
    unlockAt: activeSegment.fundLockUntil,
    daysRemaining,
    packageName: activeSegment.packageName ?? null,
    message: isTrial
      ? `Free trial — funds locked for ${lockDays} day${lockDays === 1 ? "" : "s"}. Stop trading anytime; withdrawal opens when the trial ends.`
      : `${activeSegment.packageName} — withdrawals locked until ${until.toLocaleDateString()}.`,
  };
}

/** @deprecated use getPackageFundWithdrawLock */
export const getTrialWithdrawLock = getPackageFundWithdrawLock;
