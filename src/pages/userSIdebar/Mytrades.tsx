import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const API_BASE = "https://mt5api.inditechit.com/api";
const SOCKET_URL = "https://astroapi.inditechit.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

type UserTradeRow = {
  ticket_id?: unknown;
  symbol?: unknown;
  price?: unknown;
  mt5_status?: unknown;
  allocated_volume?: unknown;
  total_trade_volume?: unknown;
  mt5_volume?: unknown;
  user_volume_share?: unknown;
  wallet_settled_at?: unknown;
  user_estimated_live_pl?: unknown;
  final_profit_loss?: unknown;
  mt5_total_profit?: unknown;
};

type UserSlice = {
  v_i: number;
  V: number;
  livePl: number | null;
};

function buildSliceMap(utRows: UserTradeRow[]): Record<string, UserSlice> {
  const out: Record<string, UserSlice> = {};
  for (const t of utRows) {
    const ticket = String(t.ticket_id ?? "");
    if (!ticket) continue;
    const V = Number(t.mt5_volume || t.total_trade_volume || 0);
    const allocated = Number(t.allocated_volume || 0);
    const share = Number(t.user_volume_share || 0);
    const v_i = allocated > 0 ? allocated : share > 0 && V > 0 ? share * V : 0;
    const liveFromApi =
      t.user_estimated_live_pl == null ? null : Number(t.user_estimated_live_pl);
    const settled = t.wallet_settled_at != null;
    const mt5Profit = Number(t.mt5_total_profit || 0);
    const fallbackLive =
      !settled && V > 0 && v_i > 0 ? mt5Profit * (v_i / V) : null;
    out[ticket] = {
      v_i,
      V,
      livePl: liveFromApi ?? fallbackLive,
    };
  }
  return out;
}

const Mytrades = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignFunded, setAssignFunded] = useState(true);
  const [shareMap, setShareMap] = useState<Record<string, UserSlice>>({});
  const [liveRawByTicket, setLiveRawByTicket] = useState<Record<string, number>>({});
  const myTicketIdsRef = useRef<Set<string>>(new Set());
  const myRatiosRef = useRef<Record<string, number>>({});

  const [isConnected, setIsConnected] = useState(socket.connected);

  const fetchBoard = useCallback(async () => {
    if (!currentUser?.userId) return;
    const uid = currentUser.userId;
    try {
      setLoading(true);
      const [assignRes, utRes] = await Promise.all([
        fetch(`${API_BASE}/user/trade-assign/${uid}`),
        fetch(`${API_BASE}/user/trades/${uid}`),
      ]);
      const assignData = await assignRes.json();
      const utData = await utRes.json();

      const utRows =
        utData.success && Array.isArray(utData.trades) ? utData.trades : [];
      const ticketSet = new Set<string>();
      const ratioMap: Record<string, number> = {};
      const nextSlices = buildSliceMap(utRows);
      for (const t of utRows) {
        const ticket = String(t.ticket_id ?? "");
        if (!ticket) continue;
        ticketSet.add(ticket);
        const s = nextSlices[ticket];
        ratioMap[ticket] = s && s.V > 0 ? s.v_i / s.V : 0;
      }
      myTicketIdsRef.current = ticketSet;
      myRatiosRef.current = ratioMap;
      setAssignFunded(assignData?.funded !== false);
      setRows(utRows);
      setShareMap(nextSlices);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    if (!currentUser?.userId) return;

    fetchBoard();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("mt5live", (live: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(live.ticket ?? "");
      if (!myTicketIdsRef.current.has(ticket)) return;
      const raw = Number(live.profit);
      if (!Number.isFinite(raw)) return;
      setLiveRawByTicket((prev) => ({ ...prev, [ticket]: raw }));
    });

    socket.on("mt5data", (trade: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(trade.ticket ?? "");
      if (!myTicketIdsRef.current.has(ticket)) return;
      const raw = Number(trade.profit);
      if (!Number.isFinite(raw)) return;
      setLiveRawByTicket((prev) => ({ ...prev, [ticket]: raw }));
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("mt5live");
      socket.off("mt5data");
    };
  }, [currentUser?.userId, fetchBoard]);

  const openTrades = useMemo(
    () =>
      rows.filter(
        (t) => String(t.mt5_status ?? "").toUpperCase() === "OPEN"
      ),
    [rows]
  );

  return (
    <div className="max-w-8xl mx-auto p-4">
      {assignFunded === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
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
          onClick={() => fetchBoard()}
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
            Open trades
            {/* 🔥 SUBTLE DEVELOPER CHECK: Green if connected, Red if disconnected */}
            <span 
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} 
              title={isConnected ? "VM Connected" : "VM Disconnected"}
            />
          </h1>
          <p className="mt-1 text-sm text-slate-500">Open positions</p>
        </div>

        <button
          type="button"
          onClick={() => fetchBoard()}
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
              const ticket = String(trade.ticket_id ?? "");
              const sm = shareMap[ticket];
              const rawLive = liveRawByTicket[ticket];
              const ratio = myRatiosRef.current[ticket] ?? 0;
              const socketShare =
                Number.isFinite(rawLive) && ratio > 0 ? rawLive * ratio : null;
              const settled = trade.wallet_settled_at != null;
              const settledPl = Number(trade.final_profit_loss || 0);
              const mt5Profit = Number(trade.mt5_total_profit || 0);
              const fallbackLive =
                sm && sm.V > 0 && sm.v_i > 0 ? mt5Profit * (sm.v_i / sm.V) : null;
              const displayPl = settled
                ? settledPl
                : socketShare ??
                  sm?.livePl ??
                  (trade.user_estimated_live_pl == null
                    ? fallbackLive ?? 0
                    : Number(trade.user_estimated_live_pl));
              const isProfit = displayPl >= 0;
              const yourVol =
                sm && sm.v_i > 0
                  ? sm.v_i
                  : Number(trade.allocated_volume || 0);

              return (
                <div
                  key={ticket || i}
                  className="flex justify-between items-center px-6 py-5 border-b hover:bg-yellow-50/50 transition"
                >
                  {/* Left */}
                  <div>
                    <div className="font-bold text-slate-800 text-lg">
                      {String(trade.symbol || "-")}
                    </div>
                    <div className="text-xs text-slate-500">
                      Ticket: {ticket}
                    </div>
                  </div>

                  {/* Middle */}
                  <div className="text-sm text-slate-600">
                    Volume:{" "}
                    <span className="font-semibold">
                      {Number.isFinite(yourVol) && yourVol > 0
                        ? yourVol.toFixed(4)
                        : "-"}
                    </span>
                  </div>

                  {/* Right */}
                  <div className="text-right">
                    <div className="text-sm text-slate-500">
                      Price: {trade.price ?? "-"}
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
                      {Number.isFinite(displayPl) ? displayPl.toFixed(2) : "—"}
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