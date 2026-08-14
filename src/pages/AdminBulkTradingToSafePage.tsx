import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Loader2, RefreshCw, Send, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE } from "@/config/api";
import { AdminUserTradesLink } from "@/components/admin/AdminUserTradesLink";

type BulkParkRow = {
  user_id: number;
  name: string | null;
  email: string | null;
  trading_wallet: number;
  safe_wallet: number;
  deposit_baseline: number;
  settle_baseline_usd: number;
  park_baseline_usd: number;
  max_parkable_usd: number;
  trading_above_baseline_usd: number;
  open_positions: number;
  trading_active: boolean;
  eligible: boolean;
  block_reason: string | null;
};

type RowState = {
  selected: boolean;
  amount: string;
};

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `USD ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function defaultParkAmount(maxParkable: number) {
  const max = Math.max(0, Math.round(maxParkable * 100) / 100);
  return max > 0 ? max.toFixed(2) : "";
}

function blockLabel(reason: string | null) {
  switch (reason) {
    case "open_trades":
      return "Open trades";
    case "not_above_baseline":
      return "Not above baseline";
    default:
      return reason ?? "—";
  }
}

const AdminBulkTradingToSafePage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<BulkParkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [rowState, setRowState] = useState<Record<number, RowState>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastReport, setLastReport] = useState<{
    succeeded: number;
    failed: number;
    results: Array<{ userId: number; ok: boolean; error?: string }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/trading-to-safe/bulk-candidates`);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.users)) {
        toast({
          title: "Could not load users",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        setUsers([]);
        return;
      }
      setUsers(data.users);
      setRowState((prev) => {
        const next: Record<number, RowState> = {};
        for (const u of data.users as BulkParkRow[]) {
          const existing = prev[u.user_id];
          const max = Number(u.max_parkable_usd ?? 0);
          next[u.user_id] = {
            selected: existing?.selected ?? false,
            amount: existing?.amount ?? (u.eligible ? defaultParkAmount(max) : ""),
          };
        }
        return next;
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => Number(u.trading_wallet ?? 0) > 0.01)
      .filter((u) => {
        if (eligibleOnly && !u.eligible) return false;
        if (!q) return true;
        const hay = `${u.user_id} ${u.name ?? ""} ${u.email ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) =>
          Number(b.max_parkable_usd ?? 0) - Number(a.max_parkable_usd ?? 0) ||
          Number(b.trading_wallet ?? 0) - Number(a.trading_wallet ?? 0),
      );
  }, [users, search, eligibleOnly]);

  const selectedRows = useMemo(
    () => filtered.filter((u) => rowState[u.user_id]?.selected),
    [filtered, rowState],
  );

  const selectedTotal = useMemo(() => {
    return selectedRows.reduce((sum, u) => {
      const amt = Number(rowState[u.user_id]?.amount ?? 0);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
  }, [selectedRows, rowState]);

  const toggleAllVisible = (checked: boolean) => {
    setRowState((prev) => {
      const next = { ...prev };
      for (const u of filtered) {
        if (!u.eligible) continue;
        const max = Number(u.max_parkable_usd ?? 0);
        next[u.user_id] = {
          selected: checked,
          amount: prev[u.user_id]?.amount || defaultParkAmount(max),
        };
      }
      return next;
    });
  };

  const fillMaxForSelected = () => {
    setRowState((prev) => {
      const next = { ...prev };
      for (const u of users) {
        if (!next[u.user_id]?.selected || !u.eligible) continue;
        next[u.user_id] = {
          ...next[u.user_id],
          amount: defaultParkAmount(Number(u.max_parkable_usd ?? 0)),
        };
      }
      return next;
    });
  };

  const submitBulk = async () => {
    const items = selectedRows
      .map((u) => ({
        userId: u.user_id,
        amount: Number(rowState[u.user_id]?.amount ?? 0),
      }))
      .filter((x) => x.userId && Number.isFinite(x.amount) && x.amount > 0);

    if (!items.length) {
      toast({
        title: "Nothing to submit",
        description: "Select users and enter amounts greater than zero.",
        variant: "destructive",
      });
      return;
    }

    for (const u of selectedRows) {
      const amt = Number(rowState[u.user_id]?.amount ?? 0);
      const max = Number(u.max_parkable_usd ?? 0);
      if (amt > max + 0.001) {
        toast({
          title: `User #${u.user_id} amount too high`,
          description: `Max parkable is ${max.toFixed(2)} (keeps trading at baseline).`,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/trading-to-safe/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Bulk move failed",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }
      setLastReport({
        succeeded: data.succeeded ?? 0,
        failed: data.failed ?? 0,
        results: data.results ?? [],
      });
      setConfirmOpen(false);
      toast({
        title: "Trading → Safe complete",
        description: `${data.succeeded ?? 0} succeeded, ${data.failed ?? 0} failed.`,
      });
      await load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const allVisibleEligibleSelected =
    filtered.filter((u) => u.eligible).length > 0 &&
    filtered.filter((u) => u.eligible).every((u) => rowState[u.user_id]?.selected);

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <ArrowLeftRight className="h-8 w-8 shrink-0 text-neutral-900" aria-hidden />
            Bulk Trading → Safe
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Move profit from <span className="font-semibold">Trading Wallet</span> to{" "}
            <span className="font-semibold">Safe Wallet</span> for users who are above their settle
            baseline. Trading after the move stays at or above baseline — no Exit-pool admin cut on
            these partial parks.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Users must have no open trades (or trading stopped). For full Exit pool settle, use user
            trades page.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void load()}
          disabled={loading}
          className="gap-2 shrink-0 rounded-xl"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="park-search" className="text-xs text-slate-600">Search</Label>
          <Input
            id="park-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or user ID"
            className="mt-1"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <Checkbox
            checked={eligibleOnly}
            onCheckedChange={(v) => setEligibleOnly(v === true)}
          />
          Eligible only
        </label>
        <Button type="button" variant="outline" className="rounded-xl" onClick={fillMaxForSelected}>
          Fill max parkable
        </Button>
        <Button
          type="button"
          className="gap-2 rounded-xl bg-[#FFD700] text-black hover:bg-[#E6C200]"
          disabled={loading || selectedRows.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Send size={16} />
          Move to Safe ({selectedRows.length})
        </Button>
      </div>

      {lastReport && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Last batch: {lastReport.succeeded} succeeded, {lastReport.failed} failed.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="h-4 w-4" />
            {loading ? "Loading…" : `${filtered.length} users with Trading balance`}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={allVisibleEligibleSelected}
              onCheckedChange={(v) => toggleAllVisible(v === true)}
            />
            Select eligible
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 sm:px-6" />
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  User
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Park baseline
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Trading
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Safe
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Max parkable
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Amount to Safe
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                filtered.map((u) => {
                  const st = rowState[u.user_id] ?? { selected: false, amount: "" };
                  const maxPark = Number(u.max_parkable_usd ?? 0);
                  const baseline = Number(u.park_baseline_usd ?? 0);
                  const depositBaseline = Number(u.deposit_baseline ?? 0);
                  return (
                    <tr
                      key={u.user_id}
                      className={`border-b border-slate-100 ${st.selected ? "bg-yellow-50/50" : "hover:bg-slate-50/80"}`}
                    >
                      <td className="px-4 py-3 sm:px-6">
                        <Checkbox
                          checked={st.selected}
                          disabled={!u.eligible}
                          onCheckedChange={(v) => {
                            setRowState((prev) => ({
                              ...prev,
                              [u.user_id]: {
                                selected: v === true,
                                amount:
                                  prev[u.user_id]?.amount || defaultParkAmount(maxPark),
                              },
                            }));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <AdminUserTradesLink
                          userId={u.user_id}
                          name={u.name ?? "—"}
                          className="font-semibold"
                          showId
                        />
                        {u.email && <div className="text-xs text-slate-600">{u.email}</div>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-800 sm:px-6">
                        {money(baseline)}
                        {depositBaseline > baseline + 0.01 && (
                          <div className="text-[11px] text-slate-500">
                            deposit {money(depositBaseline)}
                          </div>
                        )}
                        {Number(u.settle_baseline_usd ?? 0) > 0.01 && (
                          <div className="text-[11px] text-slate-500">
                            floor {money(u.settle_baseline_usd)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-900 sm:px-6">
                        {money(u.trading_wallet)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-emerald-800 sm:px-6">
                        {money(u.safe_wallet)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-indigo-900 sm:px-6">
                        {money(maxPark)}
                        <div className="text-[11px] font-normal text-slate-500">
                          above baseline
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          max={maxPark}
                          disabled={!u.eligible}
                          value={st.amount}
                          onChange={(e) =>
                            setRowState((prev) => ({
                              ...prev,
                              [u.user_id]: { ...st, amount: e.target.value },
                            }))
                          }
                          className="h-9 w-28 tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs sm:px-6">
                        {u.eligible ? (
                          <span className="font-semibold text-emerald-700">Eligible</span>
                        ) : (
                          <span className="text-slate-500">{blockLabel(u.block_reason)}</span>
                        )}
                        {u.open_positions > 0 && (
                          <div className="text-[11px] text-slate-500">
                            {u.open_positions} open
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            No users with Trading balance above baseline.
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Move Trading → Safe</DialogTitle>
            <DialogDescription className="text-slate-600">
              Funds move from Trading Wallet to Safe Wallet. Trading will remain at or above the
              settle baseline for each user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-800">
            <p>
              <span className="font-semibold">{selectedRows.length}</span> user
              {selectedRows.length === 1 ? "" : "s"} · total{" "}
              <span className="font-semibold tabular-nums">{money(selectedTotal)}</span>
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
              disabled={submitting}
              onClick={() => void submitBulk()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBulkTradingToSafePage;
