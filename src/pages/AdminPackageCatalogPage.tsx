import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Package, Pencil } from "lucide-react";
import { API_BASE } from "@/config/api";
import { apiPackageToUi } from "@/utils/packageHelpers";
import type { SubscriptionPackage } from "@/constants/packages";
import { PackagePriceDisplay } from "@/components/packages/PackagePriceDisplay";
import { fundLockNotice } from "@/utils/packageHelpers";

/** Read-only view of active packages as customers see them on the site. */
const AdminPackageCatalogPage = () => {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/packages`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load packages");
        setPackages([]);
        return;
      }
      const active = (data.packages ?? [])
        .filter((p: { is_active?: boolean }) => p.is_active !== false)
        .map(apiPackageToUi);
      setPackages(active);
    } catch {
      setError("Network error loading packages");
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Package className="h-7 w-7" />
            Packages we sell
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Customer-facing view of active plans — prices and features shown on the signup flow.
          </p>
        </div>
        <Link
          to="/admin/packages"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-yellow-300 hover:bg-yellow-50"
          title="Edit packages"
        >
          <Pencil className="h-4 w-4 text-yellow-700" />
          Edit packages
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No active packages.{" "}
          <Link to="/admin/packages" className="font-semibold text-neutral-900 underline">
            Add or activate packages
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => {
            const Icon = pkg.icon;
            const lockDays = pkg.isTrial ? pkg.durationDays : pkg.fundLockDays;
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  pkg.popular ? "border-2 border-[#FFD700]" : "border-slate-100"
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FFD700] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
                    Popular
                  </span>
                )}
                {pkg.isTrial && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    Free trial
                  </span>
                )}

                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{pkg.name}</h2>
                    {pkg.subtitle ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800">
                        {pkg.subtitle}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">{pkg.duration}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <PackagePriceDisplay pkg={pkg} size="sm" />
                  {!pkg.isTrial && pkg.referralPrice != null && (
                    <p className="mt-2 text-xs text-emerald-700">
                      Referral price: ${pkg.referralPrice.toFixed(0)}
                    </p>
                  )}
                </div>

                {pkg.description ? (
                  <p className="mb-4 text-sm text-slate-600">{pkg.description}</p>
                ) : null}

                {lockDays != null && lockDays > 0 ? (
                  <p className="mb-4 text-xs text-slate-500">{fundLockNotice(lockDays)}</p>
                ) : null}

                <ul className="mt-auto space-y-2 border-t border-slate-100 pt-4">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 font-mono text-[10px] text-slate-400">{pkg.id}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPackageCatalogPage;
