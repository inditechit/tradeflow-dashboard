import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  RefreshCw,
  CalendarRange,
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  Landmark,
  Scale,
  Gauge,
  Percent,
} from "lucide-react";
import { tradeInDateRange } from "@/utils/mt5TradeDates";

const API_BASE = "https://api.copytradeengine.org/api";
const SOCKET_URL = "https://astroapi.inditechit.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});



const fmtMoney = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const fmtPct = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(2)}%`;
};

const normStatus = (t) => String(t?.status ?? "").toUpperCase();

const profitNum = (t) => {
  if (t?.profit === undefined || t?.profit === null || t?.profit === "") {
    return null;
  }
  const p = Number(t.profit);
  return Number.isFinite(p) ? p : null;
};

const Dashboard = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountMetrics, setAccountMetrics] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchAccountMetrics = async () => {
    const paths = ["/admin/mt5-metrics", "/mt5-metrics"];
    for (const path of paths) {
      try {
        const res = await fetch(`${API_BASE}${path}`);
        if (!res.ok) continue;
        const data = await res.json();
        const m = data.metrics || data;
        if (data.success && (m?.equity != null || m?.margin != null)) {
          setAccountMetrics({
            equity: m.equity ?? m.Equity,
            margin: m.margin ?? m.Margin,
            free_margin: m.free_margin ?? m.freeMargin ?? m.FreeMargin,
            margin_level: m.margin_level ?? m.marginLevel ?? m.MarginLevel,
          });
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setAccountMetrics(null);
  };

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

  useEffect(() => {
    fetchTrades();
    fetchAccountMetrics();

    socket.on("mt5data", (trade) => {
      setTrades((prev) => {
        const index = prev.findIndex(
          (t) => Number(t.ticket) === Number(trade.ticket)
        );
        if (index !== -1) {
          const updatedTrades = [...prev];
          updatedTrades[index] = { ...updatedTrades[index], ...trade };
          return updatedTrades;
        }
        return [trade, ...prev];
      });
    });

    // Keep closed rows in the feed (final P/L) — removing them broke totals vs MT4/history.
    socket.on("mt5close", (trade) => {
      setTrades((prev) => {
        const ticket = Number(trade.ticket);
        const idx = prev.findIndex((t) => Number(t.ticket) === ticket);
        const merged = {
          ...trade,
          status: normStatus(trade) || "CLOSED",
        };
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...merged };
          return next;
        }
        return [merged, ...prev];
      });
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

    socket.on("mt5metrics", (payload) => {
      const m = payload?.metrics || payload;
      if (m && (m.equity != null || m.margin != null)) {
        setAccountMetrics({
          equity: m.equity,
          margin: m.margin,
          free_margin: m.free_margin ?? m.freeMargin,
          margin_level: m.margin_level ?? m.marginLevel,
        });
      }
    });

    return () => {
      socket.off("mt5data");
      socket.off("mt5close");
      socket.off("mt5live");
      socket.off("mt5metrics");
    };
  }, []);

  const tradesInRange = useMemo(
    () => trades.filter((t) => tradeInDateRange(t, dateFrom, dateTo)),
    [trades, dateFrom, dateTo]
  );

  const stats = useMemo(() => {
    let realizedProfit = 0;
    let realizedLoss = 0;
    let realizedNet = 0;
    let floatingPl = 0;
    let openNotional = 0;

    for (const t of tradesInRange) {
      const st = normStatus(t);
      const p = profitNum(t);
      const vol = Number(t.volume);
      const px = Number(t.price);

      if (st === "OPEN") {
        if (Number.isFinite(vol) && Number.isFinite(px)) {
          openNotional += vol * px;
        }
        if (p !== null) floatingPl += p;
        continue;
      }

      if (st === "CLOSED" && p !== null) {
        realizedNet += p;
        if (p > 0) realizedProfit += p;
        if (p < 0) realizedLoss += Math.abs(p);
      }
    }

    const combinedNet = realizedNet + floatingPl;

    return {
      openNotional,
      floatingPl,
      realizedProfit,
      realizedLoss,
      realizedNet,
      combinedNet,
    };
  }, [tradesInRange]);

  const filteredTrades = tradesInRange.filter(
    (t) =>
      String(t.status ?? "").toUpperCase() === "OPEN" &&
      t.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dateFilterActive = Boolean(dateFrom || dateTo);

  const equity = accountMetrics?.equity;
  const margin = accountMetrics?.margin;
  const freeMargin = accountMetrics?.free_margin;
  const marginLevel = accountMetrics?.margin_level;

  const statCard = (icon, label, value, sub) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-neutral-900/8">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900">
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );

  const plColor =
  stats.floatingPl > 0
    ? "text-yellow-700"
    : stats.floatingPl < 0
    ? "text-red-600"
    : "text-gray-500";

    const combinedColor =
  stats.combinedNet > 0
    ? "text-yellow-700"
    : stats.combinedNet < 0
    ? "text-red-600"
    : "text-gray-500";

    const realizedColor =
  stats.realizedNet > 0
    ? "text-yellow-700"
    : stats.realizedNet < 0
    ? "text-red-600"
    : "text-gray-500";

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Market Dashboard</h1>
          <p className="text-slate-500 text-sm">
            Live trade monitoring &amp; aggregates
            {dateFilterActive && (
              <span className="text-slate-700">
                {" "}
                · Date range: {dateFrom || "…"} → {dateTo || "…"}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            fetchTrades();
            fetchAccountMetrics();
          }}
          className="px-5 py-2.5 rounded-xl bg-[#FFD700] text-black font-bold hover:bg-[#E6C200] transition flex items-center gap-2 disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <CalendarRange className="h-5 w-5 shrink-0 text-neutral-900" />
          <span className="text-sm font-semibold">Filter by date</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-slate-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
          />
        </div>
        {dateFilterActive && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear dates
          </button>
        )}
      </div>

      <p className="mb-6 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-black">
        Metrics include only trades whose{" "}
        <strong>close time</strong> (closed) or <strong>open time</strong> (open) falls in the
        range above (local timezone). If <code className="rounded bg-amber-100/80 px-1">close_time</code>{" "}
        is missing on a closed row, open time is used. Feed-only sums; not full MT4 equity.
      </p>

      {/* Summary metrics — MT4-style split: realized (closed) vs floating (open) */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">

         {statCard(
          <TrendingUp className="h-4 w-4 text-green-600" />,
          "Realized profit",
          fmtMoney(stats.realizedProfit),
          "CLOSED trades with profit &gt; 0 only."
        )}
        {statCard(
          <TrendingDown className="h-4 w-4 text-red-500" />,
          "Realized loss",
          fmtMoney(stats.realizedLoss),
          "CLOSED trades with profit &lt; 0 (absolute sum)."
        )}

        {statCard(
          <Wallet className="h-4 w-4" />,
          "Open notional (Σ vol×price)",
          fmtMoney(stats.openNotional),
          "Only OPEN trades. Same as your “total invested” column per open row; not broker margin."
        )}
        {statCard(
          <PieChart className={`h-4 w-4 ${plColor}`} />,
          "Floating P/L (open)",
          <span className={plColor}>{fmtMoney(stats.floatingPl)}</span>,
          "Sum of profit on OPEN trades only (unrealized)."
        )}
       
        {statCard(
          <PieChart className={`h-4 w-4 ${realizedColor}`} />,
          "Net Balance",
          <span className={realizedColor}>{fmtMoney(stats.realizedNet)}</span>,
          "Sum of profit on all CLOSED rows."
        )}
        {statCard(
          <PieChart className={`h-4 w-4 ${combinedColor}`} />,
          "Combined P/L (feed)",
          <span className={combinedColor}>{fmtMoney(stats.combinedNet)}</span>,
          "Closed net + floating open. Matches Σ profit if every row is OPEN or CLOSED."
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCard(
          <Landmark className="h-4 w-4" />,
          "Equity",
          fmtMoney(equity),
          equity == null
            ? "From API / socket when your backend exposes it."
            : undefined
        )}
        {statCard(
          <Scale className="h-4 w-4" />,
          "Margin",
          fmtMoney(margin),
          margin == null ? "Requires /admin/mt5-metrics or mt5metrics event." : undefined
        )}
        {statCard(
          <Gauge className="h-4 w-4" />,
          "Free margin",
          fmtMoney(freeMargin),
          freeMargin == null ? "Requires account metrics API." : undefined
        )}
        {statCard(
          <Percent className="h-4 w-4" />,
          "Margin level",
          fmtPct(marginLevel),
          marginLevel == null ? "Requires account metrics API." : undefined
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-neutral-900/8 border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Search Symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div className="min-h-[300px]">
          {loading && trades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-yellow-800" />
              Loading data...
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No active trades found
            </div>
          ) : (
            filteredTrades.map((trade, i) => {
              const isProfit = parseFloat(trade.profit || 0) >= 0;
              return (
                <div
                  key={trade.ticket || i}
                  className="flex justify-between items-center px-6 py-4 border-b border-slate-100 hover:bg-yellow-50/50 transition"
                >
                  <div>
                    <div className="font-bold text-slate-800">{trade.symbol}</div>
                    <div className="text-xs text-slate-500">
                      Ticket: {trade.ticket}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">Vol: {trade.volume}</div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">{trade.price}</div>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm
    ${isProfit
                          ? "bg-[#FFF9E6] text-neutral-900"
                          : "bg-red-100 text-red-700"
                        }`}
                    >
                      <span
                        className={`animate-pulse w-2 h-2 rounded-full ${isProfit ? "bg-[#FFF9E6]0" : "bg-red-500"
                          }`}
                      ></span>

                      {isProfit ? "+" : ""}
                      {trade.profit}
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

export default Dashboard;
