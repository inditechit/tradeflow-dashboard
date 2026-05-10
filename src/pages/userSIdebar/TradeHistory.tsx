import React, { useEffect, useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const API_BASE = "https://mt5api.inditechit.com/api";

const TradeHistory = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allowedTickets, setAllowedTickets] = useState(new Set());
  
  // Finance States
  const [profitPercentage, setProfitPercentage] = useState<number | null>(null);
  const [assignFunded, setAssignFunded] = useState(true);

  // 🔹 Fetch Assigned Tickets
  const fetchAssignedTickets = async () => {
    if (!currentUser?.userId) return;
    try {
      const res = await fetch(
        `${API_BASE}/user/trade-assign/${currentUser.userId}`
      );
      const data = await res.json();
      if (data && data.tickets) {
        setAllowedTickets(new Set(data.tickets.map(String)));
      }
      setAssignFunded(data?.funded !== false);
    } catch (err) {
      console.error("Error fetching assigned tickets:", err);
    }
  };

  // 🔹 Fetch Finance Data (Profit %)
  const fetchFinanceData = async () => {
    if (!currentUser?.userId) return;
    try {
      const profRes = await fetch(`${API_BASE}/user/profit/${currentUser.userId}`);
      const profData = await profRes.json();

      if (profData.success && profData.profit_percentage != null) {
        setProfitPercentage(Number(profData.profit_percentage));
      }
    } catch (err) {
      console.error("Finance fetch error:", err);
    }
  };

  // 🔹 Fetch All Trades
  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/mt5-trades`);
      const data = await res.json();

      if (data.success) {
        setTrades(data.trades);
      }
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Refresh Action
  const handleRefresh = () => {
    fetchAssignedTickets();
    fetchFinanceData();
    fetchTrades();
  };

  // 🔹 Initial Load
  useEffect(() => {
    if (!currentUser?.userId) return;
    handleRefresh();
  }, [currentUser?.userId]);

  // 🔹 Filter Trades (ticket exists in assigned list)
  const assignedTrades = useMemo(() => {
    return trades.filter((t) => allowedTickets.has(String(t.ticket)));
  }, [trades, allowedTickets]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      {assignFunded === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
          No wallet balance — trade history is hidden until you add funds.{' '}
          <button
            type="button"
            className="font-semibold text-neutral-800 underline"
            onClick={() => navigate('/user/recharge')}
          >
            Recharge wallet
          </button>
        </div>
      )}
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            My Trade History
          </h1>
          <p className="text-slate-500 text-sm">
            Total Trades: {assignedTrades.length} (Open + Closed)
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl shadow-xl shadow-neutral-900/8 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* HEADER */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Ticket
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Account
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Symbol
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Volume
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Price
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Your Profit
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>

            {/* BODY */}
            <tbody className="divide-y divide-slate-100">
              {loading && assignedTrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <RefreshCw className="animate-spin mx-auto mb-2 text-yellow-800" />
                    Loading trades...
                  </td>
                </tr>
              ) : assignedTrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No assigned trades found
                  </td>
                </tr>
              ) : (
                assignedTrades.map((trade, index) => {
                  const rawProfit = Number(trade.profit || 0);
                  const isProfit = rawProfit >= 0;

                 // Start with raw profit (automatically handles losses and fallbacks)
                  let yourShare = rawProfit; 

                  // 1. FIRST: Apply the Admin Profit Percentage cut (ONLY ON WINS)
                  if (isProfit && profitPercentage != null && profitPercentage > 0) {
                    yourShare = rawProfit * (profitPercentage / 100); 
                  }

                  // 2. SECOND: Apply the static $30 per volume cut ONLY IF TRADE IS CLOSED
                  if (String(trade.status).toUpperCase() === "CLOSED") {
                    const adminVolumeCut = 30 * Number(trade.volume); 
                    yourShare = yourShare - adminVolumeCut;
                  }
                  return (
                    <tr
                      key={trade.ticket || index}
                      className="hover:bg-yellow-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {trade.ticket}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {trade.account}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">
                        {trade.symbol}
                      </td>

                      {/* TYPE */}
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            trade?.type === "ORDER_TYPE_BUY"
                              ? "bg-[#FFF9E6] text-yellow-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {trade?.type}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {trade.volume}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {Number(trade.price).toFixed(2)}
                      </td>

                      {/* CALCULATED PROFIT */}
                      <td
                        className={`px-6 py-4 text-sm font-bold ${
                          isProfit ? "text-yellow-700" : "text-red-600"
                        }`}
                      >
                        {yourShare.toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold
                            ${
                              trade.status === "OPEN"
                                ? "bg-[#FFF9E6] text-neutral-900"
                                : "bg-red-100 text-red-700"
                            }`}
                        >
                          {trade.status}
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