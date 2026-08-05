import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, RefreshCw, AlertTriangle, Pencil } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { exportUserTradesToExcel } from "@/utils/exportUserTradesExcel";
import { useToast } from "@/hooks/use-toast";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import { packageDisplayName } from "@/constants/packages";
import { isSubscriptionPackageId } from "@/utils/packageDuration";
import {
  buildUserMistakeInsights,
  type ManualStopSettlementRow,
  type MistakeInsight,
} from "@/utils/adminUserMistakeInsights";
import { MaskedPii } from "@/components/admin/AdminPiiReveal";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
import {
  fmtMt5Price,
  formatMt5SideLabel,
  resolveMt5BuySellPrices,
  resolveEffectiveSlice,
  isOpenTrade,
  isTradeClosed,
  isUserStoppedTrade,
  rowUserFacingPl,
  tradeEffectiveCloseAt,
  buildSequentialUserFacingPlMap,
  sumUserFacingPlTotals,
  sortTradesChronological,
  proportionalRawPl,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { plTextClass } from "@/utils/plColors";
import { UserStoppedTradeBadge } from "@/components/trades/UserStoppedTradeBadge";

type UserTradeRow = UserTradeRowLike & {
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
  reserved_exposure_usd?: number | null;
  admin_exposure_usd?: number | null;
  admin_absorbed_pl_usd?: number | null;
  admin_share_usd?: number | null;
};

type StatusFilter = "all" | "open" | "closed";

type PaymentRow = {
  id: number | string;
  package_id: string;
  package_name?: string;
  status: string;
  amount: number | string;
  payment_method?: string;
  tx_hash?: string | null;
  created_at?: string | null;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function tradeOpenedAt(r: UserTradeRow): string {
  return formatIsoDateTime(r.open_time ?? r.assignment_created_at ?? null);
}

function tradeClosedAt(r: UserTradeRow): string {
  if (!isTradeClosed(r)) return "—";
  return formatIsoDateTime(tradeEffectiveCloseAt(r));
}

const AdminUserTradesPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [equity, setEquity] = useState(0);
  const [feePerLotUsd, setFeePerLotUsd] = useState(30);
  const [depositHistory, setDepositHistory] = useState<
    Array<{
      kind: string;
      amount_usd: number;
      effective_at?: string;
      payment_method?: string;
      tx_hash?: string | null;
      package_id?: string;
    }>
  >([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<
    Array<{
      id: number;
      status: string;
      payout_usd: number;
      fee_usd: number;
      total_debit_usd: number;
      created_at?: string | null;
      completed_at?: string | null;
      rejection_reason?: string | null;
    }>
  >([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stopSettlements, setStopSettlements] = useState<ManualStopSettlementRow[]>([]);
  const [baselineDraft, setBaselineDraft] = useState("");
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [profileRes, tradesData, summaryRes, paymentsRes, stopsRes] = await Promise.all([
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetchAllUserTrades(userId, { admin: true }),
        fetch(`${API_BASE}/user/summary/${userId}`),
        fetch(`${API_BASE}/user/payments/${userId}?limit=2000&offset=0`),
        fetch(`${API_BASE}/admin/users/${userId}/manual-stop-settlements`),
      ]);
      const profileData = await profileRes.json();
      const summaryData = await summaryRes.json();
      const paymentsData = await paymentsRes.json();
      const stopsData = await stopsRes.json().catch(() => null);
      if (summaryData?.success) {
        const wBal = Number(summaryData.wallet_balance ?? 0);
        setWalletBalance(wBal);
        const baseline = Number(
          summaryData.deposit_baseline ?? summaryData.total_invested ?? 0,
        );
        setDepositBaseline(baseline);
        setBaselineDraft(String(baseline));
        setTotalDeposited(Number(summaryData.total_deposited_usd ?? 0));
        setTotalWithdrawn(Number(summaryData.total_withdrawn_usd ?? 0));
        setDepositHistory(Array.isArray(summaryData.deposit_history) ? summaryData.deposit_history : []);
        setWithdrawalHistory(
          Array.isArray(summaryData.withdrawal_history) ? summaryData.withdrawal_history : [],
        );
        setFeePerLotUsd(Number(summaryData.fee_per_lot_usd ?? 30));
        setEquity(Number(summaryData.equity ?? wBal));
      }
      if (profileData?.success && profileData.profile?.name) {
        setUserName(String(profileData.profile.name));
      }
      if (paymentsData?.success && Array.isArray(paymentsData.data)) {
        setPayments(paymentsData.data as PaymentRow[]);
      } else {
        setPayments([]);
      }
      if (stopsData?.success && Array.isArray(stopsData.settlements)) {
        setStopSettlements(stopsData.settlements as ManualStopSettlementRow[]);
      } else {
        setStopSettlements([]);
      }
      setRows(tradesData.trades as UserTradeRow[]);
      setTotalLoaded(tradesData.total);
    } catch (err) {
      console.error("AdminUserTradesPage fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sortedRows = useMemo(
    () =>
      sortTradesChronological(rows).sort((a, b) => {
        const ta = new Date(String(a.open_time ?? a.assignment_created_at ?? "").replace(" ", "T")).getTime();
        const tb = new Date(String(b.open_time ?? b.assignment_created_at ?? "").replace(" ", "T")).getTime();
        return tb - ta;
      }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return sortedRows;
    if (statusFilter === "open") return sortedRows.filter((r) => isOpenTrade(r));
    return sortedRows.filter((r) => !isOpenTrade(r));
  }, [sortedRows, statusFilter]);

  const openCount = useMemo(() => sortedRows.filter((r) => isOpenTrade(r)).length, [sortedRows]);
  const closedCount = useMemo(() => sortedRows.filter((r) => !isOpenTrade(r)).length, [sortedRows]);

  const { page, setPage, pageItems, totalPages, total } = useClientPagination(
    filteredRows,
    PAGE_SIZE,
  );

  const facingMap = useMemo(
    () => buildSequentialUserFacingPlMap(rows, walletBalance, depositBaseline),
    [rows, walletBalance, depositBaseline],
  );

  const tableTotals = useMemo(
    () => sumUserFacingPlTotals(sortedRows, facingMap),
    [sortedRows, facingMap],
  );

  const paymentTotals = useMemo(() => {
    const success = payments.filter((p) => String(p.status).toLowerCase() === "success");
    let packageAmount = 0;
    let rechargeAmount = 0;
    const packages: PaymentRow[] = [];
    for (const p of success) {
      const amt = Number(p.amount) || 0;
      if (String(p.package_id) === "recharge") {
        rechargeAmount += amt;
      } else if (isSubscriptionPackageId(p.package_id) || String(p.package_id || "").trim()) {
        packageAmount += amt;
        packages.push(p);
      }
    }
    return {
      packages,
      packageAmount,
      rechargeAmount,
      totalAmount: packageAmount + rechargeAmount,
    };
  }, [payments]);

  const mistakeInsights = useMemo(
    () =>
      buildUserMistakeInsights({
        depositBaseline,
        walletBalance,
        equity,
        totalDeposited,
        depositHistory,
        trades: rows,
        stopSettlements,
      }),
    [
      depositBaseline,
      walletBalance,
      equity,
      totalDeposited,
      depositHistory,
      rows,
      stopSettlements,
    ],
  );

  const saveBaseline = useCallback(async () => {
    if (!userId || savingBaseline) return;
    const next = Number(baselineDraft);
    if (!Number.isFinite(next) || next < 0) {
      toast({
        title: "Invalid baseline",
        description: "Enter a non-negative USD amount.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSavingBaseline(true);
      const res = await fetch(`${API_BASE}/admin/users/${userId}/deposit-baseline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositBaselineUsd: next }),
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || "Failed to update baseline");
      }
      setDepositBaseline(Number(data.deposit_baseline_usd ?? next));
      setBaselineDraft(String(data.deposit_baseline_usd ?? next));
      setEditingBaseline(false);
      toast({
        title: "Baseline updated",
        description: `Deposit baseline set to ${fmtUsd(Number(data.deposit_baseline_usd ?? next))}.`,
      });
      await refresh();
    } catch (err) {
      toast({
        title: "Baseline update failed",
        description: err instanceof Error ? err.message : "Could not save baseline.",
        variant: "destructive",
      });
    } finally {
      setSavingBaseline(false);
    }
  }, [userId, baselineDraft, savingBaseline, toast, refresh]);

  const handleExportExcel = useCallback(async () => {
    if (!userId) return;
    try {
      setExporting(true);
      let tradesToExport = rows;
      if (!tradesToExport.length || (totalLoaded > 0 && tradesToExport.length < totalLoaded)) {
        const fetched = await fetchAllUserTrades(userId, { admin: true });
        tradesToExport = fetched.trades as UserTradeRow[];
      }
      if (!tradesToExport.length) {
        toast({
          title: "Nothing to export",
          description: "This user has no assigned trades.",
          variant: "destructive",
        });
        return;
      }
      exportUserTradesToExcel(tradesToExport, {
        userId,
        userName,
        feePerLotUsd,
        walletBalance,
        depositBaseline,
      });
      toast({
        title: "Excel downloaded",
        description: `${tradesToExport.length.toLocaleString()} trade(s) exported (all pages).`,
      });
    } catch (err) {
      console.error("AdminUserTradesPage export:", err);
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not create Excel file.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [
    userId,
    rows,
    totalLoaded,
    userName,
    feePerLotUsd,
    walletBalance,
    depositBaseline,
    toast,
  ]);

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  const COL_COUNT = 16;

  return (
    <div className="mx-auto max-w-[110rem] px-0 py-4 sm:px-2 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            allowInRecording
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Users
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              <MaskedPii value={userName || "User"} kind="name" /> — assigned trades
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              User #{userId} · {openCount} open · {closedCount} closed · {rows.length} assigned
              {totalLoaded > rows.length ? ` (${totalLoaded} total loaded)` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            allowInRecording
            onClick={handleExportExcel}
            disabled={loading || exporting}
          >
            <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
            {exporting ? "Exporting…" : "Export Excel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            allowInRecording
            onClick={refresh}
            disabled={loading || exporting}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${sortedRows.length})`],
            ["open", `Open (${openCount})`],
            ["closed", `Closed (${closedCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            data-recording-safe="true"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              statusFilter === key
                ? "bg-yellow-800 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 shadow-sm">
          <div className="flex items-start gap-2 border-b border-amber-200/80 px-4 py-3 sm:px-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <h2 className="text-sm font-bold text-amber-950">Mistake review</h2>
              <p className="mt-0.5 text-xs text-amber-900/80">
                Heuristics from drawdown vs baseline and early Stop vs holding to master close.
              </p>
            </div>
          </div>
          <div className="space-y-3 px-4 py-3 sm:px-5">
            {mistakeInsights.length === 0 ? (
              <p className="text-sm text-amber-900/70">
                No clear mistakes flagged right now (wallet not deeply underwater, and no early-stop
                opportunity cost detected).
              </p>
            ) : (
              mistakeInsights.map((m: MistakeInsight) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    m.severity === "high"
                      ? "border-red-200 bg-red-50/80"
                      : m.severity === "medium"
                        ? "border-amber-300 bg-white/80"
                        : "border-slate-200 bg-white/70",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        m.severity === "high"
                          ? "text-red-900"
                          : m.severity === "medium"
                            ? "text-amber-950"
                            : "text-slate-800",
                      )}
                    >
                      {m.title}
                    </p>
                    {m.amountUsd != null ? (
                      <span className="text-xs font-bold tabular-nums text-slate-700">
                        {fmtUsd(m.amountUsd)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">{m.detail}</p>
                  {m.stopRows && m.stopRows.length > 0 ? (
                    <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200/80 bg-white">
                      <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 font-bold uppercase tracking-wide text-slate-500">
                              Ticket
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 font-bold uppercase tracking-wide text-slate-500">
                              Symbol
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 font-bold uppercase tracking-wide text-slate-500">
                              Stopped
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 text-right font-bold uppercase tracking-wide text-slate-500">
                              At stop
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 text-right font-bold uppercase tracking-wide text-slate-500">
                              If held
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 text-right font-bold uppercase tracking-wide text-slate-500">
                              Missed
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-50 px-2.5 py-2 font-bold uppercase tracking-wide text-slate-500">
                              Note
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {m.stopRows.map((row) => (
                            <tr key={row.ticket} className="hover:bg-slate-50/80">
                              <td className="px-2.5 py-2 font-mono tabular-nums text-slate-800">
                                #{row.ticket}
                              </td>
                              <td className="px-2.5 py-2 font-medium text-slate-700">{row.symbol}</td>
                              <td className="whitespace-nowrap px-2.5 py-2 text-slate-600">
                                {row.stoppedAt}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums text-slate-800">
                                {fmtUsd(row.stoppedGrossUsd)}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums text-slate-800">
                                {fmtUsd(row.ifHeldUsd)}
                              </td>
                              <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-red-700">
                                {fmtUsd(row.missedUsd)}
                              </td>
                              <td className="px-2.5 py-2 text-slate-500">{row.masterNote}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Deposit baseline
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Recovery baseline for profit share</p>
            </div>
            {!editingBaseline ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                data-admin-mutate
                onClick={() => {
                  setBaselineDraft(String(depositBaseline));
                  setEditingBaseline(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
          {!editingBaseline ? (
            <p className="mt-3 text-2xl font-extrabold tabular-nums text-slate-900">
              {fmtUsd(depositBaseline)}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={baselineDraft}
                onChange={(e) => setBaselineDraft(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  disabled={savingBaseline}
                  onClick={() => void saveBaseline()}
                >
                  {savingBaseline ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={savingBaseline}
                  onClick={() => {
                    setEditingBaseline(false);
                    setBaselineDraft(String(depositBaseline));
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Wallet</dt>
              <dd className="font-semibold tabular-nums text-slate-800">{fmtUsd(walletBalance)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Equity</dt>
              <dd className="font-semibold tabular-nums text-slate-800">{fmtUsd(equity)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Recovery remaining</dt>
              <dd className="font-semibold tabular-nums text-amber-800">
                {fmtUsd(Math.max(0, depositBaseline - walletBalance))}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <h2 className="text-base font-semibold text-slate-800">Per-trade P/L</h2>
          <p className="mt-1 text-xs text-slate-500">
            Per trade: gross P/L, wallet credit (after baseline recovery + performance fee), exposure
            split, and admin risk on uncovered trade size.
          </p>
        </div>
        {/* ~5 rows visible; scroll for the rest */}
        <div className="max-h-[22.5rem] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Ticket
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Symbol
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Side
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Opened
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Closed
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Vol.
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Buy price
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Sell price
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Fee
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Gross P/L
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  User exp.
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Admin risk
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Risk P/L
                </th>
                <th
                  className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]"
                  title="Positive = admin claim on profit; negative = admin loss clawback"
                >
                  Admin share
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Wallet P/L
                </th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-6 py-12 text-center text-slate-500">
                    No assigned trades.
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => {
                  const open = isOpenTrade(r);
                  const slice = resolveEffectiveSlice({
                    ...r,
                    user_fee_per_lot_usd:
                      (r as UserTradeRow & { user_fee_per_lot_usd?: number }).user_fee_per_lot_usd ??
                      feePerLotUsd,
                  });
                  const vol = slice.v_i;
                  const fee = slice.fee;
                  const { buyPrice, sellPrice, buyIsLive, sellIsLive } =
                    resolveMt5BuySellPrices(r);
                  const side = formatMt5SideLabel(r.mt5_type);
                  const gross = proportionalRawPl(r);
                  const walletPl = rowUserFacingPl(r, undefined, undefined, facingMap);
                  const userExposure =
                    r.reserved_exposure_usd != null ? Number(r.reserved_exposure_usd) : null;
                  const adminExposure =
                    r.admin_exposure_usd != null ? Number(r.admin_exposure_usd) : null;
                  const adminRiskPl =
                    r.admin_absorbed_pl_usd != null ? Number(r.admin_absorbed_pl_usd) : null;
                  const perfFee = Number(r.admin_share_usd ?? 0);
                  const rowKey = String(r.assignment_id ?? r.ticket_id);

                  return (
                    <tr key={rowKey} className="hover:bg-yellow-50/40">
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">{r.symbol ?? "—"}</td>
                      <td className="px-3 py-3 text-sm">
                        {side === "—" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              side === "Buy"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {side}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                        {tradeOpenedAt(r)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                        {tradeClosedAt(r)}
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {vol <= 0 ? "—" : vol.toFixed(4)}
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {buyPrice != null ? `${buyIsLive ? "~" : ""}${fmtMt5Price(buyPrice, r.symbol)}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {sellPrice != null ? `${sellIsLive ? "~" : ""}${fmtMt5Price(sellPrice, r.symbol)}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {fee <= 0 ? "—" : fmtUsd(fee)}
                      </td>
                      <td className={`px-3 py-3 text-sm font-semibold tabular-nums ${plTextClass(gross)}`}>
                        {open ? "~" : ""}
                        {fmtUsd(gross)}
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {userExposure != null && userExposure > 0 ? fmtUsd(userExposure) : "—"}
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {adminExposure != null && adminExposure > 0.01 ? fmtUsd(adminExposure) : "—"}
                      </td>
                      <td
                        className={`px-3 py-3 text-sm font-semibold tabular-nums ${
                          adminRiskPl != null ? plTextClass(adminRiskPl) : "text-slate-400"
                        }`}
                      >
                        {adminRiskPl != null && Math.abs(adminRiskPl) > 0.001
                          ? `${open ? "~" : ""}${fmtUsd(adminRiskPl)}`
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-3 text-sm font-semibold tabular-nums ${
                          !open && Math.abs(perfFee) > 0.001 ? plTextClass(perfFee) : "text-slate-400"
                        }`}
                      >
                        {!open && Math.abs(perfFee) > 0.001
                          ? fmtUsd(perfFee)
                          : open
                            ? "~"
                            : "—"}
                      </td>
                      <td className={`px-3 py-3 text-sm font-bold tabular-nums ${plTextClass(walletPl)}`}>
                        {open ? "~" : ""}
                        {fmtUsd(walletPl)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              open
                                ? "bg-sky-50 text-sky-700"
                                : "border border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {open ? String(r.mt5_status ?? "Open") : "Closed"}
                          </span>
                          {isUserStoppedTrade(r) && (
                            <UserStoppedTradeBadge row={r} variant="admin" showTime />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Complete profit (full wallet credit)
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-emerald-600">
            {fmtUsd(tableTotals.profit)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Complete loss (full wallet credit)
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-red-600">
            {fmtUsd(tableTotals.loss)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Net P/L (full wallet credit)
          </div>
          <div className={`mt-1 text-xl font-extrabold tabular-nums ${plTextClass(tableTotals.net)}`}>
            {fmtUsd(tableTotals.net)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Total amount (packages + recharges)
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
            {fmtUsd(paymentTotals.totalAmount)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Packages {fmtUsd(paymentTotals.packageAmount)} · Recharges{" "}
            {fmtUsd(paymentTotals.rechargeAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Total deposited</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
            {fmtUsd(totalDeposited)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Total withdrawl</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
            {fmtUsd(totalWithdrawn)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Current wallet (settled)
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
            {fmtUsd(walletBalance)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Equity (incl. open P/L)
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">{fmtUsd(equity)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-slate-800">
          All packages ({paymentTotals.packages.length})
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Successful package purchases for this user. Total amount includes packages + recharges:{" "}
          <span className="font-semibold text-slate-700">{fmtUsd(paymentTotals.totalAmount)}</span>
        </p>
        {paymentTotals.packages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No successful package purchases.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Package</th>
                  <th className="py-2 pr-2">Method</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentTotals.packages.map((p) => (
                  <tr key={`pkg-${p.id}`} className="border-b border-slate-50">
                    <td className="py-2 pr-2 tabular-nums text-slate-600">
                      {p.created_at ? formatIsoDateTime(p.created_at) : "—"}
                    </td>
                    <td className="py-2 pr-2 font-medium text-slate-800">
                      {packageDisplayName(p.package_id, p.package_name)}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">{p.payment_method || "—"}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {fmtUsd(Number(p.amount) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={3} className="py-2 pr-2 font-semibold text-slate-700">
                    Package total
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums text-slate-900">
                    {fmtUsd(paymentTotals.packageAmount)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 pr-2 font-semibold text-slate-700">
                    Recharge total
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums text-slate-900">
                    {fmtUsd(paymentTotals.rechargeAmount)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 pr-2 font-semibold text-slate-800">
                    Grand total (packages + recharges)
                  </td>
                  <td className="py-2 text-right font-extrabold tabular-nums text-slate-900">
                    {fmtUsd(paymentTotals.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {(depositHistory.length > 0 || withdrawalHistory.length > 0) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {depositHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Deposit record ({depositHistory.length})
              </h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Method</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositHistory.map((d, i) => (
                      <tr key={`dep-${i}`} className="border-b border-slate-50">
                        <td className="py-2 pr-2 tabular-nums text-slate-600">
                          {d.effective_at ? formatIsoDateTime(d.effective_at) : "—"}
                        </td>
                        <td className="py-2 pr-2 text-slate-700">{d.kind}</td>
                        <td className="py-2 pr-2 text-slate-600">{d.payment_method || d.package_id || "—"}</td>
                        <td
                          className={`py-2 text-right font-semibold tabular-nums ${
                            d.amount_usd >= 0 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {fmtUsd(d.amount_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {withdrawalHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Withdrawal record ({withdrawalHistory.length})
              </h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 text-right">Payout</th>
                      <th className="py-2 text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalHistory.map((w) => (
                      <tr key={`wd-${w.id}`} className="border-b border-slate-50">
                        <td className="py-2 pr-2 tabular-nums text-slate-600">
                          {formatIsoDateTime(w.completed_at || w.created_at || null)}
                        </td>
                        <td className="py-2 pr-2 capitalize text-slate-700">{w.status}</td>
                        <td className="py-2 text-right font-semibold tabular-nums text-slate-800">
                          {fmtUsd(w.payout_usd)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-500">{fmtUsd(w.fee_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUserTradesPage;
