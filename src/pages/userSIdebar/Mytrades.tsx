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
  const [allowedTickets, setAllowedTickets] = useState(new Set());
  const [assignFunded, setAssignFunded] = useState(true);
  /** Per-ticket volume slice for proportional P/L: your lots / total lots */
  const [shareMap, setShareMap] = useState<
    Record<string, { v_i: number; V: number }>
  >({});

  const [isConnected, setIsConnected] = useState(socket.connected);

  const loadVolumeSlices = async () => {
    if (!currentUser?.userId) return;
    try {
      const res = await fetch(`${API_BASE}/user/trades/${currentUser.userId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.trades)) {
        const m: Record<string, { v_i: number; V: number }> = {};
        for (const t of data.trades) {
          m[String(t.ticket_id)] = {
            v_i: Number(t.allocated_volume || 0),
            V: Number(t.mt5_volume || t.total_trade_volume || 0),
          };
        }
        setShareMap(m);
      }
    } catch (err) {
      console.error("user/trades:", err);
    }
  };

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

  // 🔹 Fetch All Trades (MT5 board — filtered to your tickets only)
  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/mt5-trades`);
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
      }
      await loadVolumeSlices();
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.userId) return;

    fetchTrades();
    loadVolumeSlices();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

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
      loadVolumeSlices();
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
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
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
            className="font-semibold text-neutral-800 underline"
            onClick={() => navigate('/user/recharge')}
          >
            Add funds
          </button>
        </div>
      )}
      {/* Header */}
      {/* <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">📊 My Open Trades</h1>
          <p className="text-slate-500 text-sm">
            Live profit & running trades
          </p>
        </div>

        

        <button
          onClick={fetchTrades}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div> */}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-3">
            📊 My Open Trades
            {/* 🔥 SUBTLE DEVELOPER CHECK: Green if connected, Red if disconnected */}
            <span 
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} 
              title={isConnected ? "VM Connected" : "VM Disconnected"}
            />
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Live profit & running trades
          </p>
        </div>

        <button
          onClick={fetchTrades}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Trades Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="min-h-[300px]">
          {loading && openTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-yellow-800" />
              Loading trades...
            </div>
          ) : openTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No open trades found
            </div>
          ) : (
            openTrades.map((trade, i) => {
              const raw = Number(trade.profit || 0);
              const isProfit = raw >= 0;
              const sm = shareMap[String(trade.ticket)];
              const Vmt5 = Number(trade.volume || 0);
              let yourShare: number | null = null;
              if (sm && sm.V > 0) {
                yourShare = raw * (sm.v_i / sm.V);
              } else if (Vmt5 > 0) {
                yourShare = raw;
              }

              return (
                <div
                  key={trade.ticket || i}
                  className="flex justify-between items-center px-6 py-5 border-b hover:bg-yellow-50/50 transition"
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
                    Total vol: <span className="font-semibold">{trade.volume}</span>
                    {sm && sm.v_i > 0 ? (
                      <span className="ml-2 text-xs text-slate-500">
                        · Your lot {sm.v_i.toFixed(4)}
                      </span>
                    ) : null}
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
                          ? "bg-[#FFF9E6] text-neutral-900"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                     <span
                        className={`w-2 h-2 rounded-full ${isConnected ? "animate-pulse" : ""} ${
                          isProfit ? "bg-emerald-500" : "bg-red-500"
                        } ${!isConnected ? "opacity-40" : ""}`}
                      />

                      {isProfit ? "+" : ""}
                      {yourShare != null ? yourShare.toFixed(2) : "—"}{" "}
                      <span className="font-normal text-slate-500">(est.)</span>
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