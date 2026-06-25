import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { normTradeStatus } from "@/utils/mt5TradeDates";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import {
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  sumUserFacingPlTotals,
  sortTradesChronological,
  resolveEffectiveSlice,
  isOpenTrade,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { plTextClass } from "@/utils/plColors";

import { API_BASE } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { TradeSummaryFooter } from "@/components/trades/TradeSummaryFooter";

const PAGE_SIZE = 50;

type UserTradeRow = UserTradeRowLike & {
  ticket_id: string;
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const TradeHistory = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignFunded, setAssignFunded] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [feePerLotUsd, setFeePerLotUsd] = useState(30);

  const fetchAssignedTickets = async () => {
    if (!currentUser?.userId) return;
    try {
      const res = await fetch(`${API_BASE}/user/trade-assign/${currentUser.userId}`);
      const data = await res.json();
      setAssignFunded(data?.funded !== false);
    } catch (err) {
      console.error("trade-assign:", err);
    }
  };

  const fetchUserTrades = async () => {
    if (!currentUser?.userId) return;
    try {
      setLoading(true);
      const [data, summaryRes] = await Promise.all([
        fetchAllUserTrades(currentUser.userId),
        fetch(`${API_BASE}/user/summary/${currentUser.userId}`),
      ]);
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
      setRows(data.trades as UserTradeRow[]);
    } catch (err) {
      console.error("user/trades:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAssignedTickets();
    fetchUserTrades();
  };

  useEffect(() => {
    if (!currentUser?.userId) return;
    fetchAssignedTickets();
    fetchUserTrades();
  }, [currentUser?.userId]);

  const sortedRows = useMemo(
    () =>
      sortTradesChronological(rows).sort((a, b) => {
        const ta = new Date(String(a.open_time ?? a.assignment_created_at ?? "").replace(" ", "T")).getTime();
        const tb = new Date(String(b.open_time ?? b.assignment_created_at ?? "").replace(" ", "T")).getTime();
        return tb - ta;
      }),
    [rows],
  );

  const { page, setPage, pageItems, totalPages, total } = useClientPagination(sortedRows, PAGE_SIZE);

  const facingMap = useMemo(
    () => buildSequentialUserFacingPlMap(sortedRows, walletBalance, depositBaseline),
    [sortedRows, walletBalance, depositBaseline],
  );

  const tableTotals = useMemo(
    () => sumUserFacingPlTotals(sortedRows, facingMap),
    [sortedRows, facingMap],
  );

  const userPl = (r: UserTradeRow) => rowUserFacingPl(r, undefined, undefined, facingMap);

  return (
    <div className="mx-auto max-w-7xl p-4">
      {assignFunded === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <button
            type="button"
            className="font-semibold text-neutral-800 underline"
            onClick={() => navigate("/user/recharge")}
          >
            Add funds
          </button>
        </div>
      )}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trade history</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Only trades assigned to you. P/L is your wallet share (after fee and profit rules).
            Fees are shown separately. Open rows are estimates until the trade closes.
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs font-medium text-slate-400">{total} assigned trades</p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Ticket</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Symbol</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Opened</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Closed</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Your volume</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Your P/L</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No assigned trades yet
                  </td>
                </tr>
              ) : (
                pageItems.map((r, index) => {
                  const pl = userPl(r);
                  const open = isOpenTrade(r);
                  const st = normTradeStatus({ status: r.mt5_status });
                  const settled = Boolean(r.wallet_settled_at);
                  const slice = resolveEffectiveSlice({
                    ...r,
                    user_fee_per_lot_usd:
                      (r as UserTradeRow & { user_fee_per_lot_usd?: number }).user_fee_per_lot_usd ??
                      feePerLotUsd,
                  });
                  const vol = slice.v_i;
                  const fee = slice.fee;

                  return (
                    <tr
                      key={`${r.ticket_id}-${r.assignment_id ?? index}`}
                      className="transition-colors hover:bg-yellow-50/50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{r.symbol ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatIsoDateTime(r.open_time ?? r.assignment_created_at ?? null)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {open ? "—" : formatIsoDateTime(r.close_time ?? null)}
                      </td>
                      <td className="px-6 py-4 text-sm tabular-nums text-slate-600">
                        {vol > 0 ? vol.toFixed(4) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm tabular-nums text-slate-600">
                        {fee > 0 ? fmtUsd(fee) : "—"}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-bold tabular-nums ${
                          pl >= 0 ? plTextClass(pl) : plTextClass(-1)
                        }`}
                      >
                        {open ? "~" : ""}
                        {fmtUsd(pl)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            st.includes("CLOSE") || settled
                              ? "border border-slate-200 bg-slate-100 text-slate-700"
                              : "bg-[#FFF9E6] text-neutral-900"
                          }`}
                        >
                          {settled ? "Settled" : st.includes("OPEN") ? "Open" : r.mt5_status ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedRows.length > 0 && (
              <TradeSummaryFooter
                colSpan={5}
                trailingColSpan={2}
                tableTotals={tableTotals}
                capital={{
                  totalDeposited,
                  totalWithdrawn,
                  walletBalance,
                }}
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

export default TradeHistory;
