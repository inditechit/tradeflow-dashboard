import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { RefreshCw } from "lucide-react";

const API_BASE = "https://mt5api.inditechit.com/api";
const SOCKET_URL = "https://astroapi.inditechit.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

const Dashboard = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/mt5-trades`);
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();

    // Listen for the event emitted by AstroAPI
    socket.on("mt5data", (trade) => {
      console.log("📥 Socket Data Received:", trade);

      setTrades((prev) => {
        // Find by ticket number
        const index = prev.findIndex((t) => Number(t.ticket) === Number(trade.ticket));

        if (index !== -1) {
          // Update existing trade
          const updatedTrades = [...prev];
          updatedTrades[index] = { ...updatedTrades[index], ...trade };
          return updatedTrades;
        } else {
          // Add new trade to top
          return [trade, ...prev];
        }
      });
    });

    socket.on("mt5close", (trade) => {
      setTrades((prev) => prev.filter((t) => Number(t.ticket) !== Number(trade.ticket)));
    });

    socket.on("mt5live", (live) => {
      setTrades((prev) =>
        prev.map((t) =>
          Number(t.ticket) === Number(live.ticket)
            ? { ...t, profit: live.profit }
            : t
        )
      );
    });

    return () => {
      socket.off("mt5data");
      socket.off("mt5close");
      socket.off("mt5live");
    };
  }, []);

  const filteredTrades = trades.filter((t) =>
    t.status === "OPEN" &&
    t.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Market Dashboard</h1>
          <p className="text-slate-500 text-sm">Live Trade Monitoring</p>
        </div>
        <button
          onClick={fetchTrades}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-cyan-900/5 border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Search Symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="min-h-[300px]">
          {loading && trades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-cyan-500" />
              Loading data...
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No active trades found
            </div>
          ) : (
            filteredTrades.map((trade, i) => {
              const isProfit = parseFloat(trade.profit || 0) >= 0;
              return (
                <div
                  key={trade.ticket || i}
                  className="flex justify-between items-center px-6 py-4 border-b border-slate-100 hover:bg-cyan-50/30 transition"
                >
                  <div>
                    <div className="font-bold text-slate-800">{trade.symbol}</div>
                    <div className="text-xs text-slate-500">Ticket: {trade.ticket}</div>
                  </div>
                  <div className="text-sm text-slate-600">Vol: {trade.volume}</div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">{trade.price}</div>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm
    ${isProfit
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                        }`}
                    >
                      <span
                        className={`animate-pulse w-2 h-2 rounded-full ${isProfit ? "bg-green-500" : "bg-red-500"
                          }`}
                      ></span>

                      {isProfit ? "+" : ""}
                      {trade.profit}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;