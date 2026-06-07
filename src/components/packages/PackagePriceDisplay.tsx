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
  >;
  size?: "sm" | "lg";
};

/** Original → discounted list → after-referral (when set or active). */
export function PackagePriceDisplay({ pkg, size = "lg" }: PackagePriceDisplayProps) {
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
  const referral = Number(pkg.referralPrice ?? 0);
  const hasReferralPrice = referral > 0 && referral < list;
  const payingReferral = Boolean(pkg.hasDiscount && hasReferralPrice);
  const mainPrice = payingReferral ? referral : list;

  const mainClass =
    size === "lg" ? "text-4xl font-extrabold text-slate-900" : "text-2xl font-extrabold text-slate-900";
  const midClass =
    size === "lg"
      ? "text-lg font-semibold text-slate-500 line-through"
      : "text-sm font-semibold text-slate-500 line-through";
  const origClass =
    size === "lg"
      ? "text-sm font-medium text-slate-400 line-through"
      : "text-xs font-medium text-slate-400 line-through";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={mainClass}>${mainPrice}</span>
        {payingReferral ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            Referral price
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
        {original > list ? (
          <span className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Original</span>
            <span className={origClass}>${original}</span>
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Discounted</span>
          <span className={payingReferral ? midClass : "font-bold text-slate-700"}>${list}</span>
        </span>
        {hasReferralPrice ? (
          <span className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Referral</span>
            <span className={payingReferral ? "font-bold text-emerald-700" : "font-semibold text-emerald-600"}>
              ${referral}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
