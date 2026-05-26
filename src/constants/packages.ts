import { Calendar, TrendingUp, Shield, Crown } from "lucide-react";

export const SUBSCRIPTION_PACKAGES = [
  {
    id: "1-month",
    name: "1 Month Pack",
    price: 255,
    icon: Calendar,
  },
  {
    id: "3-month",
    name: "3 Month Pack",
    price: 666,
    icon: TrendingUp,
  },
  {
    id: "6-month",
    name: "6 Month Pack",
    price: 1110,
    icon: Shield,
  },
  {
    id: "1-year",
    name: "1 Year Pack",
    price: 2200,
    icon: Crown,
  },
] as const;

export function getPackageById(id: string) {
  return SUBSCRIPTION_PACKAGES.find((p) => p.id === id);
}

export function packageDisplayName(packageId: string, fallback?: string) {
  return getPackageById(packageId)?.name ?? fallback ?? packageId;
}
