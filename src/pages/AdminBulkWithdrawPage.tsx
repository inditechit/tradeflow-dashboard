import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  Loader2,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
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

const WITHDRAW_FEE = 5;

function maxPayoutFromWallet(walletUsd: number) {
  return Math.max(0, Math.round((walletUsd - WITHDRAW_FEE) * 100) / 100);
}

type BulkUserRow = {
  user_id: number;
  name: string | null;
  email: string | null;
  invested: number | null;
  equity: number;
  withdrawable: number;
  wallet_balance: number;
  open_positions: number;
  has_trc20: boolean;
  pending_withdraw: boolean;
  eligible: boolean;
  block_reason: string | null;
  error?: string;
};

type RowState = {
  selected: boolean;
  amount: string;
};

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `USD ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function blockLabel(reason: string | null) {
  switch (reason) {
    case "no_trc20":
      return "No TRC20 address";
    case "pending_withdraw":
      return "Pending withdraw";
    case "open_trades":
      return "Open trades";
    case "no_balance":
      return "No withdrawable balance";
    default:
      return reason ?? "—";
  }
}

const AdminBulkWithdrawPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<BulkUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [rowState, setRowState] = useState<Record<number, RowState>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processNow, setProcessNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastReport, setLastReport] = useState<{
    succeeded: number;
    failed: number;
    results: Array<{ userId: number; ok: boolean; error?: string; requestId?: number }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/bulk-candidates`);
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
        for (const u of data.users as BulkUserRow[]) {
          const existing = prev[u.user_id];
          const defaultAmt =
            u.eligible && u.withdrawable > WITHDRAW_FEE
              ? maxPayoutFromWallet(u.withdrawable).toFixed(2)
              : "";
          next[u.user_id] = {
            selected: existing?.selected ?? false,
            amount: existing?.amount ?? defaultAmt,
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
      .filter((u) => u.wallet_balance > 0.01)
      .filter((u) => {
        if (eligibleOnly && !u.eligible) return false;
        if (!q) return true;
        const hay = `${u.user_id} ${u.name ?? ""} ${u.email ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.wallet_balance - a.wallet_balance || a.user_id - b.user_id);
  }, [users, search, eligibleOnly]);

  const selectedRows = useMemo(() => {
    return filtered.filter((u) => rowState[u.user_id]?.selected);
  }, [filtered, rowState]);

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
        next[u.user_id] = {
          selected: checked,
          amount:
            prev[u.user_id]?.amount ||
            (u.withdrawable > WITHDRAW_FEE ? maxPayoutFromWallet(u.withdrawable).toFixed(2) : ""),
        };
      }
      return next;
    });
  };

  const fillWithdrawableForSelected = () => {
    setRowState((prev) => {
      const next = { ...prev };
      for (const u of users) {
        if (!next[u.user_id]?.selected || !u.eligible) continue;
        next[u.user_id] = {
          ...next[u.user_id],
          amount: maxPayoutFromWallet(u.withdrawable).toFixed(2),
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

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, processNow, sendOnChain: true }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Bulk withdraw failed",
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
        title: processNow ? "Bulk payout finished" : "Requests queued",
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
            <Users className="h-8 w-8 shrink-0 text-neutral-900" aria-hidden />
            Bulk withdraw
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Users with wallet balance only, sorted highest to lowest. Payout amounts are USDT sent;
            each withdrawal also debits a ${WITHDRAW_FEE} fee from the user wallet.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Approve queued requests on{" "}
            <Link to="/admin/withdrawals" className="font-semibold text-neutral-800 underline">
              Withdrawal requests
            </Link>
            .
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
          <Label htmlFor="bulk-search" className="text-xs text-slate-600">
            Search
          </Label>
          <Input
            id="bulk-search"
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
        <Button type="button" variant="outline" size="sm" onClick={() => toggleAllVisible(true)}>
          Select all visible
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => toggleAllVisible(false)}>
          Clear selection
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={fillWithdrawableForSelected}>
          Fill withdrawable for selected
        </Button>
        <Button
          type="button"
          className="gap-2 bg-[#FFD700] text-black hover:bg-[#E6C200]"
          disabled={selectedRows.length === 0 || loading}
          onClick={() => {
            setProcessNow(false);
            setConfirmOpen(true);
          }}
        >
          <Send className="h-4 w-4" />
          Queue {selectedRows.length} request{selectedRows.length === 1 ? "" : "s"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={selectedRows.length === 0 || loading}
          onClick={() => {
            setProcessNow(true);
            setConfirmOpen(true);
          }}
        >
          <ArrowDownToLine className="h-4 w-4" />
          Send USDT now ({selectedRows.length})
        </Button>
      </div>

      {lastReport && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          Last batch: {lastReport.succeeded} succeeded, {lastReport.failed} failed.
          {lastReport.failed > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-800">
              {lastReport.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.userId}>
                    User #{r.userId}: {r.error ?? "failed"}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                <th className="px-4 py-3 sm:px-6">
                  <Checkbox
                    checked={allVisibleEligibleSelected}
                    onCheckedChange={(v) => toggleAllVisible(v === true)}
                    aria-label="Select all eligible visible"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  User
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Wallet
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Invested
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Equity
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Withdrawable
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Payout (USDT)
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
                                  prev[u.user_id]?.amount ||
                                  (u.withdrawable > WITHDRAW_FEE ? maxPayoutFromWallet(u.withdrawable).toFixed(2) : ""),
                              },
                            }));
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <div className="font-semibold text-slate-900">{u.name ?? "—"}</div>
                        <div className="text-xs text-slate-500">#{u.user_id}</div>
                        {u.email && (
                          <div className="text-xs text-slate-600">{u.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-900 sm:px-6">
                        {money(u.wallet_balance)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-800 sm:px-6">
                        {u.invested != null ? money(u.invested) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-800 sm:px-6">
                        {money(u.equity)}
                        {u.open_positions > 0 && (
                          <div className="text-[11px] text-amber-800">
                            {u.open_positions} open
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-emerald-800 sm:px-6">
                        {money(u.withdrawable)}
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={!u.eligible}
                          value={st.amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRowState((prev) => ({
                              ...prev,
                              [u.user_id]: { ...st, amount: val },
                            }));
                          }}
                          className="h-9 w-28 font-mono text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        {u.error ? (
                          <span className="text-xs text-red-700">{u.error}</span>
                        ) : u.eligible ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                            Ready
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {blockLabel(u.block_reason)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-9 w-9 animate-spin text-neutral-900" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">No users match your filters.</p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">
              {processNow ? "Send USDT to selected users" : "Queue withdrawal requests"}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {processNow
                ? "USDT will be sent from the admin wallet and each user's in-app balance will be debited after on-chain verification."
                : "Pending withdrawal requests will be created for admin approval on the Withdrawals page."}
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

export default AdminBulkWithdrawPage;
