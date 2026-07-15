import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { RefreshCw, Loader2, Users, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { API_BASE } from "@/config/api";

type PaymentRow = {
  id: number;
  user_id: number;
  name: string | null;
  email: string | null;
  amount: string | number;
  status: string;
  tx_hash: string | null;
  package_id: string;
  payment_method: string | null;
  wallet_address: string | null;
  sweep_status: string | null;
  trx_reclaim_status?: string | null;
  usdt_reclaim_status?: string | null;
  funds_reclaim_status?: string | null;
  created_at: string;
};

type TempBalances = {
  trx: number;
  usdt: number;
  wallet?: string;
  loading?: boolean;
  error?: string;
};

type RechargeStats = {
  success_count: number;
  pending_count: number;
  failed_count: number;
  success_amount_usd: number;
};

type StatusFilter = "all" | "success" | "pending" | "failed";
type SweepFilter = "all" | "success" | "pending" | "failed" | "processing" | "none";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "success", label: "Success" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

const SWEEP_FILTERS: { key: SweepFilter; label: string }[] = [
  { key: "all", label: "All sweeps" },
  { key: "success", label: "Sweep success" },
  { key: "failed", label: "Sweep failed" },
  { key: "pending", label: "Sweep pending" },
  { key: "processing", label: "Sweep processing" },
  { key: "none", label: "No sweep" },
];

function parseStatusFilter(raw: string | null): StatusFilter {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "success" || s === "pending" || s === "failed") return s;
  return "all";
}

function parseSweepFilter(raw: string | null): SweepFilter {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "success" || s === "pending" || s === "failed" || s === "processing" || s === "none") {
    return s;
  }
  return "all";
}

