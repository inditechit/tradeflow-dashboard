import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, RefreshCw, AlertTriangle, Pencil } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { useAdminBackNavigation } from "@/hooks/useAdminBackNavigation";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { exportUserTradesToExcel } from "@/utils/exportUserTradesExcel";
import { useToast } from "@/hooks/use-toast";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import { packageDisplayName } from "@/constants/packages";
import { formatAdminDate } from "@/utils/adminUserDisplay";
import { isSubscriptionPackageId } from "@/utils/packageDuration";
import {
  buildUserMistakeInsights,
  type ManualStopSettlementRow,
  type MistakeInsight,
} from "@/utils/adminUserMistakeInsights";
import { MaskedPii } from "@/components/admin/AdminPiiReveal";
import { AdminTableColumnPicker } from "@/components/admin/AdminTableColumnPicker";
import { cn } from "@/lib/utils";
import {
  ADMIN_USER_TRADES_TABLE_COLUMNS,
  defaultAdminUserTradesColumnVisibility,
  loadAdminUserTradesColumnVisibility,
  saveAdminUserTradesColumnVisibility,
  type AdminUserTradesColumnId,
  type AdminUserTradesColumnVisibility,
} from "@/utils/adminUserTradesTableColumns";

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

type TradingControlEvent = {
  type: "stopped" | "restarted" | string;
  at: string;
  note?: string | null;
  source?: string | null;
};

type WalletTransferRow = {
  id: number;
  amount_usd: number;
  effective_at?: string | null;
};

type TradingControlHistory = {
  trading_active_now: boolean;
  last_stopped_at: string | null;
  last_restarted_at: string | null;
  never_restarted_since_last_stop: boolean;
  stop_count: number;
  restart_count: number;
  safe_to_trading_count: number;
  trading_to_safe_count: number;
  safe_to_trading: WalletTransferRow[];
  trading_to_safe: WalletTransferRow[];
  events: TradingControlEvent[];
};

type BaselineHistoryEvent = {
  at: string;
  kind: string;
  label: string;
  change_usd: number;
  baseline_before_usd: number;
  baseline_after_usd: number;
  source_id?: number;
};

type BaselinePeriodRow = {
  from: string | null;
  to: string | null;
  baseline_usd: number;
  reason: string;
  change_usd?: number;
  kind?: string;
  ongoing?: boolean;
};

