import { useNavigate } from "react-router-dom";
import { AlertTriangle, Package, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/context/SubscriptionContext";
import { packageDisplayName } from "@/constants/packages";

function formatExpiry(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Non-dismissible overlay when subscription has ended. */
const PlanExpiredOverlay = () => {
  const navigate = useNavigate();
  const { expiresAt, segments } = useSubscription();

  const lastPlan = segments.length ? segments[segments.length - 1] : null;
  const planLabel = lastPlan
    ? packageDisplayName(lastPlan.packageId, lastPlan.packageName)
    : "your plan";

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="plan-expired-title"
      aria-describedby="plan-expired-desc"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-amber-200/80 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-6 w-6 text-amber-700" aria-hidden />
        </div>

        <h2
          id="plan-expired-title"
          className="text-xl font-bold text-slate-900 sm:text-2xl"
        >
          Plan expired
        </h2>

        <p id="plan-expired-desc" className="mt-3 text-sm leading-relaxed text-slate-600">
          {planLabel} ended on{" "}
          <span className="font-semibold text-slate-800">
            {formatExpiry(expiresAt)}
          </span>
          . Trading and wallet features are locked until you renew. You can still
          withdraw funds or purchase a new package.
        </p>

        {segments.length > 1 && (
          <p className="mt-2 text-xs text-slate-500">
            {segments.length} plan purchases on your account — access follows your
            combined subscription period.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full bg-[#FFD700] font-semibold text-black hover:bg-[#e6c200]"
            onClick={() => navigate("/packages")}
          >
            <Package className="mr-2 h-4 w-4" />
            Buy a package
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate("/user/withdraw")}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Go to withdraw
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanExpiredOverlay;
