import type { LucideIcon } from "lucide-react";
import { Calendar, Crown, Gift, Package, Shield, TrendingUp } from "lucide-react";
import type { SubscriptionPackage } from "@/constants/packages";

export type ApiPackage = {
  id: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  duration_days: number;
  fund_lock_days: number;
  price_usd: number;
  original_price_usd?: number | null;
  referral_price_usd?: number | null;
  discounted_price_usd?: number;
  discount_amount_usd?: number;
  discount_percent?: number;
  has_discount?: boolean;
  is_trial: boolean;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  features: string[];
  coupon_code?: string | null;
  coupon_name?: string | null;
};

export const PACKAGE_ICONS: Record<string, LucideIcon> = {
  "7-day-trial": Gift,
  "1-month": Calendar,
  "3-month": TrendingUp,
  "6-month": Shield,
  "1-year": Crown,
};

export function formatPackageDuration(days: number) {
  if (days === 7) return "7 Days";
  if (days === 30) return "1 Month";
  if (days === 90) return "3 Months";
  if (days === 180) return "6 Months";
  if (days === 365) return "12 Months";
  return `${days} Days`;
}

export function fundLockNotice(days: number) {
  return `Funds locked for ${days} day${days === 1 ? "" : "s"} (stop trading allowed). Withdrawals open when the lock period ends.`;
}

export function apiPackageToUi(p: ApiPackage): SubscriptionPackage {
  const Icon = PACKAGE_ICONS[p.id] ?? Package;
  const lockDays = p.is_trial ? p.duration_days : p.fund_lock_days;
  const features = [...(p.features || [])];
  if (p.is_trial && lockDays > 0 && !features.some((f) => f.toLowerCase().includes("locked"))) {
    features.unshift(`Fund locked for ${lockDays} day${lockDays === 1 ? "" : "s"} — stop trading allowed`);
  }
  return {
    id: p.id,
    name: p.name,
    duration: formatPackageDuration(p.duration_days),
    originalPrice: Number(p.original_price_usd ?? p.price_usd),
    price: Number(p.has_discount ? p.discounted_price_usd : p.price_usd),
    listPrice: Number(p.price_usd),
    referralPrice:
      p.referral_price_usd != null ? Number(p.referral_price_usd) : undefined,
    discountedPrice: Number(p.discounted_price_usd ?? p.price_usd),
    hasDiscount: Boolean(p.has_discount),
    discountPercent: Number(p.discount_percent ?? 0),
    listDiscountPercent:
      Number(p.original_price_usd ?? p.price_usd) > Number(p.price_usd)
        ? Math.round(
            ((Number(p.original_price_usd ?? p.price_usd) - Number(p.price_usd)) /
              Number(p.original_price_usd ?? p.price_usd)) *
              100,
          )
        : 0,
    couponCode: p.coupon_code ?? null,
    icon: Icon,
    description: p.description || "",
    features,
    popular: p.is_popular,
    subtitle: p.subtitle ?? undefined,
    isTrial: p.is_trial,
    durationDays: p.duration_days,
    fundLockDays: lockDays,
  };
}
