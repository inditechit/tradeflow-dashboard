import type { SubscriptionPackage } from "@/constants/packages";

type PackagePriceDisplayProps = {
  pkg: Pick<
    SubscriptionPackage,
    | "isTrial"
    | "originalPrice"
    | "listPrice"
    | "referralPrice"
    | "price"
    | "discountedPrice"
    | "hasDiscount"
    | "discountPercent"
    | "listDiscountPercent"
  >;
  referralApplied?: boolean;
  couponApplied?: boolean;
  size?: "sm" | "lg";
};

function pctBadge(label: string, pct: number, variant: "slate" | "emerald" | "yellow") {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    yellow: "bg-yellow-100 text-yellow-900",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${colors[variant]}`}>
      {label} −{pct}%
    </span>
  );
}

/** Original + discounted by default; referral/coupon price only when applied. */
export function PackagePriceDisplay({
  pkg,
  referralApplied = false,
  couponApplied = false,
  size = "lg",
}: PackagePriceDisplayProps) {
  if (pkg.isTrial) {
    return (
      <span
        className={
          size === "lg"
            ? "text-4xl font-extrabold text-emerald-600"
            : "text-2xl font-extrabold text-emerald-600"
        }
      >
        FREE
      </span>
    );
  }

  const original = Number(pkg.originalPrice ?? 0);
  const list = Number(pkg.listPrice ?? pkg.price ?? 0);
  const final = Number(
    pkg.hasDiscount ? (pkg.discountedPrice ?? pkg.price) : list,
  );
  const listDiscountPct =
    pkg.listDiscountPercent ??
    (original > list ? Math.round(((original - list) / original) * 100) : 0);
  const extraDiscountPct =
    pkg.hasDiscount && final < list
      ? Number(pkg.discountPercent ?? Math.round(((list - final) / list) * 100))
      : 0;

  const mainClass =
    size === "lg" ? "text-4xl font-extrabold text-slate-900" : "text-2xl font-extrabold text-slate-900";
  const strikeClass =
    size === "lg"
      ? "text-lg font-medium text-slate-400 line-through"
      : "text-sm font-medium text-slate-400 line-through";

  const showSpecialPrice = pkg.hasDiscount && final < list;

  if (!showSpecialPrice) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={mainClass}>${list}</span>
          {original > list ? <span className={strikeClass}>${original}</span> : null}
        </div>
        {listDiscountPct > 0 ? (
          <div>{pctBadge("You save", listDiscountPct, "yellow")}</div>
        ) : null}
      </div>
    );
  }

  const specialLabel = referralApplied ? "Referral" : couponApplied ? "Coupon" : "Special";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={mainClass}>${final}</span>
        {extraDiscountPct > 0
          ? pctBadge(specialLabel, extraDiscountPct, referralApplied ? "emerald" : "yellow")
          : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {original > list ? (
          <>
            <span className={strikeClass}>${original}</span>
            {listDiscountPct > 0 ? (
              <span className="text-[10px] font-semibold text-slate-400">−{listDiscountPct}% MRP</span>
            ) : null}
          </>
        ) : null}
        <span className={strikeClass}>${list}</span>
      </div>
    </div>
  );
}
