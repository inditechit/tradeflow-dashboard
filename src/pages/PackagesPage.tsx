import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, PurchasedPackage } from "@/context/AppContext";
import { Sparkles, Check, X, AlertTriangle } from "lucide-react";
import {
  TRIAL_TERMS,
  PAID_WITHDRAW_NOTICE,
  WITHDRAW_USP,
  type SubscriptionPackage,
} from "@/constants/packages";
import { usePackages, getStoredCouponCode } from "@/hooks/usePackages";
import { fundLockNotice } from "@/utils/packageHelpers";
import { PackagePriceDisplay } from "@/components/packages/PackagePriceDisplay";
import { PackageCouponSection } from "@/components/packages/PackageCouponSection";
import { API_BASE } from "@/config/api";

const riskProfiles = [
  {
    id: "LOW",
    title: "LOW RISK",
    allocation: "Capital divided into 5 allocation parts",
    exposure: "5% – 10%",
    color: "bg-green-100 border-green-300 text-green-800",
  },
  {
    id: "MEDIUM",
    title: "MEDIUM RISK",
    allocation: "Capital divided into 4 allocation parts",
    exposure: "10% – 20%",
    color: "bg-yellow-100 border-yellow-300 text-yellow-800",
  },
  {
    id: "HIGH",
    title: "HIGH RISK",
    allocation: "Capital divided into 3 allocation parts",
    exposure: "20% – 50%",
    color: "bg-orange-100 border-orange-300 text-orange-800",
  },
  {
    id: "SUPER_HIGH",
    title: "SUPER HIGH RISK",
    allocation: "Capital divided into 2 allocation parts",
    exposure: "20% – 100%",
    color: "bg-red-100 border-red-300 text-red-800",
  },
];

