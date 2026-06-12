import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Coins, BarChart3, Percent } from "lucide-react";
import { io } from "socket.io-client";
import { useApp } from "@/context/AppContext";
import {
  sumLiveProfitLoss,
  rowGrossPl,
  rowFinalWalletPl,
  resolveMt5BuySellPrices,
  fmtMt5Price,
  isOpenTrade,
  parseMt5Price,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { API_BASE, SOCKET_URL } from "@/config/api";
import { plBadgeClass, plTextClass } from "@/utils/plColors";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";

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

type UserTradeRow = UserTradeRowLike & {
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
};

type TradeCycle = {
  since_last_recharge?: boolean;
  last_recharge_at?: string | null;
  trade_filter_at?: string | null;
  cycle_deposit_usd?: number | null;
  pinned_baseline?: boolean;
  wallet_correction?: boolean;
};

type TradeTotals = {
  total_profit: number;
  total_loss: number;
  net_pl: number;
  trade_count?: number;
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
  const [cycle, setCycle] = useState<TradeCycle | null>(null);
  const [apiTotals, setApiTotals] = useState<TradeTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveRawByTicket, setLiveRawByTicket] = useState<Record<string, number>>({});
  const myTicketIdsRef = useRef<Set<string>>(new Set());
  const entryPriceByTicketRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!currentUser?.userId) return;
    const uid = currentUser.userId;
    try {
      setLoading(true);
      const [sRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/user/summary/${uid}`),
        fetch(`${API_BASE}/user/trades/${uid}?since_last_recharge=1`),
      ]);
      const sData = await sRes.json();
      const tData = await tRes.json();
      if (sData?.success) setSummary(sData as Summary);
      if (tData?.success && Array.isArray(tData.trades)) {
        if (tData.cycle) setCycle(tData.cycle as TradeCycle);
        if (tData.totals) setApiTotals(tData.totals as TradeTotals);
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

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(b.ticket_id).localeCompare(String(a.ticket_id))),
    [rows]
  );

  const tableTotals = useMemo(() => {
    let grossProfit = 0;
    let grossLoss = 0;
    let finalProfit = 0;
    let finalLoss = 0;
    for (const r of sortedRows) {
      const ticket = String(r.ticket_id ?? "");
      const live = liveRawByTicket[ticket];
      const gross = rowGrossPl(r, live);
      const final = rowFinalWalletPl(r, live);
      if (gross >= 0) grossProfit += gross;
      else grossLoss += gross;
      if (final >= 0) finalProfit += final;
      else finalLoss += final;
    }
    const hasRows = sortedRows.length > 0;
    if (!hasRows && apiTotals) {
      return {
        grossProfit: apiTotals.total_profit,
        grossLoss: apiTotals.total_loss,
        grossNet: apiTotals.net_pl,
        finalProfit: apiTotals.total_profit,
        finalLoss: apiTotals.total_loss,
        finalNet: apiTotals.net_pl,
      };
    }
    return {
      grossProfit,
      grossLoss,
      grossNet: grossProfit + grossLoss,
      finalProfit,
      finalLoss,
      finalNet: finalProfit + finalLoss,
    };
  }, [sortedRows, liveRawByTicket, apiTotals]);

  const cycleNote = useMemo(() => {
    if (!cycle?.since_last_recharge) return null;
    const at = cycle.trade_filter_at ?? cycle.last_recharge_at;
    if (!at) return "Showing all trades in your current account cycle.";
    const d = new Date(at);
    const label = Number.isNaN(d.getTime())
      ? at
      : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    const dep =
      cycle.cycle_deposit_usd != null && cycle.cycle_deposit_usd > 0
        ? ` · funded ${fmtUsd(cycle.cycle_deposit_usd, summary?.currency || "USD")}`
        : "";
    const scope =
      cycle.wallet_correction === true || cycle.pinned_baseline === true
        ? "Trades from ticket 6286933 onward (wallet correction"
        : "Trades in your current cycle (from ";
    return `${scope} ${label})${dep}.`;
  }, [cycle, summary?.currency]);

  const currency = summary?.currency || "USD";

  const liveFromSocket = useMemo(
    () => sumLiveProfitLoss(rows, liveRawByTicket),
    [rows, liveRawByTicket]
  );

  const liveFromApi = useMemo(
    () => sumLiveProfitLoss(rows),
    [rows]
  );

  const hasSocketLive = Object.keys(liveRawByTicket).length > 0;
  const livePl =
    Number(summary?.live_pl ?? 0) ||
    (hasSocketLive ? liveFromSocket.net : liveFromApi.net);

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
            Your share of every trade since your last recharge — after fee and admin profit cut.
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

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Per-trade breakdown</h2>
          <p className="text-xs text-slate-500 mt-1">
            P/L = your share of master trade profit/loss (before fee). Final = amount cut or
            credited to wallet (includes fee on every close).
            {cycleNote ? ` ${cycleNote}` : ""}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Ticket</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Symbol</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Opened</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Closed</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Your vol.</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Buy price</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Sell price</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">P/L</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Final</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                    No trades yet
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const ticket = String(r.ticket_id ?? "");
                  const open = isOpenTrade(r);
                  const grossPl = rowGrossPl(r, liveRawByTicket[ticket]);
                  const finalPl = rowFinalWalletPl(r, liveRawByTicket[ticket]);
                  const grossProfit = grossPl >= 0;
                  const finalProfit = finalPl >= 0;
                  
                  const { buyPrice, sellPrice, buyIsLive, sellIsLive } = resolveMt5BuySellPrices(
                    r,
                    entryPriceByTicketRef.current
                  );

                  const vol = Number(r.allocated_volume ?? 0);
                  const fee = Number(r.proportional_fee ?? 0);

                  return (
                    <tr key={r.ticket_id} className="hover:bg-yellow-50/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{r.symbol ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatIsoDateTime(r.open_time ?? r.assignment_created_at ?? null)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {open ? "—" : formatIsoDateTime(r.close_time ?? null)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {vol > 0 ? vol.toFixed(4) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {buyPrice != null ? (
                          <>
                            {buyIsLive ? "~" : ""}
                            {fmtMt5Price(buyPrice, r.symbol)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {sellPrice != null ? (
                          <>
                            {sellIsLive ? "~" : ""}
                            {fmtMt5Price(sellPrice, r.symbol)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 tabular-nums">
                        {fee > 0 ? fmtUsd(fee, currency) : "—"}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-bold tabular-nums ${
                          grossProfit ? plTextClass(1) : plTextClass(-1)
                        }`}
                      >
                        {open ? "~" : ""}
                        {fmtUsd(grossPl, currency)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-bold tabular-nums ${
                          finalProfit ? plTextClass(1) : plTextClass(-1)
                        }`}
                      >
                        {open ? "~" : ""}
                        {fmtUsd(finalPl, currency)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            open
                              ? "bg-sky-50 text-sky-700"
                              : "border border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {open ? (r.mt5_status ?? "Open") : "Closed"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedRows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={8} className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Complete profit (P/L)
                  </td>
                  <td className="px-6 py-3 text-sm font-bold tabular-nums text-emerald-600">
                    {fmtUsd(tableTotals.grossProfit, currency)}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold tabular-nums text-emerald-600">
                    {fmtUsd(tableTotals.finalProfit, currency)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={8} className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
                    Complete loss (P/L)
                  </td>
                  <td className="px-6 py-3 text-sm font-bold tabular-nums text-red-600">
                    {fmtUsd(tableTotals.grossLoss, currency)}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold tabular-nums text-red-600">
                    {fmtUsd(tableTotals.finalLoss, currency)}
                  </td>
                  <td />
                </tr>
                <tr className="border-t border-slate-200">
                  <td colSpan={8} className="px-6 py-3 text-right text-sm font-bold text-slate-800">
                    Net (P/L / Final)
                  </td>
                  <td
                    className={`px-6 py-3 text-sm font-extrabold tabular-nums ${
                      tableTotals.grossNet >= 0 ? plTextClass(tableTotals.grossNet) : plTextClass(-1)
                    }`}
                  >
                    {fmtUsd(tableTotals.grossNet, currency)}
                  </td>
                  <td
                    className={`px-6 py-3 text-sm font-extrabold tabular-nums ${
                      tableTotals.finalNet >= 0 ? plTextClass(tableTotals.finalNet) : plTextClass(-1)
                    }`}
                  >
                    {fmtUsd(tableTotals.finalNet, currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;