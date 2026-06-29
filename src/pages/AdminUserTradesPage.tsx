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
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  sumUserFacingPlTotals,
  sortTradesChronological,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { resolveRowAdminUserPl, buildTradeSettlementModeMap, settlementModeBadgeClass } from "@/utils/adminLiveFinance";
import { plTextClass } from "@/utils/plColors";

type UserTradeRow = UserTradeRowLike & {
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
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
  return formatIsoDateTime(r.close_time ?? r.wallet_settled_at ?? null);
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
        setWalletBalance(Number(summaryData.wallet_balance ?? 0));
        setDepositBaseline(
          Number(summaryData.deposit_baseline ?? summaryData.total_invested ?? 0),
        );
        setTotalDeposited(Number(summaryData.total_deposited_usd ?? 0));
        setTotalWithdrawn(Number(summaryData.total_withdrawn_usd ?? 0));
        setFeePerLotUsd(Number(summaryData.fee_per_lot_usd ?? 30));
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

  const settlementModeMap = useMemo(
    () => buildTradeSettlementModeMap(rows, depositBaseline, undefined, facingMap),
    [rows, depositBaseline, facingMap],
  );

  const tableTotals = useMemo(
    () => sumUserFacingPlTotals(sortedRows, facingMap),
    [sortedRows, facingMap],
  );

  const shareTotals = useMemo(() => {
    let gross = 0;
    let admin = 0;
    let user = 0;
    for (const r of sortedRows) {
      const split = resolveRowAdminUserPl(r, String(r.ticket_id ?? ""));
      gross += split.gross;
      admin += split.adminShare;
      user += split.userShare;
    }
    return {
      gross: Math.round(gross * 100) / 100,
      admin: Math.round(admin * 100) / 100,
      user: Math.round(user * 100) / 100,
    };
  }, [sortedRows]);

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Gross P/L</div>
          <div className={`mt-1 text-xl font-extrabold tabular-nums ${plTextClass(shareTotals.gross)}`}>
            {fmtUsd(shareTotals.gross)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Admin P/L</div>
          <div className={`mt-1 text-xl font-extrabold tabular-nums ${plTextClass(shareTotals.admin)}`}>
            {fmtUsd(shareTotals.admin)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">User share</div>
          <div className={`mt-1 text-xl font-extrabold tabular-nums ${plTextClass(shareTotals.user)}`}>
            {fmtUsd(shareTotals.user)}
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
          <h2 className="text-base font-semibold text-slate-800">Per-trade breakdown</h2>
          <p className="mt-1 text-xs text-slate-500">
            Gross = full proportional master P/L · Admin / User split by the frozen profit-share %.
            Mode shows whether profit went to loss recovery (fill baseline) or normal split.
            User P/L is what hits the wallet (after fee + baseline rules).
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
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Mode</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Share %</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Admin P/L</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">User P/L</th>
                <th className="px-3 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-slate-500">
                    No assigned trades — run day-0 rebuild if this user had wallet balance but zero
                    rows.
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => {
                  const ticket = String(r.ticket_id ?? "");
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
                  const split = resolveRowAdminUserPl(r, ticket);
                  const userPl = rowUserFacingPl(r, undefined, undefined, facingMap);
                  const adminPct = Math.round((100 - split.userSharePct) * 100) / 100;
                  const assignId = Number(r.assignment_id ?? 0);
                  const settleMode = assignId ? settlementModeMap.get(assignId) : undefined;
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
                      <td className={`px-3 py-3 text-sm font-semibold tabular-nums ${plTextClass(split.gross)}`}>
                        {open ? "~" : ""}
                        {fmtUsd(split.gross)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {settleMode ? (
                          <div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${settlementModeBadgeClass(settleMode.mode)}`}
                            >
                              {settleMode.estimate ? "~" : ""}
                              {settleMode.label}
                            </span>
                            <div className="mt-1 text-[10px] leading-snug text-slate-500">
                              {settleMode.mode === "loss" && "User bears full loss"}
                              {settleMode.mode === "recovery" && "100% to user (baseline fill)"}
                              {settleMode.mode === "normal" && "Profit split applies"}
                              {settleMode.mode === "mixed" &&
                                `Rec ${fmtUsd(settleMode.recoveryGrossUsd)} · Norm ${fmtUsd(settleMode.normalGrossUsd)}`}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums text-slate-600">
                        {split.userSharePct}% / {adminPct}%
                      </td>
                      <td className={`px-3 py-3 text-sm font-semibold tabular-nums ${plTextClass(split.adminShare)}`}>
                        {open || split.estimate ? "~" : ""}
                        {fmtUsd(split.adminShare)}
                      </td>
                      <td className={`px-3 py-3 text-sm font-bold tabular-nums ${plTextClass(userPl)}`}>
                        {open ? "~" : ""}
                        {fmtUsd(userPl)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            open
                              ? "bg-sky-50 text-sky-700"
                              : "border border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {open ? String(r.mt5_status ?? "Open") : "Closed"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedRows.length > 0 && (
              <TradeSummaryFooter
                colSpan={12}
                trailingColSpan={2}
                tableTotals={tableTotals}
                capital={{
                  totalDeposited,
                  totalWithdrawn,
                  walletBalance,
                }}
                profitLabel="user share"
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
