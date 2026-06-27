import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Coins, BarChart3, Percent } from "lucide-react";
import { io } from "socket.io-client";
import { useApp } from "@/context/AppContext";
import {
  sumLiveProfitLoss,
  rowUserFacingPl,
  buildSequentialUserFacingPlMap,
  recomputeOpenUserLivePl,
  isOpenTrade,
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

function fmtUsd(n: number, currency = "USD") {
  const code = String(currency || "USD").toUpperCase();
  const safe = /^[A-Z]{3}$/.test(code) ? code : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safe,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${safe} ${n.toFixed(2)}`;
  }
}

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

  const liveFromSocket = useMemo(
    () => sumLiveProfitLoss(rows, liveRawByTicket, walletBalance, depositBaseline),
    [rows, liveRawByTicket, walletBalance, depositBaseline],
  );

  const liveFromApi = useMemo(
    () => sumLiveProfitLoss(rows, undefined, walletBalance, depositBaseline),
    [rows, walletBalance, depositBaseline],
  );

  const livePlComputed = useMemo(
    () => recomputeOpenUserLivePl(rows, walletBalance, depositBaseline, liveRawByTicket),
    [rows, walletBalance, depositBaseline, liveRawByTicket],
  );

  const hasSocketLive = Object.keys(liveRawByTicket).length > 0;
  const openCount = rows.filter((r) => isOpenTrade(r)).length;
  const apiLive = Number(summary?.live_pl ?? 0);
  const livePl =
    openCount > 0 && walletBalance > 0.01
      ? Math.abs(livePlComputed) > 0.001 || Math.abs(apiLive) < 0.001
        ? livePlComputed
        : apiLive
      : apiLive || (hasSocketLive ? liveFromSocket.net : liveFromApi.net);

  const cards = [
    {
      title: "Wallet balance",
      value: fmtUsd(summary?.wallet_balance ?? 0, currency),
      icon: Wallet,
      tone: "neutral",
    },
    {
      title: "Realised profit",
      value: fmtUsd(summary?.realised_profit ?? 0, currency),
      icon: TrendingUp,
      tone: "profit",
    },
    {
      title: "Realised loss",
      value: fmtUsd(summary?.realised_loss ?? 0, currency),
      icon: TrendingDown,
      tone: "loss",
    },
    {
      title: "Net realised",
      value: fmtUsd(summary?.realised_net ?? 0, currency),
      icon: BarChart3,
      tone: (summary?.realised_net ?? 0) >= 0 ? "profit" : "loss",
    },
    {
      title: "Live (open) P/L",
      value: fmtUsd(livePl, currency),
      icon: Percent,
      tone: livePl >= 0 ? "profit" : "loss",
    },
    {
      title: "Fees paid",
      value: fmtUsd(summary?.fees_paid ?? 0, currency),
      icon: Coins,
      tone: "neutral",
      footer: summary ? `${summary.fee_per_lot_usd} USDT / 1.0 lot` : undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your share of every assigned trade — volume, fee, and P/L after profit rules.
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

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const toneCls =
            c.tone === "profit"
              ? "text-emerald-600"
              : c.tone === "loss"
                ? "text-red-600"
                : "text-slate-900";
          return (
            <div
              key={c.title}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-neutral-900/8"
            >
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wide">{c.title}</span>
              </div>
              <p className={`text-2xl font-extrabold tabular-nums ${toneCls}`}>{c.value}</p>
              {c.footer && <p className="mt-1 text-xs text-slate-400">{c.footer}</p>}
            </div>
          );
        })}
      </section>

      <Mt5TradeHistoryList
        trades={rows}
        getRowPl={getRowPl}
        loading={loading}
        currency={currency}
        entryByTicket={entryPriceByTicketRef.current}
        emptyMessage="No trades yet"
      />
    </div>
  );
};

export default ProfitLoss;
