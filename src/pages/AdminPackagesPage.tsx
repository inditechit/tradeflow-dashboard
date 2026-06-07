import { useCallback, useEffect, useState } from "react";
import { Loader2, Package, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApiPackage } from "@/utils/packageHelpers";

type EditablePackage = ApiPackage & { featuresText: string; isNew?: boolean };

function toEditable(p: ApiPackage): EditablePackage {
  return {
    ...p,
    featuresText: (p.features || []).join("\n"),
  };
}

function fromEditable(p: EditablePackage) {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    description: p.description,
    duration_days: p.duration_days,
    fund_lock_days: p.is_trial ? p.duration_days : p.fund_lock_days,
    price_usd: p.price_usd,
    original_price_usd: p.original_price_usd,
    is_trial: p.is_trial,
    is_active: p.is_active,
    is_popular: p.is_popular,
    sort_order: p.sort_order,
    features: p.featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

const AdminPackagesPage = () => {
  const { toast } = useToast();
  const [packages, setPackages] = useState<EditablePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/packages`);
      const data = await res.json();
      if (data.success) {
        setPackages((data.packages ?? []).map(toEditable));
      } else {
        toast({ title: "Failed to load packages", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const updatePkg = (id: string, patch: Partial<EditablePackage>) => {
    setPackages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (next.is_trial) next.fund_lock_days = next.duration_days;
        return next;
      }),
    );
  };

  const savePackage = async (pkg: EditablePackage) => {
    setSavingId(pkg.id);
    try {
      const res = await fetch(`${API_BASE}/admin/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromEditable(pkg)),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Package saved", description: pkg.name });
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

  const addPackage = () => {
    const id = `custom-${Date.now()}`;
    setPackages((prev) => [
      ...prev,
      {
        ...toEditable({
          id,
          name: "New package",
          subtitle: null,
          description: "",
          duration_days: 30,
          fund_lock_days: 0,
          price_usd: 99,
          original_price_usd: 120,
          is_trial: false,
          is_active: false,
          is_popular: false,
          sort_order: 100,
          features: [],
        }),
        isNew: true,
      },
    ]);
  };

  const deletePackage = async (pkg: EditablePackage) => {
    if (!window.confirm(`Remove or deactivate "${pkg.name}"?`)) return;
    setDeletingId(pkg.id);
    try {
      if (pkg.isNew) {
        setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
        return;
      }
      const res = await fetch(`${API_BASE}/admin/packages/${encodeURIComponent(pkg.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({
        title: data.deactivated ? "Package deactivated" : "Package deleted",
        description: data.deactivated
          ? "Users with past payments keep history; package hidden from new purchases."
          : undefined,
      });
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
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Package className="h-7 w-7" />
            Subscription packages
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Set duration and three price tiers: original (MRP), list price (shown on site), and referral
            discounts come from each user&apos;s coupon. Packages must be <strong>Active</strong> to
            appear on the frontend. Free/trial fund-lock days always match duration.
          </p>
        </div>
        <Button type="button" onClick={addPackage}>
          <Plus className="mr-2 h-4 w-4" />
          Add package
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{pkg.id}</span>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pkg.is_active}
                      onChange={(e) => updatePkg(pkg.id, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pkg.is_popular}
                      onChange={(e) => updatePkg(pkg.id, { is_popular: e.target.checked })}
                    />
                    Popular
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pkg.is_trial}
                      onChange={(e) =>
                        updatePkg(pkg.id, {
                          is_trial: e.target.checked,
                          fund_lock_days: e.target.checked ? pkg.duration_days : pkg.fund_lock_days,
                          price_usd: e.target.checked ? 0 : pkg.price_usd,
                        })
                      }
                    />
                    Free / trial
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {pkg.isNew ? (
                  <div>
                    <Label>Package ID (slug)</Label>
                    <Input
                      className="mt-1 font-mono text-sm"
                      value={pkg.id}
                      onChange={(e) =>
                        updatePkg(pkg.id, {
                          id: e.target.value
                            .trim()
                            .toLowerCase()
                            .replace(/[^a-z0-9-]+/g, "-"),
                        })
                      }
                    />
                  </div>
                ) : null}
                <div className={pkg.isNew ? "" : "sm:col-span-2"}>
                  <Label>Name</Label>
                  <Input
                    className="mt-1"
                    value={pkg.name}
                    onChange={(e) => updatePkg(pkg.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Subtitle</Label>
                  <Input
                    className="mt-1"
                    value={pkg.subtitle ?? ""}
                    onChange={(e) => updatePkg(pkg.id, { subtitle: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={pkg.sort_order}
                    onChange={(e) => updatePkg(pkg.id, { sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={pkg.duration_days}
                    onChange={(e) => {
                      const duration_days = Math.max(1, Number(e.target.value) || 1);
                      updatePkg(pkg.id, {
                        duration_days,
                        fund_lock_days: pkg.is_trial ? duration_days : pkg.fund_lock_days,
                      });
                    }}
                  />
                </div>
                <div>
                  <Label>Fund lock (days)</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    disabled={pkg.is_trial}
                    value={pkg.is_trial ? pkg.duration_days : pkg.fund_lock_days}
                    onChange={(e) =>
                      updatePkg(pkg.id, { fund_lock_days: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  {pkg.is_trial ? (
                    <p className="mt-1 text-xs text-emerald-700">Free trial: always equals duration</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">0 = no withdraw lock for paid plans</p>
                  )}
                </div>
                <div>
                  <Label>Original price / MRP (USD)</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    disabled={pkg.is_trial}
                    value={pkg.original_price_usd ?? ""}
                    onChange={(e) =>
                      updatePkg(pkg.id, {
                        original_price_usd: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">Strikethrough price on the site</p>
                </div>
                <div>
                  <Label>List price / discounted (USD)</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    disabled={pkg.is_trial}
                    value={pkg.price_usd}
                    onChange={(e) => updatePkg(pkg.id, { price_usd: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Shown to everyone · referral price is list minus coupon %
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  className="mt-1"
                  value={pkg.description ?? ""}
                  onChange={(e) => updatePkg(pkg.id, { description: e.target.value })}
                />
              </div>
              <div className="mt-3">
                <Label>Features (one per line)</Label>
                <Textarea
                  rows={4}
                  className="mt-1 font-mono text-sm"
                  value={pkg.featuresText}
                  onChange={(e) => updatePkg(pkg.id, { featuresText: e.target.value })}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={savingId === pkg.id}
                  onClick={() => void savePackage(pkg)}
                >
                  {savingId === pkg.id ? (
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
                  disabled={deletingId === pkg.id}
                  onClick={() => void deletePackage(pkg)}
                >
                  {deletingId === pkg.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPackagesPage;
