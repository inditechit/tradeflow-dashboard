import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { useApp } from "@/context/AppContext";
import {
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  isOpenTrade,
  isTradeClosed,
  isUserStoppedTrade,
  parseMt5Price,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { API_BASE, SOCKET_URL } from "@/config/api";
import { fetchAllUserTrades } from "@/utils/fetchAllUserTrades";
import { Mt5TradeHistoryList } from "@/components/trades/Mt5TradeHistoryList";

const socket = io(SOCKET_URL, { transports: ["websocket"] });

type Summary = {
  success: true;
  currency: string;
  wallet_balance: number;
  total_invested: number;
  deposit_baseline?: number;
  realised_profit: number;
  realised_loss: number;
  realised_net: number;
  fees_paid: number;
  total_deposited_usd?: number;
  total_withdrawn_usd?: number;
  open_positions: number;
  live_pl: number;
  fee_per_lot_usd: number;
};

type UserTradeRow = UserTradeRowLike & {
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
};

const ProfitLoss = () => {
  const { currentUser } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveRawByTicket, setLiveRawByTicket] = useState<Record<string, number>>({});
  const myTicketIdsRef = useRef<Set<string>>(new Set());
  const entryPriceByTicketRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!currentUser?.userId) return;
    const uid = currentUser.userId;
    try {
      setLoading(true);
      const [sRes, tData] = await Promise.all([
        fetch(`${API_BASE}/user/summary/${uid}`),
        fetchAllUserTrades(uid),
      ]);
      const sData = await sRes.json();
      if (sData?.success) setSummary(sData as Summary);
      if (tData?.success && Array.isArray(tData.trades)) {
        const list = tData.trades as UserTradeRow[];
        const tickets = new Set<string>();
        for (const t of list) {
          const ticket = String(t.ticket_id ?? "");
          if (ticket) tickets.add(ticket);
        }
        myTicketIdsRef.current = tickets;
        for (const t of list) {
          const ticket = String(t.ticket_id ?? "");
          const px = parseMt5Price(t.price);
          if (!ticket || !px || !isOpenTrade(t)) continue;
          if (entryPriceByTicketRef.current[ticket] == null) {
            entryPriceByTicketRef.current[ticket] = px;
          }
        }
        setRows(list);
      }
    } catch (err) {
      console.error("ProfitLoss fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    if (!currentUser?.userId) return;

    const applyLive = (payload: {
      ticket?: unknown;
      profit?: unknown;
      price?: unknown;
    }) => {
      const ticket = String(payload.ticket ?? "");
      if (!ticket || !myTicketIdsRef.current.has(ticket)) return;

      const raw = Number(payload.profit);
      if (Number.isFinite(raw)) {
        setLiveRawByTicket((prev) => ({ ...prev, [ticket]: raw }));
      }

      const livePx = parseMt5Price(payload.price);

      setRows((prev) =>
        prev.map((t) => {
          if (String(t.ticket_id ?? "") !== ticket) return t;
          // Manual stop freezes P/L + price — do not overwrite with live feed.
          if (isTradeClosed(t) || isUserStoppedTrade(t)) return t;
          const next = { ...t };
          if (Number.isFinite(raw)) next.mt5_total_profit = raw;
          if (livePx != null) next.price = livePx;
          return next;
        })
      );
    };

    const onLive = (payload: { ticket?: unknown; profit?: unknown; price?: unknown }) => {
      const ticket = String(payload.ticket ?? "");
      if (!ticket) return;
      const raw = Number(payload.profit);
      if (!Number.isFinite(raw) && parseMt5Price(payload.price) == null) return;
      applyLive(payload);
    };

    socket.on("mt5live", onLive);
    socket.on("mt5data", onLive);
    return () => {
      socket.off("mt5live", onLive);
      socket.off("mt5data", onLive);
    };
  }, [currentUser?.userId]);

  const currency = summary?.currency || "USD";
  const walletBalance = Number(summary?.wallet_balance ?? 0);
  const depositBaseline = Number(summary?.deposit_baseline ?? summary?.total_invested ?? 0);

  // History shows closed/settled trades only — open positions live on the dashboard.
  const closedRows = useMemo(() => rows.filter((r) => isTradeClosed(r)), [rows]);

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
    () => (r: UserTradeRow) =>
      rowUserFacingPl(r, liveRawByTicket[String(r.ticket_id ?? "")], undefined, facingMap),
    [liveRawByTicket, facingMap],
  );

  const accountSummary = useMemo(
    () => ({
      credit: 0,
      deposit: Number(summary?.total_deposited_usd ?? 0),
      withdrawal: -Math.abs(Number(summary?.total_withdrawn_usd ?? 0)),
      balance: walletBalance,
    }),
    [summary?.total_deposited_usd, summary?.total_withdrawn_usd, walletBalance],
  );

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your closed trades — entry/exit, volume and settled P/L.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2.5 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <Mt5TradeHistoryList
        trades={closedRows}
        getRowPl={getRowPl}
        loading={loading}
        currency={currency}
        entryByTicket={entryPriceByTicketRef.current}
        emptyMessage="No closed trades yet"
        accountSummary={accountSummary}
      />
    </div>
  );
};

export default ProfitLoss;
