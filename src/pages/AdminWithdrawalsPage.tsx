import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { API_BASE } from "@/config/api";
import { Link, useSearchParams } from "react-router-dom";
import { AdminUserTradesLink, adminUserTradesPath } from "@/components/admin/AdminUserTradesLink";

type WithdrawalRow = {
  id: number;
  user_id: number;
  amount_usd: string | number;
  fee_usd?: string | number | null;
  trc20_address: string;
  status: string;
  rejection_reason: string | null;
  outbound_tx_hash: string | null;
  created_at: string;
  completed_at: string | null;
  user_name: string | null;
  user_email: string | null;
  user_telegram: string | null;
  admin_initiated?: number | boolean;
  user_total_payout_usd?: string | number | null;
};

type WithdrawStats = {
  completed_count: number;
  pending_count: number;
  rejected_count: number;
  completed_payout_usd: number;
  completed_fee_usd: number;
  completed_total_usd: number;
  pending_payout_usd: number;
};

type StatusFilter = "pending" | "all" | "completed" | "rejected";

function statusClass(s: string) {
  const x = String(s).toLowerCase();
  if (x === "completed") return "border-yellow-200 bg-[#FFF9E6] text-neutral-900";
  if (x === "pending") return "border-amber-200 bg-amber-50 text-amber-900";
  if (x === "cancelled") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-red-200 bg-red-50 text-red-900";
}

