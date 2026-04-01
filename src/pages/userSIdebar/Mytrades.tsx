import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { RefreshCw } from "lucide-react";
import axios from "axios";

const API_BASE = "https://mt5api.inditechit.com/api";
const SOCKET_URL = "https://astroapi.inditechit.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

const Mytrades = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profitPercentage, setProfitPercentage] = useState(null); // ✅ NEW

  // 🔹 Fetch Trades (same)
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

  // 🔹 Fetch Profit Percentage (NEW)
  const fetchProfitPercentage = async () => {
    try {
      
  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;
      const res = await fetch(`${API_BASE}/user/profit/${userId}`);
      const data = await res.json();

      if (data.success) {
        setProfitPercentage(data.profit_percentage);
      }
    } catch (err) {
      console.error("Profit fetch error:", err);
    }
  };

  useEffect(() => {
    fetchTrades();
    fetchProfitPercentage(); // ✅ NEW

    socket.on("mt5data", (trade) => {
      setTrades((prev) => {
        const index = prev.findIndex(
          (t) => Number(t.ticket) === Number(trade.ticket)
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
        prev.filter((t) => Number(t.ticket) !== Number(trade.ticket))
      );
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

  const openTrades = trades.filter((t) => t.status === "OPEN");


  const [wallet, setWallet]:any = useState(0);

  const userData = JSON.parse(localStorage.getItem("mt5_user"));
  const userId = userData?.userId;

  const API_BASE = "https://mt5api.inditechit.com/api";

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await axios.get(`${API_BASE}/user/wallet/${userId}`);
        console.log("Wallet data", (res.data.wallet.balance * 94.44).toFixed(2));
        setWallet((res.data.wallet.balance * 94.44).toFixed(2))
      } catch (err) {
        console.error("Wallet fetch error", err);
      }
    };

    if (userId) fetchWallet();
  }, [userId]);
  console.log(wallet,"walletwalletwallet");
  

  return (
    <div className="max-w-8xl mx-auto p-4">

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
                      {((Number(parseFloat(trade.profit || 0).toFixed(2)) * profitPercentage) / 100).toFixed(2)} ---
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