import React from "react";
import { cn } from "@/lib/utils";
import { getReferrerTier, type ReferrerTier } from "@/utils/referrerTier";

type ReferrerTierBadgeProps = {
  count: number;
  size?: "sm" | "md";
  showCount?: boolean;
  className?: string;
};

const ReferrerTierBadge: React.FC<ReferrerTierBadgeProps> = ({
  count,
  size = "sm",
  showCount = false,
  className,
}) => {
  const tier = getReferrerTier(count);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border font-bold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        tier.badgeClass,
        className,
      )}
      title={`${tier.label} tier · ${count} direct referral${count === 1 ? "" : "s"}`}
    >
      <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tier.dotClass)} />
      {tier.label}
      {showCount && <span className="font-semibold opacity-90">· {count}</span>}
    </span>
  );
};

export function ReferrerTierLegend({ className }: { className?: string }) {
  const tiers: ReferrerTier[] = [
    getReferrerTier(50),
    getReferrerTier(100),
    getReferrerTier(500),
    getReferrerTier(2000),
    getReferrerTier(5000),
    getReferrerTier(10000),
  ];

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tiers.map((tier) => (
        <ReferrerTierBadge key={tier.id} count={tier.min} size="sm" />
      ))}
    </div>
  );
}

export default ReferrerTierBadge;
