import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";
import { SUBSCRIPTION_PACKAGES } from "@/constants/packages";
import { apiPackageToUi, type ApiPackage } from "@/utils/packageHelpers";
import type { SubscriptionPackage } from "@/constants/packages";

export function usePackages() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>(SUBSCRIPTION_PACKAGES);
  const [rawPackages, setRawPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/packages`);
      const data = await res.json();
      if (data.success && Array.isArray(data.packages) && data.packages.length) {
        const mapped = data.packages.map((p: ApiPackage) => apiPackageToUi(p));
        setPackages(mapped);
        setRawPackages(data.packages);
        setFromApi(true);
      } else {
        setPackages(SUBSCRIPTION_PACKAGES);
        setFromApi(false);
      }
    } catch {
      setPackages(SUBSCRIPTION_PACKAGES);
      setFromApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { packages, rawPackages, loading, fromApi, reload: load };
}

export function isTrialPackage(pkg: { isTrial?: boolean; price?: number; price_usd?: number } | null) {
  if (!pkg) return false;
  if (pkg.isTrial) return true;
  const price = Number("price_usd" in pkg ? pkg.price_usd : pkg.price);
  return price === 0;
}
