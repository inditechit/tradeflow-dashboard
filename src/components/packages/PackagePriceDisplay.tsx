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

/** Original + discounted by default; after-referral only when referral/coupon is active. */
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
  const referral = Number(pkg.referralPrice ?? pkg.discountedPrice ?? 0);
  const referralActive = Boolean(pkg.hasDiscount && referral > 0 && referral < list);

  const mainClass =
    size === "lg" ? "text-4xl font-extrabold text-slate-900" : "text-2xl font-extrabold text-slate-900";
  const strikeClass =
    size === "lg"
      ? "text-lg font-medium text-slate-400 line-through"
      : "text-sm font-medium text-slate-400 line-through";

  if (!referralActive) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={mainClass}>${list}</span>
        {original > list ? <span className={strikeClass}>${original}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={mainClass}>${referral}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
          Referral price
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
        {original > list ? (
          <span className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Original</span>
            <span className={strikeClass}>${original}</span>
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Discounted</span>
          <span className={strikeClass}>${list}</span>
        </span>
      </div>
    </div>
  );
}
