import type { LucideIcon } from "lucide-react";
import { Calendar, TrendingUp, Shield, Crown, Gift } from "lucide-react";

export type SubscriptionPackage = {
  id: string;
  name: string;
  duration: string;
  originalPrice: number;
  price: number;
  icon: LucideIcon;
  description: string;
  features: string[];
  popular: boolean;
  subtitle?: string;
  /** Free trial — terms + no USDT payment */
  isTrial?: boolean;
  durationDays?: number;
  fundLockDays?: number;
  listPrice?: number;
  referralPrice?: number;
  discountedPrice?: number;
  hasDiscount?: boolean;
  discountPercent?: number;
};

export const SUBSCRIPTION_PACKAGES: SubscriptionPackage[] = [
  {
    id: "7-day-trial",
    name: "FREE 7-DAY TRIAL",
    duration: "7 Days",
    originalPrice: 0,
    price: 0,
    icon: Gift,
    description: "Try copy trading free for 7 days. Fund stays locked during the trial.",
    features: [
      "Fund locked for 7 days — stop trading allowed",
      "Withdrawals unlock when trial ends",
      "60% fee only on positive performance",
      "No positive performance = No fee",
      "Terms acceptance required before activation",
    ],
    popular: false,
    isTrial: true,
  },
  {
    id: "1-month",
    name: "1 Month Pack",
    duration: "1 Month",
    originalPrice: 300,
    price: 255,
    icon: Calendar,
    description: "Begin copy trading with essential tools and a focused portfolio.",
    features: [
      "JACKPOT ROBOT",
      "Mirror up to 2 strategies",
      "Live trade feed",
      "Wallet & transaction history",
      "Email support",
      "5 sec–1 min USDT withdrawal (after approval)",
    ],
    popular: false,
  },
  {
    id: "3-month",
    name: "3 Month Pack",
    duration: "3 Months",
    originalPrice: 900,
    price: 666,
    icon: TrendingUp,
    description: "Scale with more strategies, affiliate access, and priority sync.",
    features: [
      "JACKPOT ROBOT",
      "Mirror up to 5 strategies",
      "Priority trade sync",
      "P/L & trade history",
      "Priority support",
      "5 sec–1 min USDT withdrawal (after approval)",
    ],
    popular: false,
  },
  {
    id: "6-month",
    name: "6 Month Pack",
    duration: "6 Months",
    originalPrice: 1800,
    price: 1110,
    icon: Shield,
    description: "Higher limits, allocation controls, and daily settlement reports.",
    features: [
      "JACKPOT ROBOT",
      "Mirror up to 12 strategies",
      "Advanced allocation",
      "Daily settlement reports",
      "Withdrawal priority",
      "5 sec–1 min USDT withdrawal (after approval)",
    ],
    popular: false,
  },
  {
    id: "1-year",
    name: "1 Year Pack",
    subtitle: "JACKPOT HEDGE PORTFOLIO",
    duration: "12 Months",
    originalPrice: 10800,
    price: 2200,
    icon: Crown,
    description: "Maximum capacity, custom allocation, and white-glove onboarding.",
    features: [
      "JACKPOT ROBOT",
      "HEDGE ROBOT",
      "PORTFOLIO ROBOT",
      "High accuracy robot",
      "Less drawdown",
      "Profit factor upto 5",
      "24/7 priority support",
      "5 sec–1 min USDT withdrawal (after approval)",
    ],
    popular: true,
  },
];

export const TRIAL_TERMS = [
  "Your wallet fund remains locked for the full 7-day trial period.",
  "You can stop copy trading anytime during the trial — open P/L moves to your wallet, but withdrawal stays locked until day 7.",
  "Withdrawals unlock automatically when the trial ends (paid plans: 5 sec–1 min processing after approval).",
  "A 60% performance fee applies only on positive performance during/after the trial.",
  "If there is no positive performance, no performance fee is charged.",
  "You must accept these terms before the trial can be activated.",
];

/** Marketing USP — paid subscribers after trial. */
export const WITHDRAW_USP = {
  headline: "5 sec to 1 min withdrawals",
  short: "Paid plans: USDT (TRC20) sent within 5 seconds to 1 minute after admin approval.",
  detail:
    "Once your request is approved, outbound USDT typically hits your TRC20 wallet in 5 seconds to 1 minute — one of the fastest payout flows in copy trading.",
};

export const TRIAL_WITHDRAW_NOTICE =
  "Free trial: funds locked for 7 days (stop trading allowed). Withdrawals open when trial ends.";

export const PAID_WITHDRAW_NOTICE = WITHDRAW_USP.short;

/** Landing / contact — opens user's email client (no backend). */
export const CONTACT_EMAIL = "teaminditech1@gmail.com";

export function getPackageById(id: string) {
  return SUBSCRIPTION_PACKAGES.find((p) => p.id === id);
}

export function packageDisplayName(packageId: string, fallback?: string) {
  return getPackageById(packageId)?.name ?? fallback ?? packageId;
}

export function isTrialPackageId(id: string) {
  return id === "7-day-trial";
}
