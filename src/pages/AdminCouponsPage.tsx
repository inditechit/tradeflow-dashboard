import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Tag, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiPackage } from "@/utils/packageHelpers";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";

type CouponRow = {
  id: number;
  code: string;
  name: string | null;
  package_id: string;
  package_name?: string;
  owner_user_id: number | null;
  owner_name?: string | null;
  discount_percent: number | null;
  discount_amount_usd: number | null;
  duration_days: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

type EditableCoupon = CouponRow & { isNew?: boolean };

const emptyCoupon = (): EditableCoupon => ({
  id: 0,
  code: "",
  name: "",
  package_id: "1-month",
  owner_user_id: null,
  discount_percent: 10,
  discount_amount_usd: null,
  duration_days: 30,
  max_uses: null,
  used_count: 0,
  expires_at: null,
  is_active: true,
  isNew: true,
});

const AdminCouponsPage = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<EditableCoupon[]>([]);
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/admin/coupons`),
        fetch(`${API_BASE}/admin/packages`),
      ]);
      const cData = await cRes.json();
      const pData = await pRes.json();
      if (cData.success) setCoupons(cData.coupons ?? []);
      if (pData.success) setPackages(pData.packages ?? []);
    } catch {
      toast({ title: "Failed to load coupons", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const paidPackages = packages.filter((p) => !p.is_trial && Number(p.price_usd) > 0);

  const updateCoupon = (key: number | string, patch: Partial<EditableCoupon>) => {
    setCoupons((prev) =>
      prev.map((c, i) => {
        const rowKey = c.isNew ? `new-${i}` : c.id;
        if (rowKey !== key) return c;
        const next = { ...c, ...patch };
        if (patch.package_id) {
          const pkg = paidPackages.find((p) => p.id === patch.package_id);
          if (pkg && !patch.duration_days) next.duration_days = pkg.duration_days;
        }
        return next;
      }),
    );
  };

  const saveCoupon = async (coupon: EditableCoupon, key: number | string) => {
    setSavingId(key);
    try {
      const res = await fetch(`${API_BASE}/admin/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: coupon.isNew ? undefined : coupon.id,
          code: coupon.code,
          name: coupon.name,
          package_id: coupon.package_id,
          owner_user_id: coupon.owner_user_id,
          discount_percent: coupon.discount_percent,
          duration_days: coupon.duration_days,
          max_uses: coupon.max_uses,
          expires_at: coupon.expires_at || null,
          is_active: coupon.is_active,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Coupon saved", description: data.coupon?.code });
      await load();
    } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const removeCoupon = async (coupon: EditableCoupon, key: number | string) => {
    if (!window.confirm(`Delete coupon ${coupon.code || "draft"}?`)) return;
    if (coupon.isNew) {
      setCoupons((prev) => prev.filter((_, i) => `new-${i}` !== key));
      return;
    }
    setDeletingId(coupon.id);
    try {
      const res = await fetch(`${API_BASE}/admin/coupons/${coupon.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Coupon deleted" });
      await load();
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Tag className="h-7 w-7" />
            Referral coupons
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            User-specific coupons (% off a package). Referral links auto-apply the owner&apos;s coupon.
            When someone uses a coupon, they become that user&apos;s referral if they had none.
          </p>
        </div>
        <Button type="button" onClick={() => setCoupons((prev) => [...prev, emptyCoupon()])}>
          Add coupon
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {coupons.map((coupon, index) => {
            const rowKey = coupon.isNew ? `new-${index}` : coupon.id;
            const pkg = paidPackages.find((p) => p.id === coupon.package_id);
            const pct = Number(coupon.discount_percent ?? 0);
            const preview =
              pkg && pct > 0
                ? Math.round(Number(pkg.price_usd) * (1 - pct / 100) * 100) / 100
                : null;
            return (
              <div key={rowKey} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm font-bold uppercase text-slate-800">
                      {coupon.code || "NEW CODE"}
                    </span>
                    {coupon.name ? (
                      <span className="ml-2 text-sm text-slate-500">{coupon.name}</span>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={coupon.is_active}
                      onChange={(e) => updateCoupon(rowKey, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Code</Label>
                    <Input
                      className="mt-1 font-mono uppercase"
                      value={coupon.code}
                      onChange={(e) => updateCoupon(rowKey, { code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <Label>Display name</Label>
                    <Input
                      className="mt-1"
                      value={coupon.name ?? ""}
                      onChange={(e) => updateCoupon(rowKey, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Owner (referrer)</Label>
                    <UserSearchSelect
                      value={coupon.owner_user_id}
                      selectedLabel={
                        coupon.owner_name
                          ? `${coupon.owner_name} · #${coupon.owner_user_id}`
                          : null
                      }
                      onChange={(userId, user) =>
                        updateCoupon(rowKey, {
                          owner_user_id: userId,
                          owner_name: user?.name ?? coupon.owner_name ?? null,
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Buyer using this coupon becomes their referral if they had none
                    </p>
                  </div>
                  <div>
                    <Label>Package</Label>
                    <select
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={coupon.package_id}
                      onChange={(e) => updateCoupon(rowKey, { package_id: e.target.value })}
                    >
                      {paidPackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${Number(p.price_usd).toFixed(0)} · {p.duration_days}d)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      value={coupon.discount_percent ?? ""}
                      onChange={(e) =>
                        updateCoupon(rowKey, {
                          discount_percent: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Package duration (days)</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      value={coupon.duration_days ?? ""}
                      onChange={(e) =>
                        updateCoupon(rowKey, {
                          duration_days: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">Must match package duration</p>
                  </div>
                  <div>
                    <Label>Max uses</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      placeholder="Unlimited"
                      value={coupon.max_uses ?? ""}
                      onChange={(e) =>
                        updateCoupon(rowKey, {
                          max_uses: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                        })
                      }
                    />
                    {!coupon.isNew ? (
                      <p className="mt-1 text-xs text-slate-500">Used: {coupon.used_count}</p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Expires (optional)</Label>
                    <Input
                      type="datetime-local"
                      className="mt-1"
                      value={
                        coupon.expires_at
                          ? new Date(coupon.expires_at).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        updateCoupon(rowKey, {
                          expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                  </div>
                </div>
                {preview != null && pkg ? (
                  <p className="mt-3 text-sm text-emerald-700">
                    Pricing: original ${Number(pkg.original_price_usd ?? pkg.price_usd).toFixed(0)} ·
                    discounted ${Number(pkg.price_usd).toFixed(0)} · after referral $
                    {Number(pkg.referral_price_usd ?? preview).toFixed(0)}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingId === rowKey}
                    onClick={() => void saveCoupon(coupon, rowKey)}
                  >
                    {savingId === rowKey ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={deletingId === coupon.id}
                    onClick={() => void removeCoupon(coupon, rowKey)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCouponsPage;
