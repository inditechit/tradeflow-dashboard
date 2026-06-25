import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { fetchAllUserTrades, type TradeAbsenceRow } from "@/utils/fetchAllUserTrades";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";

const PAGE_SIZE = 50;
import {
  fmtMt5Price,
  isOpenTrade,
  isTradeClosed,
  rowFinalWalletPl,
  rowGrossPl,
  buildSequentialUserFacingPlMap,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { plTextClass } from "@/utils/plColors";

type UserTradeRow = UserTradeRowLike & {
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
  user_absent?: boolean;
  absence_reason?: string | null;
};

type StatusFilter = "all" | "open" | "closed" | "absent";

const ABSENCE_LABELS: Record<string, string> = {
  zero_wallet_at_open: "Wallet was $0 when trade opened",
  subscription_inactive_at_open: "Package inactive when trade opened",
  not_funded_at_open: "Wallet was $0 when trade opened",
  wallet_exhausted_at_open: "Wallet was $0 when trade opened",
};

function absenceToRow(a: TradeAbsenceRow): UserTradeRow {
  return {
    ticket_id: a.ticket_id,
    open_time: a.mt5_open_time,
    assignment_created_at: null,
    user_absent: true,
    absence_reason: a.reason,
    mt5_status: "Absent",
  };
}

function rowSortTime(r: UserTradeRow): number {
  const raw = r.open_time ?? r.assignment_created_at;
  if (!raw) return 0;
  const t = new Date(String(raw).replace(" ", "T")).getTime();
  return Number.isFinite(t) ? t : 0;
}

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
  const [absences, setAbsences] = useState<TradeAbsenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);

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
      }
      if (profileData?.success && profileData.profile?.name) {
        setUserName(String(profileData.profile.name));
      }
      setRows(
        (tradesData.trades as UserTradeRow[]).map((r) => ({
          ...r,
          user_absent: r.user_absent === true,
        })),
      );
      setAbsences(tradesData.trade_absences ?? []);
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

  const mergedRows = useMemo(() => {
    const assigned = rows.map((r) => ({ ...r, user_absent: r.user_absent === true }));
    const absent = absences.map(absenceToRow);
    return [...assigned, ...absent].sort((a, b) => rowSortTime(b) - rowSortTime(a));
  }, [rows, absences]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return mergedRows;
    if (statusFilter === "absent") return mergedRows.filter((r) => r.user_absent === true);
    if (statusFilter === "open") return mergedRows.filter((r) => !r.user_absent && isOpenTrade(r));
    return mergedRows.filter((r) => !r.user_absent && !isOpenTrade(r));
  }, [mergedRows, statusFilter]);

  const openCount = useMemo(
    () => mergedRows.filter((r) => !r.user_absent && isOpenTrade(r)).length,
    [mergedRows],
  );
  const absentCount = useMemo(
    () => mergedRows.filter((r) => r.user_absent === true).length,
    [mergedRows],
  );
  const closedCount = useMemo(
    () => mergedRows.filter((r) => !r.user_absent && !isOpenTrade(r)).length,
    [mergedRows],
  );

  const { page, setPage, pageItems, totalPages, total } = useClientPagination(
    filteredRows,
    PAGE_SIZE,
  );

  const facingMap = useMemo(
    () => buildSequentialUserFacingPlMap(rows, walletBalance, depositBaseline),
    [rows, walletBalance, depositBaseline],
  );

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl px-0 py-4 sm:px-2 md:px-6 md:py-8">
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
              User #{userId} · {openCount} open · {closedCount} closed
              {absentCount > 0 ? ` · ${absentCount} absent` : ""} · {rows.length} assigned
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

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${mergedRows.length})`],
            ["open", `Open (${openCount})`],
            ["closed", `Closed (${closedCount})`],
            ...(absentCount > 0 ? [["absent", `Absent (${absentCount})`] as const] : []),
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Ticket</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Symbol</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Opened</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Closed</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Assigned</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Vol.</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">P/L</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Final</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    No trades found
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => {
                  const isAbsent = r.user_absent === true;
                  const open = !isAbsent && !isTradeClosed(r);
                  const grossPl = isAbsent ? null : rowGrossPl(r);
                  const finalPl = isAbsent
                    ? null
                    : rowFinalWalletPl(r, undefined, undefined, facingMap);
                  const vol = Number(r.allocated_volume ?? 0);
                  const fee = Number(r.proportional_fee ?? 0);
                  const buyPrice = Number(r.price);
                  const rowKey = isAbsent
                    ? `absent-${r.ticket_id}-${r.open_time ?? ""}`
                    : String(r.assignment_id ?? r.ticket_id);

                  return (
                    <tr
                      key={rowKey}
                      className={isAbsent ? "bg-slate-50/80" : "hover:bg-yellow-50/40"}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {r.ticket_id}
                        {isAbsent && (
                          <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            Absent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{r.symbol ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {tradeOpenedAt(r)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {isAbsent ? "—" : tradeClosedAt(r)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {isAbsent ? "—" : formatIsoDateTime(r.assignment_created_at ?? null)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
                        {isAbsent || vol <= 0 ? "—" : vol.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
                        {isAbsent || fee <= 0 ? "—" : fmtUsd(fee)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold tabular-nums ${
                          grossPl == null
                            ? "text-slate-400"
                            : grossPl >= 0
                              ? plTextClass(1)
                              : plTextClass(-1)
                        }`}
                      >
                        {grossPl == null ? "—" : fmtUsd(grossPl)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold tabular-nums ${
                          finalPl == null
                            ? "text-slate-400"
                            : finalPl >= 0
                              ? plTextClass(1)
                              : plTextClass(-1)
                        }`}
                      >
                        {finalPl == null ? "—" : fmtUsd(finalPl)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isAbsent ? (
                          <span
                            className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                            title={r.absence_reason ?? undefined}
                          >
                            {ABSENCE_LABELS[r.absence_reason ?? ""] ?? "Absent"}
                          </span>
                        ) : (
                          <>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                open
                                  ? "bg-sky-50 text-sky-700"
                                  : "border border-slate-200 bg-slate-100 text-slate-700"
                              }`}
                            >
                              {open ? String(r.mt5_status ?? "Open") : "Closed"}
                            </span>
                            {buyPrice > 0 && (
                              <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                                @ {fmtMt5Price(buyPrice, r.symbol)}
                              </div>
                            )}
                          </>
                        )}
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
    </div>
  );
};

export default AdminUserTradesPage;
