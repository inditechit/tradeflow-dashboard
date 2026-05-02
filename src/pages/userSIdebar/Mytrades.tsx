import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const API_BASE = "https://mt5api.inditechit.com/api";
const SOCKET_URL = "https://astroapi.inditechit.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

const Mytrades = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profitPercentage, setProfitPercentage] = useState<number | null>(null);
  const [allowedTickets, setAllowedTickets] = useState(new Set());
  const [assignFunded, setAssignFunded] = useState(true);

  // 🔹 Fetch Assigned Tickets
  useEffect(() => {
    if (!currentUser?.userId) return;

    fetch(`${API_BASE}/user/trade-assign/${currentUser.userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.tickets) {
          setAllowedTickets(new Set(data.tickets.map(String)));
        }
        setAssignFunded(data?.funded !== false);
      })
      .catch((err) => console.error("Error fetching assigned tickets:", err));
  }, [currentUser?.userId]);

  // 🔹 Fetch All Trades
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

  // 🔹 Fetch Profit Percentage
  const fetchProfitPercentage = async () => {
    if (!currentUser?.userId) return;
    try {
      const res = await fetch(`${API_BASE}/user/profit/${currentUser.userId}`);
      const data = await res.json();

      if (data.success && data.profit_percentage != null) {
        setProfitPercentage(Number(data.profit_percentage));
      }
    } catch (err) {
      console.error("Profit fetch error:", err);
    }
  };

  useEffect(() => {
    if (!currentUser?.userId) return;

    fetchTrades();
    fetchProfitPercentage();

    socket.on("mt5data", (trade) => {
      setTrades((prev) => {
        const index = prev.findIndex(
          (t) => String(t.ticket) === String(trade.ticket)
        );

        if (index !== -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...trade };
          return updated;
        } else {
          return [trade, ...prev];
        }
      });
    });

    socket.on("mt5close", (trade) => {
      setTrades((prev) =>
        prev.filter((t) => String(t.ticket) !== String(trade.ticket))
      );
    });

    socket.on("mt5live", (live) => {
      setTrades((prev) =>
        prev.map((t) =>
          String(t.ticket) === String(live.ticket)
            ? { ...t, profit: live.profit }
            : t
        )
      );
    });

    socket.on("trade_update", (trade) => {
      setTrades((prev) => {
        // avoid duplicate
        if (prev.some((t) => String(t.ticket) === String(trade.ticket))) return prev;
        return [trade, ...prev];
      });
      // console.log("Socket trade_update:", trade);
    });

    return () => {
      socket.off("mt5data");
      socket.off("mt5close");
      socket.off("mt5live");
      socket.off("trade_update");
    };
  }, [currentUser?.userId]);

  // 🔹 Filter Trades (OPEN status AND ticket exists in assigned list)
  const openTrades = trades.filter((t) => {
    const isOpen = String(t.status ?? "").toUpperCase() === "OPEN";
    const isAllowed = allowedTickets.has(String(t.ticket));
    return isOpen && isAllowed;
  });

  return (
    <div className="max-w-8xl mx-auto p-4">
      {assignFunded === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
          No wallet balance — trades are not assigned.{' '}
          <button
            type="button"
            className="font-semibold text-cyan-700 underline"
            onClick={() => navigate('/user/recharge')}
          >
            Add funds
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">📊 My Open Trades</h1>
          <p className="text-slate-500 text-sm">
            Live profit & running trades
          </p>
        </div>

        <button
          onClick={fetchTrades}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* 🔥 Profit Percentage Card */}
      {/* {profitPercentage !== null && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
            
            <div>
              <p className="text-sm opacity-80">Your Profit Share</p>
              <h2 className="text-2xl font-bold">
                {profitPercentage}%
              </h2>
            </div>

            <div className="text-sm bg-white/20 px-4 py-2 rounded-xl">
              Applied on Live Trades
            </div>

          </div>
        </div>
      )} */}

      {/* Trades Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="min-h-[300px]">
          {loading && openTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-cyan-500" />
              Loading trades...
            </div>
          ) : openTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No open trades found
            </div>
          ) : (
            openTrades.map((trade, i) => {
              const isProfit = parseFloat(trade.profit || 0) >= 0;
              const raw = Number(trade.profit || 0);
              const yourShare =
                profitPercentage != null
                  ? (raw * profitPercentage) / 100
                  : null;

              return (
                <div
                  key={trade.ticket || i}
                  className="flex justify-between items-center px-6 py-5 border-b hover:bg-cyan-50/30 transition"
                >
                  {/* Left */}
                  <div>
                    <div className="font-bold text-slate-800 text-lg">
                      {trade.symbol}
                    </div>
                    <div className="text-xs text-slate-500">
                      Ticket: {trade.ticket}
                    </div>
                  </div>

                  {/* Middle */}
                  <div className="text-sm text-slate-600">
                    Vol: <span className="font-semibold">{trade.volume}</span>
                  </div>

                  {/* Right */}
                  <div className="text-right">
                    <div className="text-sm text-slate-500">
                      Price: {trade.price}
                    </div>

                    <div
                      className={`mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold
                      ${
                        isProfit
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full animate-pulse ${
                          isProfit ? "bg-green-500" : "bg-red-500"
                        }`}
                      />

                      {isProfit ? "+" : ""}
                      {yourShare != null
                        ? yourShare.toFixed(2)
                        : "—"}{" "}
                      {/* <span className="text-xs font-normal opacity-80">(your {profitPercentage ?? "—"}%)</span> */}
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

export default Mytrades;