type BaselineAuditRow = {
  id: number;
  event_type: string;
  amount_usd: number;
  baseline_before_usd: number;
  baseline_after_usd: number;
  wallet_before_usd: number | null;
  wallet_after_usd: number | null;
  effective_at: string | null;
  source_table: string | null;
  source_id: number | null;
  note: string | null;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatEventWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function tradeOpenedAt(r: UserTradeRow): string {
  return formatIsoDateTime(r.open_time ?? r.assignment_created_at ?? null);
}

function tradeClosedAt(r: UserTradeRow): string {
  if (!isTradeClosed(r)) return "—";
  return formatIsoDateTime(tradeEffectiveCloseAt(r));
}

type UserPackageInfo = {
  active_package_id: string | null;
  package_expires_at: string | null;
  package_expired?: boolean;
};

function daysLeftUntil(value: unknown): number | null {
  if (!value) return null;
  const end = new Date(String(value)).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysLeftBadgeClass(days: number): string {
  if (days <= 0) return "border-red-200 bg-red-100 text-red-700";
  if (days <= 3) return "border-red-200 bg-red-50 text-red-700";
  if (days <= 7) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

const AdminUserTradesPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { goBack } = useAdminBackNavigation("/admin/users");
  const { toast } = useToast();
  const [userName, setUserName] = useState("");
  const [userPackage, setUserPackage] = useState<UserPackageInfo | null>(null);
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [netDepositUsd, setNetDepositUsd] = useState(0);
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
  const [tradingControl, setTradingControl] = useState<TradingControlHistory | null>(null);
  const [baselineDraft, setBaselineDraft] = useState("");
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineHistory, setBaselineHistory] = useState<{
    events: BaselineHistoryEvent[];
    periods: BaselinePeriodRow[];
    audit_log: BaselineAuditRow[];
    baseline_locked?: boolean;
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [columnVisibility, setColumnVisibility] = useState<AdminUserTradesColumnVisibility>(() =>
    loadAdminUserTradesColumnVisibility(),
  );

  const showCol = useCallback(
    (id: AdminUserTradesColumnId) => columnVisibility[id] === true,
    [columnVisibility],
  );

  const visibleColumnCount = useMemo(
    () => ADMIN_USER_TRADES_TABLE_COLUMNS.filter((c) => showCol(c.id)).length,
    [showCol],
  );

  const handleColumnVisibilityChange = useCallback((next: AdminUserTradesColumnVisibility) => {
    setColumnVisibility(next);
    saveAdminUserTradesColumnVisibility(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [profileRes, tradesData, summaryRes, paymentsRes, stopsRes, controlRes, baselineRes] =
        await Promise.all([
          fetch(`${API_BASE}/user/profile/${userId}`),
          fetchAllUserTrades(userId, { admin: true }),
          fetch(`${API_BASE}/user/summary/${userId}`),
          fetch(`${API_BASE}/user/payments/${userId}?limit=2000&offset=0`),
          fetch(`${API_BASE}/admin/users/${userId}/manual-stop-settlements`),
          fetch(`${API_BASE}/admin/users/${userId}/trading-control-history`),
          fetch(`${API_BASE}/admin/users/${userId}/baseline-history`),
        ]);
      const profileData = await profileRes.json();
      const summaryData = await summaryRes.json();
      const paymentsData = await paymentsRes.json();
      const stopsData = await stopsRes.json().catch(() => null);
      const controlData = await controlRes.json().catch(() => null);
      const baselineData = await baselineRes.json().catch(() => null);
      if (summaryData?.success) {
        const wBal = Number(summaryData.wallet_balance ?? 0);
        setWalletBalance(wBal);
        const baseline = Number(
          summaryData.deposit_baseline ?? summaryData.total_invested ?? 0,
        );
        setDepositBaseline(baseline);
        setNetDepositUsd(
          Number(summaryData.net_deposit_usd ?? summaryData.deposit_baseline ?? baseline),
        );
        setBaselineDraft(String(baseline));
        setTotalDeposited(Number(summaryData.total_deposited_usd ?? 0));
        setTotalWithdrawn(Number(summaryData.total_withdrawn_usd ?? 0));
        setDepositHistory(Array.isArray(summaryData.deposit_history) ? summaryData.deposit_history : []);
        setWithdrawalHistory(
          Array.isArray(summaryData.withdrawal_history) ? summaryData.withdrawal_history : [],
        );
        setFeePerLotUsd(Number(summaryData.fee_per_lot_usd ?? 30));
        setEquity(Number(summaryData.equity ?? wBal));
        const activePkg = summaryData.active_package_id
          ? String(summaryData.active_package_id)
          : null;
        setUserPackage({
          active_package_id: activePkg,
          package_expires_at: summaryData.package_expires_at ?? null,
          package_expired: summaryData.package_expired === true,
        });
      } else {
        setUserPackage(null);
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
      if (controlData?.success) {
        setTradingControl({
          trading_active_now: controlData.trading_active_now === true,
          last_stopped_at: controlData.last_stopped_at ?? null,
          last_restarted_at: controlData.last_restarted_at ?? null,
          never_restarted_since_last_stop: controlData.never_restarted_since_last_stop === true,
          stop_count: Number(controlData.stop_count ?? 0),
          restart_count: Number(controlData.restart_count ?? 0),
          safe_to_trading_count: Number(controlData.safe_to_trading_count ?? 0),
          trading_to_safe_count: Number(controlData.trading_to_safe_count ?? 0),
          safe_to_trading: Array.isArray(controlData.safe_to_trading)
            ? controlData.safe_to_trading
            : [],
          trading_to_safe: Array.isArray(controlData.trading_to_safe)
            ? controlData.trading_to_safe
            : [],
          events: Array.isArray(controlData.events) ? controlData.events : [],
        });
      } else {
        setTradingControl(null);
      }
      if (baselineData?.success) {
        setBaselineHistory({
          events: Array.isArray(baselineData.events) ? baselineData.events : [],
          periods: Array.isArray(baselineData.periods) ? baselineData.periods : [],
          audit_log: Array.isArray(baselineData.audit_log) ? baselineData.audit_log : [],
          baseline_locked: baselineData.baseline_locked === true,
        });
      } else {
        setBaselineHistory(null);
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

  const displayLifetimeNetDeposit = useMemo(
    () => Math.max(0, totalDeposited - totalWithdrawn),
    [totalDeposited, totalWithdrawn],
  );

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

  const thClass =
    "sticky top-0 z-10 bg-slate-50 px-3 py-3 text-xs font-bold uppercase text-slate-500 shadow-[inset_0_-1px_0_0_rgb(241_245_249)]";

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
            onClick={() => goBack()}
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
              {userPackage?.active_package_id ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-slate-700">
                    {packageDisplayName(userPackage.active_package_id)}
                  </span>
                  {(() => {
                    const days = daysLeftUntil(userPackage.package_expires_at);
                    if (days == null) return null;
                    return (
                      <span
                        className={cn(
                          "ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          daysLeftBadgeClass(days),
                        )}
                      >
                        {days <= 0 ? "Expired" : `${days}d left`}
                      </span>
                    );
                  })()}
                  {userPackage.package_expires_at ? (
                    <span className="ml-1 text-slate-500">
                      · ends {formatAdminDate(String(userPackage.package_expires_at))}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {" "}
                  · <span className="text-slate-400">No active plan</span>
                </>
              )}
              {tradingControl ? (
                <>
                  {" "}
                  ·{" "}
                  <span
                    className={
                      tradingControl.trading_active_now
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-amber-800"
                    }
                  >
                    {tradingControl.trading_active_now ? "Trading active" : "Trading stopped"}
                  </span>
                  {tradingControl.stop_count > 0
                    ? ` · ${tradingControl.stop_count} stop(s) / ${tradingControl.restart_count} restart(s)`
                    : null}
                </>
              ) : null}
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

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-8">
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
          Gross profit
          </div>
          <div className="mt-0.5 text-sm font-extrabold tabular-nums text-emerald-600 sm:text-base">
            {fmtUsd(tableTotals.profit)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
          Gross loss
          </div>
          <div className="mt-0.5 text-sm font-extrabold tabular-nums text-red-600 sm:text-base">
            {fmtUsd(tableTotals.loss)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
            Net P/L
          </div>
          <div
            className={`mt-0.5 text-sm font-extrabold tabular-nums sm:text-base ${plTextClass(tableTotals.net)}`}
          >
            {fmtUsd(tableTotals.net)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
            Total amount
          </div>
          <div className="mt-0.5 text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
            {fmtUsd(paymentTotals.totalAmount)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
            Current wallet
          </div>
          <div className="mt-0.5 text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
            {fmtUsd(walletBalance)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
            Net deposit
          </div>
          <div className="mt-0.5 text-sm font-extrabold tabular-nums text-indigo-900 sm:text-base">
            {fmtUsd(netDepositUsd)}
          </div>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
            Fresh money from pocket
            {displayLifetimeNetDeposit !== netDepositUsd
              ? ` · deposited − withdrawn ${fmtUsd(displayLifetimeNetDeposit)}`
              : null}
            {depositBaseline !== netDepositUsd
              ? ` · recovery baseline ${fmtUsd(depositBaseline)}`
              : null}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
            Equity
          </div>
          <div className="mt-0.5 text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
            {fmtUsd(equity)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
            Package
          </div>
          {userPackage?.active_package_id ? (
            <>
              <div className="mt-0.5 text-sm font-extrabold leading-tight text-slate-900 sm:text-base">
                {packageDisplayName(userPackage.active_package_id)}
              </div>
              {(() => {
                const days = daysLeftUntil(userPackage.package_expires_at);
                if (days == null) return null;
                return (
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      daysLeftBadgeClass(days),
                    )}
                  >
                    {days <= 0 ? "Expired" : `${days}d left`}
                  </span>
                );
              })()}
              {userPackage.package_expires_at ? (
                <p className="mt-1 text-[10px] leading-tight text-slate-500">
                  Ends {formatAdminDate(String(userPackage.package_expires_at))}
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-0.5 text-sm font-semibold text-slate-400">No active plan</div>
          )}
        </div>
      </div>

      {(() => {
        const successDeposits = depositHistory.filter((d) => {
          const kind = String(d.kind || "").toLowerCase();
          return (
            d.amount_usd > 0 &&
            (kind.includes("recharge") ||
              kind.includes("deposit") ||
              String(d.package_id || "").toLowerCase() === "recharge" ||
              !kind.includes("fail"))
          );
        });
        const successWithdrawals = withdrawalHistory.filter(
          (w) => String(w.status).toLowerCase() === "completed",
        );
        const safeToTrading = tradingControl?.safe_to_trading ?? [];
        const tradingToSafe = tradingControl?.trading_to_safe ?? [];

        const dateAmountTable = (
          rows: Array<{ id?: number | string; date: string; amount: number; key: string }>,
          emptyText: string,
          amountLabel = "Amount",
        ) =>
          rows.length === 0 ? (
            <p className="px-1 py-5 text-center text-sm text-slate-500">{emptyText}</p>
          ) : (
            <div className="max-h-56 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-[58%]" />
                  <col className="w-[42%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pl-2 text-right font-semibold">{amountLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-50 last:border-0">
                      <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-slate-600">
                        {r.date}
                      </td>
                      <td
                        className={`py-2.5 pl-2 text-right font-semibold tabular-nums ${
                          r.amount >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {fmtUsd(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

        const safeToTradingTotal = safeToTrading.reduce(
          (s, t) => s + (Number(t.amount_usd) || 0),
          0,
        );
        const tradingToSafeTotal = tradingToSafe.reduce(
          (s, t) => s + (Number(t.amount_usd) || 0),
          0,
        );

        const sectionHeading = (label: string, value: string, valueClass = "text-slate-900") => (
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 text-sm font-bold text-slate-800">{label}</h3>
            <p className={cn("shrink-0 text-sm font-extrabold tabular-nums", valueClass)}>
              {value}
            </p>
          </div>
        );

        return (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-6">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {sectionHeading("Safe → Trading", fmtUsd(safeToTradingTotal))}
              {dateAmountTable(
                safeToTrading.map((t) => ({
                  key: `s2t-${t.id}`,
                  date: formatIsoDateTime(t.effective_at ?? null),
                  amount: Number(t.amount_usd) || 0,
                })),
                "No Safe → Trading transfers.",
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {sectionHeading("Trading → Safe", fmtUsd(tradingToSafeTotal))}
              {dateAmountTable(
                tradingToSafe.map((t) => ({
                  key: `t2s-${t.id}`,
                  date: formatIsoDateTime(t.effective_at ?? null),
                  amount: Number(t.amount_usd) || 0,
                })),
                "No Trading → Safe transfers.",
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {sectionHeading("Total deposited", fmtUsd(totalDeposited), "text-emerald-700")}
              {dateAmountTable(
                successDeposits.map((d, i) => ({
                  key: `dep-${i}`,
                  date: d.effective_at ? formatIsoDateTime(d.effective_at) : "—",
                  amount: d.amount_usd,
                })),
                "No deposits recorded.",
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {sectionHeading("Total withdrawn", fmtUsd(totalWithdrawn))}
              {dateAmountTable(
                successWithdrawals.map((w) => ({
                  key: `wd-${w.id}`,
                  date: formatIsoDateTime(w.completed_at || w.created_at || null),
                  amount: Number(w.payout_usd) || 0,
                })),
                "No completed withdrawals.",
                "Payout",
              )}
            </div>
          </div>
        );
      })()}

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
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
              <p className="mt-0.5 text-xs text-slate-500">
                Recovery baseline for profit share · fresh pocket {fmtUsd(netDepositUsd)}
              </p>
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

      <div className="mb-4 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
        <div className="border-b border-indigo-100 bg-indigo-50/40 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold text-slate-900">Deposit baseline history</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Recharges (incl. Safe wallet), withdrawals, admin edits, and system syncs. Current baseline{" "}
            <span className="font-semibold tabular-nums">{fmtUsd(depositBaseline)}</span>
            {baselineHistory?.baseline_locked ? (
              <span className="ml-1 font-semibold text-amber-800">(locked)</span>
            ) : null}
          </p>
        </div>
        <div className="max-h-[20rem] overflow-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky top-0 z-[1] bg-slate-50 px-3 py-2 font-bold uppercase tracking-wide text-slate-500">
                  When
                </th>
                <th className="sticky top-0 z-[1] bg-slate-50 px-3 py-2 font-bold uppercase tracking-wide text-slate-500">
                  Event
                </th>
                <th className="sticky top-0 z-[1] bg-slate-50 px-3 py-2 text-right font-bold uppercase tracking-wide text-slate-500">
                  Change
                </th>
                <th className="sticky top-0 z-[1] bg-slate-50 px-3 py-2 text-right font-bold uppercase tracking-wide text-slate-500">
                  Before
                </th>
                <th className="sticky top-0 z-[1] bg-slate-50 px-3 py-2 text-right font-bold uppercase tracking-wide text-slate-500">
                  After
                </th>
                <th className="sticky top-0 z-[1] bg-slate-50 px-3 py-2 font-bold uppercase tracking-wide text-slate-500">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baselineHistory == null && loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td>
                </tr>
              ) : baselineHistory &&
                baselineHistory.audit_log.length + baselineHistory.events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No baseline history recorded yet.
                  </td>
                </tr>
              ) : (
                <>
                  {(baselineHistory?.audit_log ?? []).map((row) => (
                    <tr key={`audit-${row.id}`} className="hover:bg-indigo-50/30">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                        {formatEventWhen(row.effective_at)}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        <span className="font-semibold">{row.event_type}</span>
                        {row.note ? (
                          <span className="mt-0.5 block text-[11px] text-slate-500">{row.note}</span>
                        ) : null}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${plTextClass(row.amount_usd)}`}
                      >
                        {row.amount_usd >= 0 ? "+" : ""}
                        {fmtUsd(row.amount_usd)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {fmtUsd(row.baseline_before_usd)}
                      </td>
                      <td className="px-3 py-2 text-right font-extrabold tabular-nums text-slate-900">
                        {fmtUsd(row.baseline_after_usd)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        {row.source_table ? `${row.source_table} #${row.source_id ?? "—"}` : "—"}
                      </td>
                    </tr>
                  ))}
                  {(baselineHistory?.events ?? []).map((ev, i) => (
                    <tr key={`recon-${ev.at}-${i}`} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                        {formatEventWhen(ev.at)}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        <span className="font-semibold">{ev.label}</span>
                        <span className="ml-1 text-[10px] uppercase text-slate-400">reconstructed</span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${plTextClass(ev.change_usd)}`}
                      >
                        {ev.change_usd >= 0 ? "+" : ""}
                        {fmtUsd(ev.change_usd)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {fmtUsd(ev.baseline_before_usd)}
                      </td>
                      <td className="px-3 py-2 text-right font-extrabold tabular-nums text-slate-900">
                        {fmtUsd(ev.baseline_after_usd)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        {ev.kind}
                        {ev.source_id != null ? ` #${ev.source_id}` : ""}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
        {baselineHistory && baselineHistory.periods.length > 0 ? (
          <div className="border-t border-indigo-100 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-600 sm:px-5">
            <span className="font-semibold text-slate-700">Periods: </span>
            {baselineHistory.periods
              .slice(-3)
              .map((p) =>
                `${p.from ? new Date(p.from).toLocaleDateString() : "start"} → ${
                  p.ongoing ? "now" : p.to ? new Date(p.to).toLocaleDateString() : "—"
                }: ${fmtUsd(p.baseline_usd)}`,
              )
              .join(" · ")}
          </div>
        ) : null}
      </div>

      <div className="mt-4 mb-4 flex flex-wrap gap-2">
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

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Per-trade P/L</h2>
            <p className="mt-1 text-xs text-slate-500">
              Per trade: gross P/L, wallet credit (after baseline recovery + performance fee), exposure
              split, and admin risk on uncovered trade size.
            </p>
          </div>
          <AdminTableColumnPicker
            columns={ADMIN_USER_TRADES_TABLE_COLUMNS}
            visibility={columnVisibility}
            onChange={handleColumnVisibilityChange}
            onReset={() => handleColumnVisibilityChange(defaultAdminUserTradesColumnVisibility())}
          />
        </div>
        {/* ~5 rows visible; scroll for the rest */}
        <div className="max-h-[22.5rem] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {ADMIN_USER_TRADES_TABLE_COLUMNS.filter((c) => showCol(c.id)).map((col) => (
                  <th
                    key={col.id}
                    className={thClass}
                    title={col.title}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount || 1} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount || 1} className="px-6 py-12 text-center text-slate-500">
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
                      {showCol("ticket") ? (
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      ) : null}
                      {showCol("symbol") ? (
                        <td className="px-3 py-3 text-sm font-semibold text-slate-900">{r.symbol ?? "—"}</td>
                      ) : null}
                      {showCol("side") ? (
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
                      ) : null}
                      {showCol("opened") ? (
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                          {tradeOpenedAt(r)}
                        </td>
                      ) : null}
                      {showCol("closed") ? (
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                          {tradeClosedAt(r)}
                        </td>
                      ) : null}
                      {showCol("volume") ? (
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                          {vol <= 0 ? "—" : vol.toFixed(4)}
                        </td>
                      ) : null}
                      {showCol("buy_price") ? (
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                          {buyPrice != null ? `${buyIsLive ? "~" : ""}${fmtMt5Price(buyPrice, r.symbol)}` : "—"}
                        </td>
                      ) : null}
                      {showCol("sell_price") ? (
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                          {sellPrice != null ? `${sellIsLive ? "~" : ""}${fmtMt5Price(sellPrice, r.symbol)}` : "—"}
                        </td>
                      ) : null}
                      {showCol("fee") ? (
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                          {fee <= 0 ? "—" : fmtUsd(fee)}
                        </td>
                      ) : null}
                      {showCol("gross_pl") ? (
                        <td className={`px-3 py-3 text-sm font-semibold tabular-nums ${plTextClass(gross)}`}>
                          {open ? "~" : ""}
                          {fmtUsd(gross)}
                        </td>
                      ) : null}
                      {showCol("user_exposure") ? (
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                          {userExposure != null && userExposure > 0 ? fmtUsd(userExposure) : "—"}
                        </td>
                      ) : null}
                      {showCol("admin_risk") ? (
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                          {adminExposure != null && adminExposure > 0.01 ? fmtUsd(adminExposure) : "—"}
                        </td>
                      ) : null}
                      {showCol("risk_pl") ? (
                        <td
                          className={`px-3 py-3 text-sm font-semibold tabular-nums ${
                            adminRiskPl != null ? plTextClass(adminRiskPl) : "text-slate-400"
                          }`}
                        >
                          {adminRiskPl != null && Math.abs(adminRiskPl) > 0.001
                            ? `${open ? "~" : ""}${fmtUsd(adminRiskPl)}`
                            : "—"}
                        </td>
                      ) : null}
                      {showCol("admin_share") ? (
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
                      ) : null}
                      {showCol("wallet_pl") ? (
                        <td className={`px-3 py-3 text-sm font-bold tabular-nums ${plTextClass(walletPl)}`}>
                          {open ? "~" : ""}
                          {fmtUsd(walletPl)}
                        </td>
                      ) : null}
                      {showCol("status") ? (
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
                      ) : null}
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

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold text-slate-900">Start / Stop trade history</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Exit pool (stop) and Start Trade (restart) events for this user.
            {tradingControl?.never_restarted_since_last_stop
              ? " Currently stopped and has not restarted since the last Exit."
              : ""}
          </p>
        </div>
        {!tradingControl || tradingControl.events.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">
            No start/stop history recorded for this user yet.
          </p>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="sticky top-0 z-[1] bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    When
                  </th>
                  <th className="sticky top-0 z-[1] bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                  <th className="sticky top-0 z-[1] bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Details
                  </th>
                  <th className="sticky top-0 z-[1] bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...tradingControl.events].reverse().map((ev, idx) => {
                  const stopped = ev.type === "stopped";
                  return (
                    <tr key={`${ev.type}-${ev.at}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700">
                        {formatEventWhen(ev.at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            stopped
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-800",
                          )}
                        >
                          {stopped ? "Exit pool / Stop" : "Start Trade / Restart"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{ev.note || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{ev.source || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserTradesPage;
