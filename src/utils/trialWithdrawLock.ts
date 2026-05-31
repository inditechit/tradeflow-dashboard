import type { SubscriptionSegment } from "@/hooks/useSubscriptionStatus";
import { TRIAL_WITHDRAW_NOTICE } from "@/constants/packages";

export type TrialWithdrawLock = {
  locked: boolean;
  trialActive: boolean;
  unlockAt: string | null;
  daysRemaining: number;
  message: string | null;
};

/** Client-side trial fund lock — uses existing /user/subscription data only. */
export function getTrialWithdrawLock(
  isActive: boolean,
  activeSegment: SubscriptionSegment | null,
): TrialWithdrawLock {
  if (!isActive || !activeSegment || activeSegment.packageId !== "7-day-trial") {
    return {
      locked: false,
      trialActive: false,
      unlockAt: null,
      daysRemaining: 0,
      message: null,
    };
  }

  const end = new Date(activeSegment.periodEnd);
  const msLeft = end.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return {
    locked: true,
    trialActive: true,
    unlockAt: activeSegment.periodEnd,
    daysRemaining,
    message: `${TRIAL_WITHDRAW_NOTICE} You can stop trading anytime; withdrawal opens when the trial ends.`,
  };
}
