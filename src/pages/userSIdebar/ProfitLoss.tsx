import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Coins, BarChart3, Percent } from "lucide-react";
import { io } from "socket.io-client";
import { useApp } from "@/context/AppContext";
import {
  sumLiveProfitLoss,
  rowNetPl,
  type UserTradeRowLike,
} from "@/utils/userTradePl";

const API_BASE = "https://api.copytradeengine.org/api";
const SOCKET_URL = "https://astroapi.inditechit.com";
const socket = io(SOCKET_URL, { transports: ["websocket"] });

type Summary = {
  success: true;
  currency: string;
  wallet_balance: number;
  total_invested: number;
  realised_profit: number;
  realised_loss: number;
  realised_net: number;
  fees_paid: number;
  open_positions: number;
  live_pl: number;
  fee_per_lot_usd: number;
};

type UserTradeRow = UserTradeRowLike;

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

  const refresh = useCallback(async () => {
    if (!currentUser?.userId) return;
    const uid = currentUser.userId;
    try {
      setLoading(true);
      const [sRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/user/summary/${uid}`),
        fetch(`${API_BASE}/user/trades/${uid}`),
      ]);
      const sData = await sRes.json();
      const tData = await tRes.json();
      if (sData?.success) setSummary(sData as Summary);
      if (tData?.success && Array.isArray(tData.trades)) {
        const list = tData.trades as UserTradeRow[];
        const tickets = new Set<string>();
        for (const t of list) {
          const ticket = String(t.ticket_id ?? "");
          if (ticket) tickets.add(ticket);
        }
        myTicketIdsRef.current = tickets;
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

    const applyLiveProfit = (ticket: string, raw: number) => {
      if (!myTicketIdsRef.current.has(ticket)) return;
      setLiveRawByTicket((prev) => ({ ...prev, [ticket]: raw }));
      setRows((prev) =>
        prev.map((t) =>
          String(t.ticket_id ?? "") === ticket ? { ...t, mt5_total_profit: raw } : t
        )
      );
    };

    const onLive = (payload: { ticket?: unknown; profit?: unknown }) => {
      const ticket = String(payload.ticket ?? "");
      const raw = Number(payload.profit);
      if (!ticket || !Number.isFinite(raw)) return;
      applyLiveProfit(ticket, raw);
    };

    socket.on("mt5live", onLive);
    socket.on("mt5data", onLive);
    return () => {
      socket.off("mt5live", onLive);
      socket.off("mt5data", onLive);
    };
  }, [currentUser?.userId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(b.ticket_id).localeCompare(String(a.ticket_id))),
    [rows]
  );

  const currency = summary?.currency || "USD";

  const liveFromTrades = useMemo(
    () => sumLiveProfitLoss(rows, liveRawByTicket),
    [rows, liveRawByTicket]
  );

  const livePl =
    liveFromTrades.net !== 0 || Object.keys(liveRawByTicket).length > 0
      ? liveFromTrades.net
      : Number(summary?.live_pl ?? 0);

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
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Profit &amp; Loss</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your share of every trade — after fee and admin profit cut.
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          const toneCls =
            c.tone === "profit"
              ? "text-yellow-700"
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

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Per-trade breakdown</h2>
          <p className="text-xs text-slate-500 mt-1">
            ~ rows are live estimates. Settled rows show what hit your wallet.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Ticket</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Symbol</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Share</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Your vol.</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Invested</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Admin %</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">P/L</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No trades yet
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const settled = Boolean(r.wallet_settled_at);
                  const ticket = String(r.ticket_id ?? "");
                  const pl = settled
                    ? Number(r.final_profit_loss ?? 0)
                    : rowNetPl(r, liveRawByTicket[ticket]);
                  const isProfit = pl >= 0;
                  const share = Number(r.user_volume_share ?? 0);
                  const vol = Number(r.allocated_volume ?? 0);
                  const invested =
                    Number(r.user_investment_amount || 0) > 0
                      ? Number(r.user_investment_amount)
                      : Number(r.user_bal || 0);
                  const fee = Number(r.proportional_fee ?? 0);
                  const pct = Number(r.admin_profit_percentage ?? 0);

                  return (
                    <tr key={r.ticket_id} className="hover:bg-yellow-50/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{r.symbol ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {share > 0 ? `${(share * 100).toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {vol > 0 ? vol.toFixed(4) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {invested > 0 ? fmtUsd(invested, currency) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {fee > 0 ? fmtUsd(fee, currency) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {pct > 0 ? `${pct.toFixed(2)}%` : "—"}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-bold tabular-nums ${
                          isProfit ? "text-yellow-700" : "text-red-600"
                        }`}
                      >
                        {settled ? "" : "~"}
                        {fmtUsd(pl, currency)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            settled
                              ? "border border-slate-200 bg-slate-100 text-slate-700"
                              : "bg-[#FFF9E6] text-neutral-900"
                          }`}
                        >
                          {settled ? "Settled" : r.mt5_status ?? "Open"}
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

export default ProfitLoss;