const PackagesPage = () => {
  const navigate = useNavigate();
  const { setSelectedPackage, currentUser } = useApp();

  const API_BASE_LOCAL = API_BASE;

  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [pendingPackage, setPendingPackage] = useState<SubscriptionPackage | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [trialTermsAccepted, setTrialTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { packages, loading: packagesLoading, referralApplied, couponApplied, reload } = usePackages(
    currentUser?.userId,
  );
  const trialPkg = packages.find((p) => p.isTrial);
  const trialLockDays = trialPkg?.durationDays ?? trialPkg?.fundLockDays ?? 7;

  const handleSelectPackageClick = (pkg: SubscriptionPackage) => {
    setPendingPackage(pkg);
    setTrialTermsAccepted(false);
    setIsRiskModalOpen(true);
  };

  const toggleRiskSelection = (riskId: string) => {
    setSelectedRisks((prev) =>
      prev.includes(riskId) ? prev.filter((id) => id !== riskId) : [...prev, riskId]
    );
  };

  const proceedToCheckout = async () => {
    if (selectedRisks.length === 0) {
      alert("Please select at least one risk profile to proceed.");
      return;
    }

    if (pendingPackage?.isTrial && !trialTermsAccepted) {
      alert("Please accept the trial terms before activation.");
      return;
    }

    if (!pendingPackage) return;

    setIsSubmitting(true);

    try {
      await fetch(`${API_BASE_LOCAL}/user/${currentUser?.userId}/save-risk-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ risks: selectedRisks }),
      });

      const payPrice = pendingPackage.hasDiscount
        ? pendingPackage.discountedPrice ?? pendingPackage.referralPrice ?? pendingPackage.price
        : pendingPackage.listPrice ?? pendingPackage.price;
      const appliedCoupon = getStoredCouponCode();
      const selected: PurchasedPackage = {
        id: pendingPackage.id,
        name: pendingPackage.name,
        price: payPrice,
        originalPrice: pendingPackage.originalPrice,
        listPrice: pendingPackage.listPrice ?? pendingPackage.price,
        referralPrice: pendingPackage.referralPrice,
        hasReferralDiscount: pendingPackage.hasDiscount && referralApplied,
        couponCode: appliedCoupon || pendingPackage.couponCode || undefined,
        isTrial: pendingPackage.isTrial,
        icon: pendingPackage.icon.name,
        purchasedAt: new Date().toISOString(),
      };

      setSelectedPackage(selected);
      navigate("/payment", {
        state: pendingPackage.isTrial ? { trialTermsAccepted: true } : undefined,
      });
    } catch (error) {
      console.error("Failed to save risk profile:", error);
      alert("Something went wrong saving your risk profile. Please try again.");
    } finally {
      setIsSubmitting(false);
      setIsRiskModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-white relative">
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-[#FFF9E6] text-neutral-900 border border-yellow-200/80">
          <Sparkles size={18} />
          <span className="font-semibold tracking-wide uppercase text-sm">Step 3 of 3</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
          Select Your Premium Plan
        </h1>
        <p className="text-slate-500 text-sm md:text-base">
          Start with a free trial or choose a paid plan for full access.
        </p>
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-2 max-w-3xl mx-auto">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
            <p className="font-bold text-emerald-900">Free trial</p>
            <p className="mt-1">{fundLockNotice(trialLockDays)}</p>
          </div>
          <div className="rounded-xl border border-yellow-300 bg-[#FFF9E6] px-4 py-3 text-sm text-neutral-900">
            <p className="font-bold">{WITHDRAW_USP.headline}</p>
            <p className="mt-1">{PAID_WITHDRAW_NOTICE}</p>
          </div>
        </div>
      </div>

      <PackageCouponSection onCouponChange={() => void reload()} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full max-w-[90rem] items-stretch">
        {packagesLoading ? (
          <p className="col-span-full text-center text-slate-500">Loading plans…</p>
        ) : null}
        {packages.map((pkg) => {
          const Icon = pkg.icon;
          const isPopular = pkg.popular;
          const isTrial = pkg.isTrial;

          return (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-xl p-6 transition-all duration-300 flex flex-col h-full border
                ${isPopular
                  ? "border-2 border-[#FFD700] shadow-lg shadow-yellow-900/10 xl:-translate-y-2"
                  : isTrial
                    ? "border-2 border-emerald-300 shadow-md shadow-emerald-900/5"
                    : "border-slate-200 shadow-sm hover:border-slate-300 hover:-translate-y-1"
                }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black px-4 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-sm">
                  Most Popular
                </div>
              )}
              {isTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-sm">
                  Free Trial
                </div>
              )}

              <div className="flex-1">
                <div className="mb-6">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 
                    ${isPopular ? "bg-[#FFD700] text-black shadow-sm" : isTrial ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                  >
                    <Icon size={24} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{pkg.name}</h3>
                    {pkg.subtitle && (
                      <span className="w-fit rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[#FFD700]">
                        {pkg.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <PackagePriceDisplay
                    pkg={pkg}
                    referralApplied={referralApplied}
                    couponApplied={couponApplied}
                  />
                </div>

                <p className="text-slate-600 text-sm mb-6 leading-relaxed">{pkg.description}</p>

                <div className="space-y-2.5 mb-8">
                  {pkg.features.map((feature, idx) => {
                    const isHighlightedFeature = feature.includes("ROBOT");
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 text-sm rounded transition-all ${
                          isHighlightedFeature
                            ? "text-neutral-900 font-bold bg-yellow-100/70 border border-yellow-300 p-1.5 shadow-sm"
                            : isTrial
                              ? "text-slate-700"
                              : "text-slate-600"
                        }`}
                      >
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            isTrial ? "text-emerald-600" : "text-yellow-700"
                          }`}
                          strokeWidth={3}
                        />
                        <span>{feature}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPackageClick(pkg)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all mt-auto
                  ${isPopular
                    ? "bg-[#FFD700] text-black hover:bg-[#E6C200]"
                    : isTrial
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
              >
                {isTrial ? "Start free trial" : `Select ${pkg.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {isRiskModalOpen && pendingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                <span className="leading-tight">
                  {pendingPackage.isTrial ? "Trial activation" : "Choose your risk profile"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRiskModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {pendingPackage.isTrial && (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-sm font-bold text-emerald-900 mb-3">Trial terms</p>
                  <ul className="space-y-2 mb-4">
                    {TRIAL_TERMS.map((line) => (
                      <li key={line} className="flex gap-2 text-sm text-emerald-950">
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" strokeWidth={3} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                      checked={trialTermsAccepted}
                      onChange={(e) => setTrialTermsAccepted(e.target.checked)}
                    />
                    <span className="text-sm font-semibold text-emerald-900">
                      I accept the trial terms and want to activate my 7-day trial.
                    </span>
                  </label>
                </div>
              )}

              <p className="text-sm text-slate-500 mb-4">
                Select one or more risk profiles that match your trading strategy.
              </p>

              <div className="space-y-3">
                {riskProfiles.map((risk) => {
                  const isSelected = selectedRisks.includes(risk.id);
                  return (
                    <label
                      key={risk.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-yellow-400 bg-yellow-50/50"
                          : "border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-[#FFD700] focus:ring-[#FFD700]"
                          checked={isSelected}
                          onChange={() => toggleRiskSelection(risk.id)}
                        />
                      </div>
                      <div className="flex-1">
                        <div
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 border ${risk.color}`}
                        >
                          {risk.title}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">{risk.allocation}</p>
                        <p className="text-xs text-slate-500">
                          Estimated Monthly Risk Exposure:{" "}
                          <span className="font-semibold text-slate-700">{risk.exposure}</span>
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsRiskModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={proceedToCheckout}
                disabled={
                  isSubmitting ||
                  selectedRisks.length === 0 ||
                  (pendingPackage.isTrial && !trialTermsAccepted)
                }
                className="px-6 py-2.5 text-sm font-bold bg-[#FFD700] hover:bg-[#E6C200] text-black rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "Saving..."
                  : pendingPackage.isTrial
                    ? "Activate trial"
                    : "Confirm & proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesPage;
