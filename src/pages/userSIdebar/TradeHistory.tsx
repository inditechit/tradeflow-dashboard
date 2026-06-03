import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { normTradeStatus } from "@/utils/mt5TradeDates";
import { rowUserFacingPl, type UserTradeRowLike } from "@/utils/userTradePl";

const API_BASE = "https://api.copytradeengine.org/api";

type UserTradeRow = UserTradeRowLike & {
  ticket_id: string;
  assignment_id?: number;
};

const TradeHistory = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignFunded, setAssignFunded] = useState(true);

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
      const res = await fetch(`${API_BASE}/user/trades/${currentUser.userId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.trades)) {
        setRows(data.trades);
      } else {
        setRows([]);
      }
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

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => String(b.ticket_id).localeCompare(String(a.ticket_id)));
  }, [rows]);

  const sharePl = (r: UserTradeRow) => rowUserFacingPl(r);
  const walletPl = (r: UserTradeRow) => rowUserFacingPl(r);

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
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Wallet P/L is what hit your balance when the trade closed. Live rows are estimates only until cut.
            Losses are 100% yours; profit below deposit is 100% yours; admin share only above deposit.
          </p>
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
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Your volume</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Invested</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Share P/L</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">On withdraw</th>
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
                    No trades yet
                  </td>
                </tr>
              ) : (
                sortedRows.map((r, index) => {
                  const pl = sharePl(r);
                  const wPl = walletPl(r);
                  const isProfit = pl >= 0;
                  const st = normTradeStatus({ status: r.mt5_status });
                  const settled = Boolean(r.wallet_settled_at);
                  const vol = Number(r.allocated_volume ?? 0);
                  const invested = Number(r.user_investment_amount ?? 0);
                  const fee = Number(r.proportional_fee ?? 0);

                  return (
                    <tr
                      key={`${r.ticket_id}-${r.assignment_id ?? index}`}
                      className="transition-colors hover:bg-yellow-50/50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{r.symbol ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {vol > 0 ? vol.toFixed(4) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {invested > 0 ? `$${invested.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {fee > 0 ? `$${fee.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-bold tabular-nums ${
                          isProfit ? "text-yellow-700" : "text-red-600"
                        }`}
                      >
                        {settled ? "" : "~"}
                        {pl.toFixed(2)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-semibold tabular-nums ${
                          wPl >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                        title="Your share credited on withdraw (profit % after fee; losses full)"
                      >
                        {settled ? "" : "~"}
                        {wPl.toFixed(2)}
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
          </table>
        </div>
      </div>
    </div>
  );
};

export default TradeHistory;