function rowCreatedMs(createdAt: string | null | undefined) {
  if (!createdAt) return 0;
  const ms = new Date(createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function statusPillClass(status: string | null | undefined) {
  switch (String(status ?? "").toLowerCase()) {
    case "pending":
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "success":
      return "border-yellow-200 bg-[#FFF9E6] text-neutral-900";
    case "failed":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

const AdminRechargesPage = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get("userId")?.trim() ?? "";
  const statusParam = parseStatusFilter(searchParams.get("status"));
  const sweepParam = parseSweepFilter(searchParams.get("sweepStatus"));

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<RechargeStats | null>(null);
  const [filterUserId, setFilterUserId] = useState(userIdParam);
  const [activeFilter, setActiveFilter] = useState<number | null>(
    userIdParam && /^\d+$/.test(userIdParam) ? Number(userIdParam) : null,
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(statusParam);
  const [sweepFilter, setSweepFilter] = useState<SweepFilter>(sweepParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creditingId, setCreditingId] = useState<number | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [reclaimingId, setReclaimingId] = useState<number | null>(null);
  const [pullingAllTrx, setPullingAllTrx] = useState(false);
  const [balancesById, setBalancesById] = useState<Record<number, TempBalances>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  const fetchPayments = useCallback(
    async (
      userId: number | null,
      status: StatusFilter,
      sweep: SweepFilter,
      pageNum = 1,
    ) => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams();
        if (userId !== null) qs.set("userId", String(userId));
        if (status !== "all") qs.set("status", status);
        if (sweep !== "all") qs.set("sweepStatus", sweep);
        qs.set("page", String(pageNum));
        qs.set("limit", String(pageSize));
        const res = await fetch(`${API_BASE}/admin/recharge?${qs.toString()}`);
        const data = await res.json();
        if (data.success) {
          const rows = (data.payments ?? []) as PaymentRow[];
          rows.sort((a, b) => {
            const diff = rowCreatedMs(b.created_at) - rowCreatedMs(a.created_at);
            if (diff !== 0) return diff;
            return Number(b.id) - Number(a.id);
          });
          setPayments(rows);
          setTotal(Number(data.total ?? rows.length ?? 0));
          setPage(Number(data.page ?? pageNum));
          if (data.stats) {
            setStats({
              success_count: Number(data.stats.success_count ?? 0),
              pending_count: Number(data.stats.pending_count ?? 0),
              failed_count: Number(data.stats.failed_count ?? 0),
              success_amount_usd: Number(data.stats.success_amount_usd ?? 0),
            });
          } else {
            setStats(null);
          }
        } else {
          setError(data.error || "Failed to fetch recharges");
          setPayments([]);
          setStats(null);
        }
      } catch {
        setError("Server connection error");
        toast({
          title: "Error",
          description: "Unable to fetch recharge records",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const uid = searchParams.get("userId")?.trim();
    if (uid && /^\d+$/.test(uid)) {
      setActiveFilter(Number(uid));
      setFilterUserId(uid);
    } else {
      setActiveFilter(null);
      setFilterUserId("");
    }
    setStatusFilter(parseStatusFilter(searchParams.get("status")));
    setSweepFilter(parseSweepFilter(searchParams.get("sweepStatus")));
  }, [searchParams]);

  useEffect(() => {
    fetchPayments(activeFilter, statusFilter, sweepFilter, 1);
  }, [activeFilter, statusFilter, sweepFilter, fetchPayments]);

  const applyUserFilter = () => {
    const t = filterUserId.trim();
    if (t && !/^\d+$/.test(t)) {
      toast({ title: "Invalid user id", description: "Use numbers only.", variant: "destructive" });
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (!t) next.delete("userId");
    else next.set("userId", t);
    setSearchParams(next);
  };

  const clearUserFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("userId");
    setSearchParams(next);
  };

  const setStatusFilterAndUrl = (status: StatusFilter) => {
    const next = new URLSearchParams(searchParams);
    if (status === "all") next.delete("status");
    else next.set("status", status);
    setSearchParams(next);
  };

  const setSweepFilterAndUrl = (sweep: SweepFilter) => {
    const next = new URLSearchParams(searchParams);
    if (sweep === "all") next.delete("sweepStatus");
    else next.set("sweepStatus", sweep);
    setSearchParams(next);
  };

  const checkBalances = async (paymentId: number) => {
    setCheckingId(paymentId);
    setBalancesById((prev) => ({
      ...prev,
      [paymentId]: { ...(prev[paymentId] ?? { trx: 0, usdt: 0 }), loading: true },
    }));
    try {
      const res = await fetch(`${API_BASE}/admin/recharge/${paymentId}/temp-balances`);
      const data = await res.json();
      if (!data.success) {
        setBalancesById((prev) => ({
          ...prev,
          [paymentId]: { trx: 0, usdt: 0, error: data.error || "Failed", loading: false },
        }));
        toast({
          title: "Balance check failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      const b = data.balances;
      setBalancesById((prev) => ({
        ...prev,
        [paymentId]: {
          trx: Number(b.trx ?? 0),
          usdt: Number(b.usdt ?? 0),
          wallet: b.wallet,
          loading: false,
        },
      }));
    } catch {
      setBalancesById((prev) => ({
        ...prev,
        [paymentId]: { trx: 0, usdt: 0, error: "Server error", loading: false },
      }));
      toast({ title: "Error", description: "Could not read chain balances", variant: "destructive" });
    } finally {
      setCheckingId(null);
    }
  };

  const reclaimFunds = async (paymentId: number, mode: "auto" | "trx" = "auto") => {
    setReclaimingId(paymentId);
    try {
      const res = await fetch(`${API_BASE}/admin/recharge/${paymentId}/reclaim-funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Reclaim failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      const after = data.after;
      const result = data.result || {};
      toast({
        title: mode === "trx" ? "TRX reclaimed" : "Funds reclaimed",
        description:
          `Mode: ${data.mode}. ` +
          `TRX sent: ${Number(result.trxSent || result.sendBackTRX || 0).toFixed(4)}. ` +
          `USDT sent: ${Number(result.usdtSent || 0).toFixed(2)}. ` +
          (after
            ? `Left: ${Number(after.trx ?? 0).toFixed(4)} TRX / ${Number(after.usdt ?? 0).toFixed(2)} USDT`
            : ""),
      });
      if (after) {
        setBalancesById((prev) => ({
          ...prev,
          [paymentId]: {
            trx: Number(after.trx ?? 0),
            usdt: Number(after.usdt ?? 0),
            wallet: after.wallet,
            loading: false,
          },
        }));
      }
      await fetchPayments(activeFilter, statusFilter, sweepFilter, page);
    } catch {
      toast({ title: "Error", description: "Server error during reclaim", variant: "destructive" });
    } finally {
      setReclaimingId(null);
    }
  };

  const pullAllLeftoverTrx = async () => {
    setPullingAllTrx(true);
    try {
      const res = await fetch(`${API_BASE}/admin/temp-wallets/trx-reclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, force: true, limit: 40, trxOnly: true }),
      });
      const data = await res.json();
      if (!data.success && data.ok === false) {
        toast({
          title: "Bulk TRX reclaim failed",
          description: data.error || data.reason || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Bulk TRX reclaim done",
        description: `Scanned ${data.scanned ?? 0}, reclaimed ${data.reclaimed ?? 0}, sent ${Number(data.sentTotalTrx ?? 0).toFixed(4)} TRX, failed ${data.failed ?? 0}`,
      });
      await fetchPayments(activeFilter, statusFilter, sweepFilter, page);
    } catch {
      toast({ title: "Error", description: "Bulk TRX reclaim failed", variant: "destructive" });
    } finally {
      setPullingAllTrx(false);
    }
  };

  const creditWalletForPayment = async (paymentId: number) => {
    setCreditingId(paymentId);
    try {
      const res = await fetch(`${API_BASE}/admin/recharge/${paymentId}/credit-wallet`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Could not credit wallet",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: data.alreadyCredited ? "Already credited" : "Wallet credited",
        description: data.alreadyCredited
          ? `Balance is $${Number(data.balanceAfter).toFixed(2)}`
          : `Added funds — balance now $${Number(data.balanceAfter).toFixed(2)}`,
      });
      await fetchPayments(activeFilter, statusFilter, sweepFilter, page);
    } catch {
      toast({ title: "Error", description: "Server error", variant: "destructive" });
    } finally {
      setCreditingId(null);
    }
  };

  const titleSuffix = useMemo(() => {
    if (activeFilter === null) return "";
    return ` — user #${activeFilter}`;
  }, [activeFilter]);

  const statusLabel = useMemo(() => {
    if (statusFilter === "all") return "";
    return ` · ${statusFilter}`;
  }, [statusFilter]);

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Wallet recharges
            {titleSuffix ? (
              <span className="font-semibold text-slate-600">{titleSuffix}</span>
            ) : null}
            {statusLabel ? (
              <span className="font-semibold capitalize text-slate-600">{statusLabel}</span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Check temp-wallet TRX/USDT, reclaim leftover gas, filter by payment or sweep status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => void pullAllLeftoverTrx()}
            disabled={pullingAllTrx || loading}
            className="gap-2 rounded-xl"
          >
            {pullingAllTrx ? <Loader2 size={18} className="animate-spin" /> : null}
            Pull all leftover TRX
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => fetchPayments(activeFilter, statusFilter, sweepFilter, page)}
            disabled={loading}
            className="gap-2 rounded-xl bg-[#FFD700] text-black hover:bg-[#E6C200] disabled:opacity-70"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                type="button"
                variant={statusFilter === f.key ? "default" : "outline"}
                className={
                  statusFilter === f.key
                    ? "bg-slate-800 text-white hover:bg-slate-900"
                    : "border-slate-200"
                }
                onClick={() => setStatusFilterAndUrl(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sweep status</p>
          <div className="flex flex-wrap gap-2">
            {SWEEP_FILTERS.map((f) => (
              <Button
                key={f.key}
                type="button"
                size="sm"
                variant={sweepFilter === f.key ? "default" : "outline"}
                className={
                  sweepFilter === f.key
                    ? "bg-slate-700 text-white hover:bg-slate-800"
                    : "border-slate-200"
                }
                onClick={() => setSweepFilterAndUrl(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="recharge-user-filter"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Filter by user ID
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="recharge-user-filter"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 42"
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyUserFilter();
                }}
                className="h-10 w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
              />
              <Button
                type="button"
                onClick={applyUserFilter}
                className="h-10 gap-1.5 bg-slate-800 text-white hover:bg-slate-900"
              >
                <Filter className="h-4 w-4" />
                Apply
              </Button>
              {activeFilter !== null && (
                <Button type="button" variant="outline" onClick={clearUserFilter} className="h-10 gap-1.5">
                  <X className="h-4 w-4" />
                  Clear user
                </Button>
              )}
            </div>
          </div>
          {activeFilter !== null && (
            <Link
              to={`/admin/user-profile/${activeFilter}`}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 text-sm font-semibold text-neutral-900 hover:bg-yellow-100"
            >
              <Users className="h-4 w-4" />
              Open user profile
            </Link>
          )}
        </div>
      </div>

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilterAndUrl("success")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "success"
                ? "border-yellow-400 ring-2 ring-yellow-300/60"
                : "border-yellow-200"
            } bg-[#FFF9E6]/90`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800">Successful</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">{stats.success_count}</p>
            <p className="mt-1 text-xs text-neutral-800/90">Click to filter success</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilterAndUrl("success")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "success"
                ? "border-yellow-400 ring-2 ring-yellow-300/60"
                : "border-yellow-300"
            } bg-yellow-50/60`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Volume (success)</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
              USD{" "}
              {stats.success_amount_usd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-xs text-neutral-900/90">Sum of successful amounts</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilterAndUrl("pending")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "pending"
                ? "border-amber-400 ring-2 ring-amber-300/60"
                : "border-amber-200"
            } bg-amber-50/60`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Pending</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">{stats.pending_count}</p>
            <p className="mt-1 text-xs text-amber-800/90">Click to filter pending</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilterAndUrl("failed")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              statusFilter === "failed"
                ? "border-slate-400 ring-2 ring-slate-300/60"
                : "border-slate-200"
            } bg-slate-50/80`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Failed</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.failed_count}</p>
            <p className="mt-1 text-xs text-slate-500">Click to filter failed</p>
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Amount</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Sweep</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Temp TRX / USDT</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Created</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                payments.map((p) => {
                  const bal = balancesById[p.id];
                  const hasWallet = !!p.wallet_address;
                  return (
                    <tr key={p.id} className="border-b border-slate-100 transition hover:bg-yellow-50/40">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700 sm:px-6 sm:py-4">
                        {p.id}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <div className="font-semibold text-slate-900">{p.name ?? "—"}</div>
                        <div className="text-xs text-slate-500">User #{p.user_id}</div>
                        {p.wallet_address ? (
                          <div className="mt-0.5 max-w-[160px] truncate font-mono text-[10px] text-slate-400" title={p.wallet_address}>
                            {p.wallet_address}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-yellow-800 sm:px-6 sm:py-4">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusPillClass(p.status)}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusPillClass(p.sweep_status)}`}
                        >
                          {p.sweep_status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm sm:px-6 sm:py-4">
                        {bal?.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : bal ? (
                          <div className="tabular-nums text-slate-800">
                            <div>{Number(bal.trx).toFixed(4)} TRX</div>
                            <div>{Number(bal.usdt).toFixed(2)} USDT</div>
                            {bal.error ? <div className="text-xs text-red-500">{bal.error}</div> : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not checked</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6 sm:py-4">
                        <div className="flex flex-col items-end gap-1.5">
                          {hasWallet ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={checkingId === p.id}
                                className="h-8 text-xs font-semibold"
                                onClick={() => void checkBalances(p.id)}
                              >
                                {checkingId === p.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Check balances"
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={reclaimingId === p.id}
                                className="h-8 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-900"
                                onClick={() => void reclaimFunds(p.id, "auto")}
                                title="If USDT: send 15 TRX gas → USDT → leftover TRX. If only TRX: pull TRX to admin."
                              >
                                {reclaimingId === p.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Reclaim funds"
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={reclaimingId === p.id}
                                className="h-7 text-[11px] text-slate-600"
                                onClick={() => void reclaimFunds(p.id, "trx")}
                              >
                                Pull TRX only
                              </Button>
                            </>
                          ) : null}
                          {String(p.status).toLowerCase() === "success" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={creditingId === p.id}
                              className="h-8 text-xs font-semibold"
                              onClick={() => void creditWalletForPayment(p.id)}
                            >
                              {creditingId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Credit wallet"
                              )}
                            </Button>
                          ) : null}
                          {!hasWallet && String(p.status).toLowerCase() !== "success" ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : null}
                        </div>
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
        {!loading && payments.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">No recharge rows match this filter.</p>
        )}
      </div>

      <ListPaginationBar
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        total={total}
        pageSize={pageSize}
        onPageChange={(p) => void fetchPayments(activeFilter, statusFilter, sweepFilter, p)}
        itemLabel="recharges"
      />
    </div>
  );
};

export default AdminRechargesPage;
