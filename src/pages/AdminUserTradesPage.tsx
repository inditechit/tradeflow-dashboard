import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { TradeSummaryFooter } from "@/components/trades/TradeSummaryFooter";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";

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
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [equity, setEquity] = useState(0);
  const [adminFeeLive, setAdminFeeLive] = useState(0);
  const [userShareLive, setUserShareLive] = useState(0);
  const [userSharePct, setUserSharePct] = useState(0);
  const [feePerLotUsd, setFeePerLotUsd] = useState(30);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [profileRes, tradesData, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetchAllUserTrades(userId, { admin: true }),
        fetch(`${API_BASE}/user/summary/${userId}`),
      ]);
      const profileData = await profileRes.json();
      const summaryData = await summaryRes.json();
      if (summaryData?.success) {
        const wBal = Number(summaryData.wallet_balance ?? 0);
        setWalletBalance(wBal);
        setDepositBaseline(
          Number(summaryData.deposit_baseline ?? summaryData.total_invested ?? 0),
        );
        setTotalDeposited(Number(summaryData.total_deposited_usd ?? 0));
        setTotalWithdrawn(Number(summaryData.total_withdrawn_usd ?? 0));
        setFeePerLotUsd(Number(summaryData.fee_per_lot_usd ?? 30));
        setEquity(Number(summaryData.equity ?? wBal));
        setAdminFeeLive(Math.max(0, Number(summaryData.admin_pending_share_live_usd ?? 0)));
        setUserShareLive(Math.max(0, Number(summaryData.user_equity_share_usd ?? 0)));
        setUserSharePct(Number(summaryData.user_share_pct ?? 0));
      }
      if (profileData?.success && profileData.profile?.name) {
        setUserName(String(profileData.profile.name));
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

  const grossTotals = useMemo(() => {
    let gross = 0;
    for (const r of sortedRows) {
      gross += proportionalRawPl(r);
    }
    return Math.round(gross * 100) / 100;
  }, [sortedRows]);

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  const COL_COUNT = 15;

  return (
    <div className="mx-auto max-w-[110rem] px-0 py-4 sm:px-2 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Users
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {userName || "User"} — assigned trades
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              User #{userId} · {openCount} open · {closedCount} closed · {rows.length} assigned
              {totalLoaded > rows.length ? ` (${totalLoaded} total loaded)` : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Gross P/L (trades)</div>
          <div className={`mt-1 text-xl font-extrabold tabular-nums ${plTextClass(grossTotals)}`}>
            {fmtUsd(grossTotals)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Equity</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">
            {fmtUsd(equity)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Admin fee{userSharePct ? ` (${100 - userSharePct}%)` : ""}
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-500">
            {adminFeeLive > 0 ? `− ${fmtUsd(adminFeeLive)}` : fmtUsd(0)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">User share</div>
          <div className={`mt-1 text-xl font-extrabold tabular-nums ${plTextClass(userShareLive)}`}>
            {fmtUsd(userShareLive)}
          </div>
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

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <h2 className="text-base font-semibold text-slate-800">Per-trade P/L</h2>
          <p className="mt-1 text-xs text-slate-500">
            Per trade: gross P/L, wallet credit (after baseline recovery + performance fee), exposure
            split, and admin risk on uncovered trade size.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Ticket</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Symbol</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Side</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Opened</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Closed</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Vol.</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Buy price</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Sell price</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Gross P/L</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">User exp.</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Admin risk</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Risk P/L</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Perf. fee</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Wallet P/L</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
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
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-600">
                        {!open && perfFee > 0.001 ? fmtUsd(perfFee) : open ? "~" : "—"}
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
            {sortedRows.length > 0 && (
              <TradeSummaryFooter
                colSpan={9}
                trailingColSpan={2}
                tableTotals={tableTotals}
                capital={{
                  totalDeposited,
                  totalWithdrawn,
                  walletBalance,
                  equity,
                  adminPendingShare: adminFeeLive,
                  userEquityShare: userShareLive,
                  userSharePct,
                }}
                profitLabel="full wallet credit"
                fmtUsd={fmtUsd}
                plTextClass={plTextClass}
              />
            )}
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
    </div>
  );
};

export default AdminUserTradesPage;
