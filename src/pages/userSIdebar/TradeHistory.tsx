import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const API_BASE = "https://mt5api.inditechit.com/api";

const TradeHistory = () => {
  const [trades, setTrades] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/mt5-trades`);
      const data = await res.json();

      if (data.success) {
        setTrades(data.trades);
        setCount(data.count);
      }
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
       <div>
    <h1 className="text-2xl font-bold text-slate-800">
      All Trades
    </h1>
    <p className="text-slate-500 text-sm">
      Total Trades: {count} (Open + Closed)
    </p>
  </div>

        <button
          onClick={fetchTrades}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl shadow-xl shadow-cyan-900/5 border border-slate-100 overflow-hidden">
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
                  Profit
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>

            {/* BODY */}
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading trades...
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No open trades
                  </td>
                </tr>
              ) : (
                trades.map((trade, index) => {
                  const isProfit = trade.profit >= 0;


                  return (
                    <tr
                      key={index}
                      className="hover:bg-cyan-50/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {trade.ticket}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {trade.account}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-cyan-600">
                        {trade.symbol}
                      </td>

                      {/* TYPE */}
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${trade?.type === "ORDER_TYPE_BUY"
                              ? "bg-green-50 text-green-600"
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


                      {/* PROFIT */}
                      <td
                        className={`px-6 py-4 text-sm font-bold ${isProfit ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {trade.profit}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold
      ${trade.status === "OPEN"
                              ? "bg-green-100 text-green-700"
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