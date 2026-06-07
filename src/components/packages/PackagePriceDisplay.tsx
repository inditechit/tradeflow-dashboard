import type { SubscriptionPackage } from "@/constants/packages";

type PackagePriceDisplayProps = {
  pkg: Pick<
    SubscriptionPackage,
    "isTrial" | "originalPrice" | "listPrice" | "price" | "discountedPrice" | "hasDiscount" | "discountPercent"
  >;
  size?: "sm" | "lg";
};

/** Shows original → list (discounted) → referral/coupon price when applicable. */
export function PackagePriceDisplay({ pkg, size = "lg" }: PackagePriceDisplayProps) {
  if (pkg.isTrial) {
    return (
      <span className={size === "lg" ? "text-4xl font-extrabold text-emerald-600" : "text-2xl font-extrabold text-emerald-600"}>
        FREE
      </span>
    );
  }

  const original = Number(pkg.originalPrice ?? 0);
  const list = Number(pkg.listPrice ?? pkg.price ?? 0);
  const final = Number(pkg.hasDiscount ? pkg.discountedPrice : list);
  const showListStrike = original > list;
  const showReferral = Boolean(pkg.hasDiscount && final < list);

  const mainClass = size === "lg" ? "text-4xl font-extrabold text-slate-900" : "text-2xl font-extrabold text-slate-900";
  const strikeClass = size === "lg" ? "text-sm font-medium text-slate-400 line-through" : "text-xs font-medium text-slate-400 line-through";

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={mainClass}>${final}</span>
      {showReferral ? (
        <>
          <span className={size === "lg" ? "text-lg font-medium text-slate-500 line-through" : "text-sm font-medium text-slate-500 line-through"}>
            ${list}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            Referral −{pkg.discountPercent ?? 0}%
          </span>
        </>
      ) : null}
      {showListStrike ? (
        <span className={strikeClass}>${original}</span>
      ) : null}
      {!showReferral && showListStrike ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          Save ${Math.round(original - list)}
        </span>
      ) : null}
    </div>
  );
}
