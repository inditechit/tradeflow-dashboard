import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { RefreshCw, Loader2, Users, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const API_BASE = "https://api.copytradeengine.org/api";

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
  sweep_status: string | null;
  created_at: string;
};

type RechargeStats = {
  success_count: number;
  pending_count: number;
  failed_count: number;
  success_amount_usd: number;
};

function statusPillClass(status: string) {
  switch (String(status).toLowerCase()) {
    case "pending":
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

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<RechargeStats | null>(null);
  const [filterUserId, setFilterUserId] = useState(userIdParam);
  const [activeFilter, setActiveFilter] = useState<number | null>(
    userIdParam && /^\d+$/.test(userIdParam) ? Number(userIdParam) : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(
    async (userId: number | null) => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams();
        if (userId !== null) qs.set("userId", String(userId));
        const res = await fetch(`${API_BASE}/admin/recharge?${qs.toString()}`);
        const data = await res.json();
        if (data.success) {
          setPayments(data.payments ?? []);
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
  }, [searchParams]);

  useEffect(() => {
    fetchPayments(activeFilter);
  }, [activeFilter, fetchPayments]);

  const applyUserFilter = () => {
    const t = filterUserId.trim();
    if (t && !/^\d+$/.test(t)) {
      toast({ title: "Invalid user id", description: "Use numbers only.", variant: "destructive" });
      return;
    }
    if (!t) {
      setSearchParams({});
      return;
    }
    setSearchParams({ userId: t });
  };

  const clearFilter = () => {
    setSearchParams({});
  };

  const titleSuffix = useMemo(() => {
    if (activeFilter === null) return "";
    return ` — user #${activeFilter}`;
  }, [activeFilter]);

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Wallet recharges
            {titleSuffix ? (
              <span className="font-semibold text-slate-600">{titleSuffix}</span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            All wallet top-up attempts (live list). Successful rows credit user wallets after verification.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => fetchPayments(activeFilter)}
          disabled={loading}
          className="gap-2 shrink-0 rounded-xl bg-[#FFD700] text-black hover:bg-[#E6C200] disabled:opacity-70"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="recharge-user-filter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              className="h-10 w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
            />
            <Button type="button" onClick={applyUserFilter} className="h-10 gap-1.5 bg-slate-800 text-white hover:bg-slate-900">
              <Filter className="h-4 w-4" />
              Apply
            </Button>
            {activeFilter !== null && (
              <Button type="button" variant="outline" onClick={clearFilter} className="h-10 gap-1.5">
                <X className="h-4 w-4" />
                Clear
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

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-yellow-200 bg-[#FFF9E6]/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800">Successful</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">{stats.success_count}</p>
            <p className="mt-1 text-xs text-neutral-800/90">Completed recharges in this view</p>
          </div>
          <div className="rounded-2xl border border-yellow-300 bg-yellow-50/60 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Volume (success)</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
              USD{" "}
              {stats.success_amount_usd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-xs text-neutral-900/90">Sum of successful amounts</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Pending</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">{stats.pending_count}</p>
            <p className="mt-1 text-xs text-amber-800/90">Awaiting payment / confirmation</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Failed</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stats.failed_count}</p>
            <p className="mt-1 text-xs text-slate-500">Did not complete</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Email</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Amount</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Method</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Sweep Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6 sm:py-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 transition hover:bg-yellow-50/40">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700 sm:px-6 sm:py-4">{p.id}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <div className="font-semibold text-slate-900">{p.name ?? "—"}</div>
                      <div className="text-xs text-slate-500">User #{p.user_id}</div>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-yellow-800 sm:px-6 sm:py-4">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">{p.payment_method ?? "—"}</td>
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
                        {p.sweep_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
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

      <p className="mt-4 text-center text-xs text-slate-400">Showing up to 500 most recent rows per request.</p>
    </div>
  );
};

export default AdminRechargesPage;
