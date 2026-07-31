import React, { useState, useEffect } from "react";
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
import { PackagePriceDisplay } from "@/components/packages/PackagePriceDisplay";
import { PackageCouponSection } from "@/components/packages/PackageCouponSection";
import { API_BASE } from "@/config/api";
import { LegalAcceptanceCheckbox } from "@/components/legal/LegalAcceptanceCheckbox";
import { RiskProfilePicker } from "@/components/risk/RiskProfilePicker";
import { parseUserRiskIds } from "@/utils/userRiskProfile";

const PackagesPage = () => {
  const navigate = useNavigate();
  const { setSelectedPackage, currentUser } = useApp();

  const API_BASE_LOCAL = API_BASE;

  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [pendingPackage, setPendingPackage] = useState<SubscriptionPackage | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);
  const [trialTermsAccepted, setTrialTermsAccepted] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseBlocked, setPurchaseBlocked] = useState<string | null>(null);
  const { packages, loading: packagesLoading, referralApplied, couponApplied, reload } = usePackages(
    currentUser?.userId,
  );

  useEffect(() => {
    const uid = currentUser?.userId;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/block-access/${uid}`);
        const data = await res.json();
        if (cancelled) return;
        const access = data.access;
        if (access && access.can_purchase_package === false) {
          setPurchaseBlocked(
            access.message ||
              "Package purchase is not available for your account. Contact support if you believe this is an error.",
          );
        } else {
          setPurchaseBlocked(null);
        }
      } catch {
        if (!cancelled) setPurchaseBlocked(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.userId]);
  const sellablePackages = packages.filter((p) => !p.isTrial);

  const handleSelectPackageClick = async (pkg: SubscriptionPackage) => {
    if (purchaseBlocked) {
      alert(purchaseBlocked);
      return;
    }
    setPendingPackage(pkg);
    setTrialTermsAccepted(false);
    setLegalAccepted(false);
    setSelectedRisk(null);

    const uid = currentUser?.userId;
    if (uid) {
      try {
        const res = await fetch(`${API_BASE}/user/profile/${uid}`);
        const data = await res.json();
        const existing = parseUserRiskIds(data?.profile?.risk);
        if (existing.length === 1) setSelectedRisk(existing[0]);
      } catch {
        /* keep null */
      }
    }

    setIsRiskModalOpen(true);
  };

  const proceedToCheckout = async () => {
    if (!selectedRisk) {
      alert("Please select one risk profile to proceed.");
      return;
    }

    if (!legalAccepted) {
      alert("Please accept the Privacy Policy, Terms & Conditions, and Refund Policy to continue.");
      return;
    }

    if (pendingPackage?.isTrial && !trialTermsAccepted) {
      alert("Please accept the trial terms before activation.");
      return;
    }

    if (!pendingPackage) return;

    setIsSubmitting(true);

    try {
      const saveRes = await fetch(`${API_BASE_LOCAL}/user/${currentUser?.userId}/save-risk-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ risks: [selectedRisk] }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData?.success) {
        alert(saveData?.error || "Could not save risk profile.");
        return;
      }

      const payPrice = pendingPackage.hasDiscount
        ? pendingPackage.discountedPrice ?? pendingPackage.referralPrice ?? pendingPackage.price
        : pendingPackage.listPrice ?? pendingPackage.price;
      const appliedCoupon = referralApplied ? null : getStoredCouponCode();
      const selected: PurchasedPackage = {
        id: pendingPackage.id,
        name: pendingPackage.name,
        price: payPrice,
        originalPrice: pendingPackage.originalPrice,
        listPrice: pendingPackage.listPrice ?? pendingPackage.price,
        referralPrice: pendingPackage.referralPrice,
        hasReferralDiscount: pendingPackage.hasDiscount && referralApplied,
        couponCode: appliedCoupon || (referralApplied ? undefined : pendingPackage.couponCode) || undefined,
        isTrial: pendingPackage.isTrial,
        icon: pendingPackage.icon.name,
        purchasedAt: new Date().toISOString(),
      };

      setSelectedPackage(selected);
      setIsRiskModalOpen(false);
      navigate("/payment", {
        state: {
          legalAccepted: true,
          ...(pendingPackage.isTrial ? { trialTermsAccepted: true } : {}),
        },
      });
    } catch (error) {
      console.error("Failed to save risk profile:", error);
      alert("Something went wrong saving your risk profile. Please try again.");
    } finally {
      setIsSubmitting(false);
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
          Choose a paid plan for full access and fast $ withdrawals.
        </p>
        {purchaseBlocked && (
          <div className="mt-6 mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Package purchase unavailable
            </p>
            <p className="mt-1">{purchaseBlocked}</p>
          </div>
        )}
        <div className="mt-6 mx-auto max-w-xl rounded-xl border border-yellow-300 bg-[#FFF9E6] px-4 py-3 text-left text-sm text-neutral-900">
          <p className="font-bold">{WITHDRAW_USP.headline}</p>
          <p className="mt-1">{PAID_WITHDRAW_NOTICE}</p>
        </div>
      </div>

      <PackageCouponSection onCouponChange={() => void reload()} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-[90rem] items-stretch">
        {packagesLoading ? (
          <p className="col-span-full text-center text-slate-500">Loading plans…</p>
        ) : null}
        {sellablePackages.map((pkg) => {
          const Icon = pkg.icon;
          const isPopular = pkg.popular;
          const isTrial = false;

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
              <div className="mb-6">
                <LegalAcceptanceCheckbox
                  checked={legalAccepted}
                  onChange={setLegalAccepted}
                  id="package-legal-accept"
                />
              </div>

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

              <p className="mb-4 text-sm text-slate-500">
                Select <strong>one</strong> risk profile that matches your trading strategy.
              </p>

              <RiskProfilePicker
                selectedRisk={selectedRisk}
                onSelect={setSelectedRisk}
                name="package-risk"
              />
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
                  !selectedRisk ||
                  !legalAccepted ||
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
