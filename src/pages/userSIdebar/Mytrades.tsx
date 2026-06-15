import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  isOpenTrade,
  resolveEffectiveSlice,
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { plBadgeClass, plDotClass } from "@/utils/plColors";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { useClientPagination } from "@/hooks/useClientPagination";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { API_BASE, SOCKET_URL } from "@/config/api";

const PAGE_SIZE = 50;

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

type UserTradeRow = UserTradeRowLike & {
  price?: unknown;
  user_estimated_live_pl?: unknown;
};

type UserSlice = {
  v_i: number;
  V: number;
  fee: number;
  pct: number;
  netFromApi: number | null;
};

function buildSliceMap(utRows: UserTradeRow[]): Record<string, UserSlice> {
  const out: Record<string, UserSlice> = {};
  for (const t of utRows) {
    const ticket = String(t.ticket_id ?? "");
    if (!ticket) continue;
    const { v_i, V, fee, pct } = resolveEffectiveSlice(t);
    const netFromApi =
      t.user_estimated_net_pl == null ? null : Number(t.user_estimated_net_pl);
    out[ticket] = {
      v_i,
      V,
      fee,
      pct,
      netFromApi: Number.isFinite(netFromApi as number) ? (netFromApi as number) : null,
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
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const myTicketIdsRef = useRef<Set<string>>(new Set());
  const myRatiosRef = useRef<Record<string, number>>({});

  const [isConnected, setIsConnected] = useState(socket.connected);

  const fetchBoard = useCallback(async () => {
    if (!currentUser?.userId) return;
    const uid = currentUser.userId;
    try {
      setLoading(true);
      const [assignRes, utData, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/user/trade-assign/${uid}`),
        fetchAllUserTrades(uid),
        fetch(`${API_BASE}/user/summary/${uid}`),
      ]);
      const assignData = await assignRes.json();
      const summaryData = await summaryRes.json();
      if (summaryData?.success) {
        setWalletBalance(Number(summaryData.wallet_balance ?? 0));
        setDepositBaseline(
          Number(summaryData.deposit_baseline ?? summaryData.total_invested ?? 0),
        );
      }

      const utRows: UserTradeRow[] = utData.trades as UserTradeRow[];
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
    const poll = setInterval(fetchBoard, 5000);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const applyLiveProfit = (ticket: string, raw: number) => {
      if (!myTicketIdsRef.current.has(ticket)) return;
      setLiveRawByTicket((prev) => ({ ...prev, [ticket]: raw }));
      setRows((prev) =>
        prev.map((t) =>
          String(t.ticket_id ?? "") === ticket
            ? { ...t, mt5_total_profit: raw }
            : t
        )
      );
    };

    socket.on("mt5live", (live: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(live.ticket ?? "");
      const raw = Number(live.profit);
      if (!ticket || !Number.isFinite(raw)) return;
      applyLiveProfit(ticket, raw);
    });

    socket.on("mt5data", (trade: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(trade.ticket ?? "");
      const raw = Number(trade.profit);
      if (!ticket || !Number.isFinite(raw)) return;
      applyLiveProfit(ticket, raw);
    });

    return () => {
      clearInterval(poll);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("mt5live");
      socket.off("mt5data");
    };
  }, [currentUser?.userId, fetchBoard]);

  const openTrades = useMemo(
    () => rows.filter((t) => isOpenTrade(t)),
    [rows]
  );

  const { page, setPage, pageItems, totalPages, total } = useClientPagination(openTrades, PAGE_SIZE);

  const facingMap = useMemo(
    () =>
      buildSequentialUserFacingPlMap(
        rows,
        walletBalance,
        depositBaseline,
        liveRawByTicket,
      ),
    [rows, walletBalance, depositBaseline, liveRawByTicket],
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

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-3">
            Open trades
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

     <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
  <div className="min-h-[300px]">
    {loading && openTrades.length === 0 ? (
      <div className="p-10 text-center text-slate-500">
        <RefreshCw className="animate-spin mx-auto mb-2 text-yellow-800" />
        Loading trades...
      </div>
    ) : openTrades.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="relative">
          {/* Glow Background */}
          <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-2xl animate-pulse"></div>

          {/* Icon Circle */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 border border-yellow-500 shadow-lg shadow-yellow-500/40">
            <RefreshCw className="w-9 h-9 text-yellow-400 animate-spin" />
          </div>
        </div>

        <h2 className="mt-6 text-2xl font-bold text-slate-800">
          Waiting for Open Trades
        </h2>

        <p className="mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
          If your wallet has been recharged successfully, open trades will
          automatically appear here once they become available.
        </p>

        {/* Animated Dots */}
        <div className="flex gap-2 mt-5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-bounce"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-bounce [animation-delay:0.2s]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-bounce [animation-delay:0.4s]"></span>
        </div>
      </div>
          ) : (
            pageItems.map((trade, i) => {
              const ticket = String(trade.ticket_id ?? "");
              const rawLiveSocket = liveRawByTicket[ticket];
              const slice = resolveEffectiveSlice(trade);

              const displayPl = rowUserFacingPl(
                trade,
                Number.isFinite(rawLiveSocket) ? rawLiveSocket : undefined,
                undefined,
                facingMap,
              );
              const isProfit = displayPl >= 0;
              const yourVol = slice.v_i > 0 ? slice.v_i : Number(trade.allocated_volume || 0);
              const investment = Number(trade.user_investment_amount || 0);

              return (
                <div
                  key={ticket || i}
                  className="flex flex-col gap-2 px-6 py-5 border-b hover:bg-yellow-50/50 transition md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-800 text-lg">
                      {String(trade.symbol || "-")}
                    </div>
                    <div className="text-xs text-slate-500">
                      Ticket: {ticket}
                    </div>
                    {/* {investment > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        Invested: <span className="font-semibold tabular-nums">${investment.toFixed(2)}</span>
                      </div>
                    )} */}
                  </div>

                  <div className="text-sm text-slate-600 flex flex-col gap-0.5 md:items-center">
                    <div>
                      Assign volume:{" "}
                      <span className="font-semibold tabular-nums">
                        {Number.isFinite(yourVol) && yourVol > 0
                          ? yourVol.toFixed(4)
                          : "-"}
                      </span>
                    </div>
                    {/* {fee > 0 && (
                      <div className="text-xs text-slate-500">
                        Fee on close: <span className="tabular-nums">${fee.toFixed(2)}</span>
                      </div>
                    )} */}
                  </div>

                  <div className="text-right">
                    {/* <div className="text-sm text-slate-500">
                      Price: {trade.price != null ? String(trade.price) : "-"}
                    </div> */}

                    <div
                      className={`mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${plBadgeClass(isProfit)}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${isConnected ? "animate-pulse" : ""} ${plDotClass(isProfit)} ${!isConnected ? "opacity-40" : ""}`}
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
        <ListPaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="trades"
        />
      </div>
    </div>
  );
};

export default Mytrades;
