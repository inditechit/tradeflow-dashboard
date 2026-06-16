import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Tag } from "lucide-react";
import { API_BASE } from "@/config/api";
import {
  getStoredCouponCode,
  getStoredReferralKey,
  setStoredCouponCode,
} from "@/hooks/usePackages";

export type SuggestedCoupon = {
  code: string;
  name: string | null;
  package_id: string;
  package_name: string | null;
  discount_percent: number | null;
  discount_amount_usd: number | null;
  package_price_usd: number | null;
};

type PackageCouponSectionProps = {
  onCouponChange: () => void;
};

export function PackageCouponSection({ onCouponChange }: PackageCouponSectionProps) {
  const hasReferral = Boolean(getStoredReferralKey());
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState(getStoredCouponCode());
  const [appliedCode, setAppliedCode] = useState(getStoredCouponCode());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedCoupon[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  const loadSuggested = useCallback(async () => {
    setLoadingSuggested(true);
    try {
      const res = await fetch(`${API_BASE}/coupons/suggested`);
      const data = await res.json();
      if (data.success) setSuggested(data.coupons ?? []);
    } catch {
      setSuggested([]);
    } finally {
      setLoadingSuggested(false);
    }
  }, []);

  useEffect(() => {
    if (hasReferral || !expanded) return;
    void loadSuggested();
  }, [hasReferral, expanded, loadSuggested]);

  if (hasReferral) return null;

  const applyCode = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a coupon code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/packages?coupon=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const matched = (data.packages ?? []).some(
        (p: { coupon_code?: string; has_discount?: boolean; is_trial?: boolean }) =>
          !p.is_trial && (p.coupon_code === trimmed || p.has_discount),
      );
      if (!data.success || !matched) {
        setError("Invalid or expired coupon for available packages");
        return;
      }
      setStoredCouponCode(trimmed);
      setAppliedCode(trimmed);
      setCode(trimmed);
      onCouponChange();
    } catch {
      setError("Could not validate coupon");
    } finally {
      setLoading(false);
    }
  };

  const clearCoupon = () => {
    setStoredCouponCode(null);
    setAppliedCode("");
    setCode("");
    setError("");
    onCouponChange();
  };

  return (
    <div className="mx-auto mb-8 w-full max-w-xl">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-yellow-400 hover:bg-yellow-50/50 hover:text-slate-900"
        >
          <Tag className="h-4 w-4 text-yellow-700" />
          {appliedCode ? `Coupon ${appliedCode} applied — change` : "Apply coupon"}
          <ChevronDown className="h-4 w-4 opacity-60" />
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Tag className="h-4 w-4 text-yellow-700" />
              Apply coupon
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Collapse"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          {appliedCode ? (
            <p className="mb-3 text-xs font-medium text-emerald-700">
              ✓ {appliedCode} applied to eligible packages
              <button
                type="button"
                onClick={clearCoupon}
                className="ml-2 text-slate-500 underline hover:text-slate-800"
              >
                Remove
              </button>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
              placeholder="ENTER CODE"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void applyCode(code);
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void applyCode(code)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </button>
          </div>

          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suggested coupons
            </p>
            {loadingSuggested ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : suggested.length === 0 ? (
              <p className="text-xs text-slate-400">No suggested coupons right now.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {suggested.map((c) => {
                  const pct =
                    c.discount_percent ??
                    (c.package_price_usd && c.discount_amount_usd
                      ? Math.round((c.discount_amount_usd / c.package_price_usd) * 100)
                      : null);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      disabled={loading}
                      onClick={() => void applyCode(c.code)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-xs transition hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <span className="font-mono font-bold text-emerald-900">{c.code}</span>
                      <span className="mt-0.5 block text-emerald-800">
                        {c.package_name ?? c.package_id}
                        {pct ? ` · ${pct}% off` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
