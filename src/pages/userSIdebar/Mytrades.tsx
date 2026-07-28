import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  isOpenTrade,
  isTradeClosed,
  isUserStoppedTrade,
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { API_BASE, SOCKET_URL } from "@/config/api";
import { Mt5TradeHistoryList } from "@/components/trades/Mt5TradeHistoryList";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

type UserTradeRow = UserTradeRowLike & {
  price?: unknown;
  user_estimated_live_pl?: unknown;
};

const Mytrades = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignFunded, setAssignFunded] = useState(true);
  const [liveRawByTicket, setLiveRawByTicket] = useState<Record<string, number>>({});
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBaseline, setDepositBaseline] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const myTicketIdsRef = useRef<Set<string>>(new Set());

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
        setCurrency(summaryData.currency || "USD");
      }

      const utRows: UserTradeRow[] = utData.trades as UserTradeRow[];
      const ticketSet = new Set<string>();
      for (const t of utRows) {
        const ticket = String(t.ticket_id ?? "");
        if (ticket) ticketSet.add(ticket);
      }
      myTicketIdsRef.current = ticketSet;
      setAssignFunded(assignData?.funded !== false);
      setRows(utRows);
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
      setRows((prev) => {
        const current = prev.find((t) => String(t.ticket_id ?? "") === ticket);
        if (current && (isTradeClosed(current) || isUserStoppedTrade(current))) {
          return prev;
        }
        setLiveRawByTicket((lp) => ({ ...lp, [ticket]: raw }));
        return prev.map((t) =>
          String(t.ticket_id ?? "") === ticket
            ? { ...t, mt5_total_profit: raw }
            : t
        );
      });
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

  const openCount = useMemo(() => rows.filter((t) => isOpenTrade(t)).length, [rows]);
  const closedCount = rows.length - openCount;

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

  const getRowPl = useMemo(
    () => (r: UserTradeRow) => {
      if ((r as UserTradeRowLike).history_archived) {
        return Number(
          r.final_profit_loss ?? r.user_facing_pl ?? r.user_wallet_pl ?? 0,
        );
      }
      return rowUserFacingPl(
        r,
        liveRawByTicket[String(r.ticket_id ?? "")],
        undefined,
        facingMap,
      );
    },
    [liveRawByTicket, facingMap],
  );

  return (
    <div className="mx-auto max-w-3xl p-4">
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

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-black">
            My trades
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}
              title={isConnected ? "VM Connected" : "VM Disconnected"}
            />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} assigned ({openCount} open, {closedCount} closed)
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchBoard()}
          className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200]"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <Mt5TradeHistoryList
        trades={rows}
        getRowPl={getRowPl}
        loading={loading}
        currency={currency}
        emptyMessage="No trades yet"
      />
    </div>
  );
};

export default Mytrades;
