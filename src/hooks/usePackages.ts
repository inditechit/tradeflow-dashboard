import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";
import { SUBSCRIPTION_PACKAGES } from "@/constants/packages";
import { apiPackageToUi, type ApiPackage } from "@/utils/packageHelpers";
import type { SubscriptionPackage } from "@/constants/packages";

export function getStoredReferralKey() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("referrer_key")?.trim() ?? "";
}

export function getStoredCouponCode() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("applied_coupon_code")?.trim() ?? "";
}

export function setStoredCouponCode(code: string | null) {
  if (typeof window === "undefined") return;
  const normalized = code?.trim().toUpperCase();
  if (normalized) sessionStorage.setItem("applied_coupon_code", normalized);
  else sessionStorage.removeItem("applied_coupon_code");
}

/** Persist encrypted referral key from ?r= or legacy ?ref= and strip it from the URL. */
export function captureReferralKeyFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const refValue = params.get("r") || params.get("ref");
  if (!refValue) return;
  sessionStorage.setItem("referrer_key", refValue);
  setStoredCouponCode(null);
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function usePackages(userId?: string | null) {
  const [packages, setPackages] = useState<SubscriptionPackage[]>(SUBSCRIPTION_PACKAGES);
  const [rawPackages, setRawPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const [couponApplied, setCouponApplied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const referralKey = getStoredReferralKey();
      const couponCode = referralKey ? null : getStoredCouponCode();
      if (referralKey) setStoredCouponCode(null);

      const params = new URLSearchParams();
      if (userId) params.set("userId", String(userId));
      if (referralKey) params.set("r", referralKey);
      else if (couponCode) params.set("coupon", couponCode);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const res = await fetch(`${API_BASE}/packages${qs}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.packages) && data.packages.length) {
        const mapped = data.packages.map((p: ApiPackage) => apiPackageToUi(p));
        setPackages(mapped);
        setRawPackages(data.packages);
        setFromApi(true);
        const storedReferral = data.referralSource === "stored";
        const linkReferral = Boolean(referralKey) || data.referralSource === "link";
        setReferralApplied(storedReferral || linkReferral);
        setCouponApplied(Boolean(couponCode) || data.referralSource === "coupon");
      } else {
        setPackages(SUBSCRIPTION_PACKAGES);
        setFromApi(false);
        setReferralApplied(false);
        setCouponApplied(false);
      }
    } catch {
      setPackages(SUBSCRIPTION_PACKAGES);
      setFromApi(false);
      setReferralApplied(false);
      setCouponApplied(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { packages, rawPackages, loading, fromApi, referralApplied, couponApplied, reload: load };
}

export function isTrialPackage(pkg: { isTrial?: boolean; price?: number; price_usd?: number } | null) {
  if (!pkg) return false;
  if (pkg.isTrial) return true;
  const price = Number("price_usd" in pkg ? pkg.price_usd : pkg.price);
  return price === 0;
}