function money(n: number) {
  return `USD ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const AdminWithdrawalsPage = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get("userId")?.trim() ?? "";
  const statusParam = String(searchParams.get("status") ?? "pending").toLowerCase();

  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [stats, setStats] = useState<WithdrawStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>(
    statusParam === "all" || statusParam === "completed" || statusParam === "rejected"
      ? statusParam
      : "pending",
  );
  const [activeUserId, setActiveUserId] = useState<number | null>(
    userIdParam && /^\d+$/.test(userIdParam) ? Number(userIdParam) : null,
  );

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  const [txFixOpen, setTxFixOpen] = useState(false);
  const [txFixId, setTxFixId] = useState<number | null>(null);
  const [txFixHash, setTxFixHash] = useState("");
  const [txFixBusy, setTxFixBusy] = useState(false);
  const [page, setPage] = useState(1);
  const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;
  const WITHDRAW_FEE = 5;
  const MIN_PAYOUT = 10;

  const [createOpen, setCreateOpen] = useState(false);
  const [createUserId, setCreateUserId] = useState<number | null>(null);
  const [createAmount, setCreateAmount] = useState("");
  const [createSendOnChain, setCreateSendOnChain] = useState(true);
  const [createTxHash, setCreateTxHash] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [userHistoryOpen, setUserHistoryOpen] = useState(false);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);
  const [userHistoryRows, setUserHistoryRows] = useState<WithdrawalRow[]>([]);
  const [userHistoryMeta, setUserHistoryMeta] = useState<{
    userId: number;
    name: string | null;
    totalPayout: number;
  } | null>(null);

  const setPageInUrl = (pageNum: number) => {
    const next = new URLSearchParams(searchParams);
    if (pageNum <= 1) next.delete("page");
    else next.set("page", String(pageNum));
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(
    async (pageNum = 1, status: StatusFilter = filter, userId: number | null = activeUserId) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (status !== "all") qs.set("status", status);
        if (userId != null) qs.set("userId", String(userId));
        qs.set("page", String(pageNum));
        qs.set("limit", String(pageSize));
        const res = await fetch(`${API_BASE}/admin/withdrawals?${qs.toString()}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.withdrawals)) {
          setRows(data.withdrawals);
          setTotal(Number(data.total ?? data.withdrawals.length));
          setPage(Number(data.page ?? pageNum));
          if (data.stats) {
            setStats({
              completed_count: Number(data.stats.completed_count ?? 0),
              pending_count: Number(data.stats.pending_count ?? 0),
              rejected_count: Number(data.stats.rejected_count ?? 0),
              completed_payout_usd: Number(data.stats.completed_payout_usd ?? 0),
              completed_fee_usd: Number(data.stats.completed_fee_usd ?? 0),
              completed_total_usd: Number(data.stats.completed_total_usd ?? 0),
              pending_payout_usd: Number(data.stats.pending_payout_usd ?? 0),
            });
          } else {
            setStats(null);
          }
        } else {
          setRows([]);
          setStats(null);
          if (data.error) {
            toast({ title: "Error", description: data.error, variant: "destructive" });
          }
        }
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [filter, activeUserId, toast],
  );

  useEffect(() => {
    const uid = searchParams.get("userId")?.trim() ?? "";
    const st = String(searchParams.get("status") ?? "pending").toLowerCase();
    const nextStatus: StatusFilter =
      st === "all" || st === "completed" || st === "rejected" ? st : "pending";
    const nextUser = uid && /^\d+$/.test(uid) ? Number(uid) : null;
    setFilter(nextStatus);
    setActiveUserId(nextUser);
  }, [searchParams]);

  useEffect(() => {
    setPage(pageFromUrl);
    void load(pageFromUrl, filter, activeUserId);
  }, [pageFromUrl, filter, activeUserId, load]);

  const setStatusAndUrl = (status: StatusFilter) => {
    const next = new URLSearchParams(searchParams);
    if (status === "pending") next.delete("status");
    else next.set("status", status);
    next.delete("page");
    setSearchParams(next);
  };

  const applyUserFilter = (userId: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (userId == null) next.delete("userId");
    else {
      next.set("userId", String(userId));
      // Show all of that user's withdrawals when filtering by user
      next.set("status", "all");
    }
    next.delete("page");
    setSearchParams(next);
  };

  const clearUserFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("userId");
    next.delete("page");
    setSearchParams(next);
  };

  const openUserWithdrawals = async (row: WithdrawalRow) => {
    const userId = Number(row.user_id);
    if (!Number.isFinite(userId) || userId <= 0) return;
    setUserHistoryOpen(true);
    setUserHistoryLoading(true);
    setUserHistoryMeta({
      userId,
      name: row.user_name ?? null,
      totalPayout: Number(row.user_total_payout_usd ?? 0),
    });
    setUserHistoryRows([]);
    try {
      const qs = new URLSearchParams({
        status: "all",
        userId: String(userId),
        page: "1",
        limit: "200",
      });
      const res = await fetch(`${API_BASE}/admin/withdrawals?${qs}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      setUserHistoryRows(Array.isArray(data.withdrawals) ? data.withdrawals : []);
    } catch (e) {
      toast({
        title: "Could not load withdrawals",
        description: e instanceof Error ? e.message : "Network error",
        variant: "destructive",
      });
      setUserHistoryOpen(false);
    } finally {
      setUserHistoryLoading(false);
    }
  };

  const titleSuffix = useMemo(() => {
    if (activeUserId == null) return "";
    return ` — user #${activeUserId}`;
  }, [activeUserId]);


const openApprove = (id: number) => {
  setApproveId(id);
  setApproveOpen(true);
};


const confirmApprove = async () => {
  if (approveId == null) return;
  setApproveBusy(true);

  try {
    // 1. Notice the body is now empty {} 
    // The backend will generate the tx hash itself
    const res = await fetch(`${API_BASE}/admin/withdrawals/${approveId}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), 
    });

    const data = await res.json();

    if (data.success) {
     toast({
  title: "Withdrawal Completed",
  description: `USDT sent successfully. TX: ${data.txHash.slice(0, 12)}...`,
});
      setApproveOpen(false);
      void load(page); // Refresh the table
    } else {
      // If the Admin wallet is out of Energy or USDT, it shows the error here
      toast({ 
        title: "Payout Failed", 
        description: data.error ?? "Blockchain error", 
        variant: "destructive" 
      });
    }
  } catch (err) {
    toast({ title: "Network error", variant: "destructive" });
  } finally {
    setApproveBusy(false);
  }
};

  const openReject = (id: number) => {
    setRejectId(id);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (rejectId == null) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ title: "Enter a reason", variant: "destructive" });
      return;
    }
    setRejectBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${rejectId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Request rejected" });
        setRejectOpen(false);
        void load(page);
      } else {
        toast({ title: "Failed", description: data.error ?? "", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setRejectBusy(false);
    }
  };

  const confirmCreate = async () => {
    if (createUserId == null) {
      toast({ title: "Select a user", variant: "destructive" });
      return;
    }
    const amt = Number(createAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!createSendOnChain && !createTxHash.trim()) {
      toast({
        title: "Transaction hash required",
        description: "Paste the outbound TRC20 tx hash or enable automatic send.",
        variant: "destructive",
      });
      return;
    }
    setCreateBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: createUserId,
          amount: amt,
          sendOnChain: createSendOnChain,
          outbound_tx_hash: createTxHash.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const payout = Number(data.payoutAmount ?? data.amount ?? amt);
        const fee = Number(data.feeUsd ?? WITHDRAW_FEE);
        const total = Number(data.totalDebit ?? payout + fee);
        toast({
          title: "Withdrawal completed",
          description: data.txHash
            ? `Sent $${payout.toFixed(2)} (+ $${fee.toFixed(2)} fee, $${total.toFixed(2)} from wallet) · TX ${String(data.txHash).slice(0, 12)}…`
            : `Processed $${payout.toFixed(2)} (+ $${fee.toFixed(2)} fee)`,
        });
        setCreateOpen(false);
        setCreateUserId(null);
        setCreateAmount("");
        setCreateTxHash("");
        void load(page);
      } else {
        toast({
          title: "Withdrawal failed",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCreateBusy(false);
    }
  };

  const openTxFix = (id: number) => {
    setTxFixId(id);
    setTxFixHash("");
    setTxFixOpen(true);
  };

  const confirmTxFix = async () => {
    if (txFixId == null) return;
    const h = txFixHash.trim();
    if (!h) {
      toast({ title: "Enter transaction id", variant: "destructive" });
      return;
    }
    setTxFixBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${txFixId}/tx`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outbound_tx_hash: h.slice(0, 128) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Tx saved" });
        setTxFixOpen(false);
        void load(page);
      } else {
        toast({ title: "Failed", description: data.error ?? "", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setTxFixBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <ArrowDownToLine className="h-8 w-8 shrink-0 text-neutral-900" aria-hidden />
            Withdrawal requests
            {titleSuffix ? (
              <span className="font-semibold text-slate-600">{titleSuffix}</span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Approve to automatically send USDT (TRC20) to the user&apos;s wallet and deduct their
            in-app balance after successful blockchain verification.{" "}
            <Link to="/admin/bulk-withdraw" className="font-semibold text-neutral-800 underline">
              Bulk withdraw
            </Link>{" "}
            for multi-user payouts.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2 rounded-xl bg-[#FFD700] text-black hover:bg-[#E6C200]"
            onClick={() => {
              setCreateUserId(null);
              setCreateAmount("");
              setCreateTxHash("");
              setCreateSendOnChain(true);
              setCreateOpen(true);
            }}
          >
            <Plus size={18} />
            Pay user
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load(page)}
            disabled={loading}
            className="gap-2 shrink-0 rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-70"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pending", "Pending"],
              ["all", "All"],
              ["completed", "Completed"],
              ["rejected", "Rejected"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={filter === key ? "default" : "outline"}
              className={filter === key ? "bg-slate-800 text-white" : ""}
              onClick={() => setStatusAndUrl(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1 sm:max-w-md">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter by user
            </label>
            <UserSearchSelect
              value={activeUserId}
              onChange={(id) => applyUserFilter(id)}
              placeholder="Search name, email, or ID…"
              showClearOption
              clearOptionLabel="All users"
            />
          </div>
          {activeUserId !== null && (
            <>
              <Button type="button" variant="outline" onClick={clearUserFilter} className="h-10 gap-1.5">
                <X className="h-4 w-4" />
                Clear user
              </Button>
              <Link
                to={adminUserTradesPath(activeUserId)}
                className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 text-sm font-semibold text-neutral-900 hover:bg-yellow-100"
              >
                <Users className="h-4 w-4" />
                Open user trades
              </Link>
            </>
          )}
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusAndUrl("completed")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              filter === "completed"
                ? "border-yellow-400 ring-2 ring-yellow-300/60"
                : "border-yellow-300"
            } bg-yellow-50/60`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
              Total withdrawn{activeUserId != null ? ` · #${activeUserId}` : ""}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
              {money(stats.completed_payout_usd)}
            </p>
            <p className="mt-1 text-xs text-neutral-900/90">
              {stats.completed_count} completed · click to filter
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStatusAndUrl("pending")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              filter === "pending"
                ? "border-amber-400 ring-2 ring-amber-300/60"
                : "border-amber-200"
            } bg-amber-50/60`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Pending</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">{stats.pending_count}</p>
            <p className="mt-1 text-xs text-amber-800/90">
              {money(stats.pending_payout_usd)} payout · click to filter
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStatusAndUrl("completed")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              filter === "completed"
                ? "border-yellow-400 ring-2 ring-yellow-300/60"
                : "border-yellow-200"
            } bg-[#FFF9E6]/90`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800">Completed</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">{stats.completed_count}</p>
            <p className="mt-1 text-xs text-neutral-800/90">Click to filter completed</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusAndUrl("rejected")}
            className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
              filter === "rejected"
                ? "border-red-400 ring-2 ring-red-300/60"
                : "border-red-200"
            } bg-red-50/60`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Rejected</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-red-900">{stats.rejected_count}</p>
            <p className="mt-1 text-xs text-red-800/90">Click to filter rejected</p>
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  User total
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Payout</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Fee</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Total</th>
                <th className="px-4 py-3 text-xs font-bold tracking-wide text-slate-600 sm:px-6">trc20 address</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Created</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((r) => {
                  const payout = Number(r.amount_usd);
                  const fee = Number(r.fee_usd ?? 0);
                  const rowTotal = Math.round((payout + fee) * 100) / 100;
                  const userTotal = Number(r.user_total_payout_usd ?? 0);
                  return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-yellow-50/40">
                    <td className="px-4 py-3 font-mono text-sm text-slate-700 sm:px-6">{r.id}</td>
                    <td className="px-4 py-3 sm:px-6">
                      <AdminUserTradesLink
                        userId={r.user_id}
                        name={r.user_name ?? "—"}
                        className="font-semibold"
                        showId
                      />
                      <div className="break-all text-xs text-slate-600">{r.user_email}</div>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <button
                        type="button"
                        onClick={() => void openUserWithdrawals(r)}
                        className="font-semibold tabular-nums text-emerald-800 underline-offset-2 hover:underline"
                        title="View all withdrawals for this user"
                      >
                        ${userTotal.toFixed(2)}
                      </button>
                      <div className="text-[11px] text-slate-500">completed · click to view</div>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-neutral-800 sm:px-6">
                      ${payout.toFixed(2)}
                      {r.admin_initiated ? (
                        <span className="ml-2 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          Admin
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 sm:px-6">
                      {fee > 0 ? `$${fee.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-neutral-800 sm:px-6">
                      ${rowTotal.toFixed(2)}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 sm:px-6">
                      <span className="break-all font-mono text-xs text-slate-800">{r.trc20_address}</span>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusClass(r.status)}`}
                      >
                        {r.status}
                      </span>
                      {r.outbound_tx_hash && (
                        <a
                          href={`https://tronscan.org/#/transaction/${encodeURIComponent(r.outbound_tx_hash)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all font-mono text-[11px] text-neutral-800 underline"
                        >
                          Tx
                        </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                        {r.status === "pending" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="gap-1 bg-[#FFD700] text-black hover:bg-[#E6C200]"
                              onClick={() => openApprove(r.id)}
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1 border-red-200 text-red-800 hover:bg-red-50"
                              onClick={() => openReject(r.id)}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                        {/* {r.status === "completed" && !r.outbound_tx_hash && (
                          <Button type="button" size="sm" variant="secondary" onClick={() => openTxFix(r.id)}>
                            <Search className="mr-1 h-4 w-4" />
                            Add tx
                          </Button>
                        )} */}
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
        {!loading && rows.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">No rows.</p>
        )}
      </div>

      <ListPaginationBar
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        total={total}
        pageSize={pageSize}
        onPageChange={(p) => setPageInUrl(p)}
        itemLabel="withdrawals"
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Pay user (admin withdrawal)</DialogTitle>
            <DialogDescription className="text-slate-600">
              Enter the USDT payout amount sent to the user&apos;s TRC20 address. A ${WITHDRAW_FEE}{" "}
              processing fee is debited from their wallet in addition to the payout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-slate-800">User</Label>
              <UserSearchSelect
                value={createUserId}
                onChange={(id) => setCreateUserId(id)}
                showClearOption={false}
                placeholder="Search user…"
              />
            </div>
            <div>
              <Label htmlFor="admin-wd-amt" className="text-slate-800">
                Payout amount (USDT sent)
              </Label>
              <Input
                id="admin-wd-amt"
                type="number"
                min={MIN_PAYOUT}
                step="0.01"
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                className="mt-1 border-slate-200"
              />
              {Number(createAmount) > 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  User receives{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    ${Number(createAmount).toFixed(2)}
                  </span>
                  {" · "}
                  Fee{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    ${WITHDRAW_FEE.toFixed(2)}
                  </span>
                  {" · "}
                  Total from wallet{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    ${(Number(createAmount) + WITHDRAW_FEE).toFixed(2)}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Minimum payout ${MIN_PAYOUT}. Wallet is debited payout + ${WITHDRAW_FEE} fee.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createSendOnChain}
                onChange={(e) => setCreateSendOnChain(e.target.checked)}
                className="rounded border-slate-300"
              />
              Send USDT automatically from admin wallet
            </label>
            {!createSendOnChain && (
              <div>
                <Label htmlFor="admin-wd-tx" className="text-slate-800">
                  Outbound TRC20 tx hash
                </Label>
                <Input
                  id="admin-wd-tx"
                  value={createTxHash}
                  onChange={(e) => setCreateTxHash(e.target.value)}
                  placeholder="Paste after manual send"
                  className="mt-1 font-mono text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
              disabled={createBusy}
              onClick={() => void confirmCreate()}
            >
              {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send &amp; debit wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Approve withdrawal</DialogTitle>
          <DialogDescription className="text-slate-600">
  This will automatically send USDT from the admin wallet to the user's TRC20 address. The request will only be completed after the blockchain transaction is verified.
</DialogDescription>
          </DialogHeader>
          {/* <div className="space-y-2 py-2">
            <Label htmlFor="ap-tx" className="text-slate-800">
              Outbound tx hash (optional)
            </Label>
            <Input
              id="ap-tx"
              value={approveTx}
              onChange={(e) => setApproveTx(e.target.value)}
              placeholder="Paste after sending on-chain"
              className="border-slate-200 bg-white font-mono text-sm text-slate-900"
            />
          </div> */}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
              disabled={approveBusy}
              onClick={confirmApprove}
            >
              {approveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Reject withdrawal</DialogTitle>
            <DialogDescription>The user will see this reason. Their balance is not changed.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason"
            className="min-h-[100px]"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectBusy}
              onClick={confirmReject}
            >
              {rejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={txFixOpen} onOpenChange={setTxFixOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Add transaction id</DialogTitle>
            <DialogDescription>For a completed payout, record the Tron transaction hash.</DialogDescription>
          </DialogHeader>
          <Input
            value={txFixHash}
            onChange={(e) => setTxFixHash(e.target.value)}
            className="font-mono text-sm"
            placeholder="Tx hash"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setTxFixOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={txFixBusy} onClick={confirmTxFix}>
              {txFixBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userHistoryOpen} onOpenChange={setUserHistoryOpen}>
        <DialogContent className="max-h-[85vh] border-slate-200 bg-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-black">
              Withdrawals
              {userHistoryMeta
                ? ` · ${userHistoryMeta.name ?? `User #${userHistoryMeta.userId}`}`
                : ""}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {userHistoryMeta
                ? `User #${userHistoryMeta.userId} · completed total ${money(userHistoryMeta.totalPayout)}`
                : "All withdrawal requests for this user"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
            {userHistoryLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : userHistoryRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">No withdrawals found</div>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-xs font-bold uppercase text-slate-600">ID</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase text-slate-600">Payout</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase text-slate-600">Fee</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase text-slate-600">Total</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase text-slate-600">Status</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase text-slate-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {userHistoryRows.map((hr) => {
                    const payout = Number(hr.amount_usd);
                    const fee = Number(hr.fee_usd ?? 0);
                    const rowTotal = Math.round((payout + fee) * 100) / 100;
                    return (
                      <tr key={hr.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-mono text-slate-700">{hr.id}</td>
                        <td className="px-3 py-2 font-semibold tabular-nums">${payout.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">
                          {fee > 0 ? `$${fee.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2 font-semibold tabular-nums">${rowTotal.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(hr.status)}`}
                          >
                            {hr.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          {hr.created_at
                            ? new Date(String(hr.created_at).replace(" ", "T")).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUserHistoryOpen(false)}>
              Close
            </Button>
            {userHistoryMeta ? (
              <Button
                type="button"
                className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
                onClick={() => {
                  applyUserFilter(userHistoryMeta.userId);
                  setUserHistoryOpen(false);
                }}
              >
                Filter main table
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawalsPage;
